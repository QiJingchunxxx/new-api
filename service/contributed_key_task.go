package service

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/bytedance/gopkg/util/gopool"
)

const (
	contributedKeyTickInterval = 1 * time.Minute
	contributedKeyRecalcGap    = 10 * time.Minute
	contributedKeyVerifyBatch  = 30
)

var (
	contributedKeyTaskOnce       sync.Once
	contributedKeyTaskRunning    atomic.Bool
	contributedKeyLastVerifyTime int64
	contributedKeyLastRecalcTime int64
	contributedKeyLastRecalcDate string
)

// StartContributedKeyTask 启动贡献上游 Key 的后台维护任务。
//
// 负责三件事：
//  1. 跨天回收昨天发放的贡献额度（每日重置）；
//  2. 周期验证所有贡献的 Key，失效则停用对应渠道并扣回额度；
//  3. 为新的一天补发额度，保证用户持有的有效 Key 每天都能拿到奖励。
func StartContributedKeyTask() {
	contributedKeyTaskOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			ctx := context.Background()
			logger.LogInfo(ctx, fmt.Sprintf("contributed key task started: tick=%s", contributedKeyTickInterval))
			ticker := time.NewTicker(contributedKeyTickInterval)
			defer ticker.Stop()

			runContributedKeyMaintenance()
			for range ticker.C {
				runContributedKeyMaintenance()
			}
		})
	})
}

func runContributedKeyMaintenance() {
	if !contributedKeyTaskRunning.CompareAndSwap(false, true) {
		return
	}
	defer contributedKeyTaskRunning.Store(false)

	setting := operation_setting.GetContributedKeySetting()
	operation_setting.NormalizeContributedKeySetting()
	if !setting.Enabled {
		return
	}

	ctx := context.Background()

	// 1. 每日重置：回收历史发放记录，把额度从用户余额中扣回。
	recycled, err := model.RolloverContributionGrants()
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("contributed quota rollover failed: %v", err))
	}

	// 2. 跨天或距上次重算超过阈值时，为持有有效 Key 的用户补发当天额度。
	businessDate := model.ContributedBusinessDate(time.Now())
	recalcDue := businessDate != contributedKeyLastRecalcDate ||
		time.Since(time.Unix(contributedKeyLastRecalcTime, 0)) >= contributedKeyRecalcGap
	if recycled > 0 {
		recalcDue = true
	}
	if recalcDue {
		recalcContributedQuotaForAllUsers(ctx)
		contributedKeyLastRecalcDate = businessDate
		contributedKeyLastRecalcTime = time.Now().Unix()
	}

	// 3. 定时验证贡献的 Key，失效的 Key 会被停用并同步扣回额度。
	if time.Since(time.Unix(contributedKeyLastVerifyTime, 0)) < time.Duration(setting.VerifyIntervalMin)*time.Minute {
		return
	}
	verified, providers := verifyContributedKeyBatch(ctx)
	contributedKeyLastVerifyTime = time.Now().Unix()
	if len(providers) > 0 {
		// 复检结束后统一重建号池：清掉失效的 Key，并把已恢复的 Key 静默放回轮询队列。
		SyncContributedPools(ctx, providers, true)
	}
	if verified > 0 {
		logger.LogInfo(ctx, fmt.Sprintf("contributed key verification finished: verified=%d", verified))
	}
}

func recalcContributedQuotaForAllUsers(ctx context.Context) {
	userIds, err := model.ListContributedKeyUserIds()
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("failed to list contributed key owners: %v", err))
		return
	}
	for _, userId := range userIds {
		if _, err := model.RecalcUserContributionQuota(userId); err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("failed to recalculate contributed quota: user_id=%d err=%v", userId, err))
		}
	}
}

func verifyContributedKeyBatch(ctx context.Context) (int, []string) {
	setting := operation_setting.GetContributedKeySetting()
	cutoff := time.Now().
		Add(-time.Duration(setting.VerifyIntervalMin) * time.Minute).
		Unix()
	keys, err := model.ListKeysNeedingVerification(cutoff, contributedKeyVerifyBatch)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("failed to list contributed keys for verification: %v", err))
		return 0, nil
	}
	if len(keys) == 0 {
		return 0, nil
	}
	VerifyContributedKeysConcurrently(ctx, keys)
	providers := make([]string, 0, len(keys))
	for _, item := range keys {
		providers = append(providers, item.Provider)
	}
	return len(keys), providers
}
