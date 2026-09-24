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

	"github.com/bytedance/gopkg/util/gopool"
)

const (
	landingStatsTickInterval  = 30 * time.Second
	landingStatsRefreshGap    = 60 * time.Second
	landingStatsVisitFlushGap = 60 * time.Second
	landingStatsDateLayout    = "2006-01-02"
)

// LandingModelUsage 单个模型当天的用量，供首页模型卡片展示。
type LandingModelUsage struct {
	ModelName        string `json:"model_name"`
	Calls            int64  `json:"calls"`
	PromptTokens     int64  `json:"prompt_tokens"`
	CompletionTokens int64  `json:"completion_tokens"`
	TotalTokens      int64  `json:"total_tokens"`
}

// LandingStats 首页数据条的统计快照。
//
// 全部为「当天」口径：调用次数、Token 消耗、页面访问量与注册用户数。
// 数据由后台任务定时聚合，接口只读内存缓存，避免首页每次请求都去打日志表。
type LandingStats struct {
	Date                  string              `json:"date"`
	TodayCalls            int64               `json:"today_calls"`
	TodayPromptTokens     int64               `json:"today_prompt_tokens"`
	TodayCompletionTokens int64               `json:"today_completion_tokens"`
	TodayTokens           int64               `json:"today_tokens"`
	TodayVisits           int64               `json:"today_visits"`
	UserCount             int64               `json:"user_count"`
	Models                []LandingModelUsage `json:"models"`
	UpdatedTime           int64               `json:"updated_time"`
}

var (
	landingStatsMu          sync.RWMutex
	landingStatsRefreshMu   sync.Mutex
	landingStatsSnapshot    LandingStats
	landingStatsLastRefresh int64

	landingStatsTaskOnce    sync.Once
	landingStatsTaskRunning atomic.Bool
	landingStatsLastFlush   int64

	landingVisitMu      sync.Mutex
	landingVisitPending int64
)

// GetLandingStats 返回统计快照。
//
// 缓存为空时同步刷新一次，保证首次访问不会看到全 0；
// 之后一律读缓存，刷新交给后台任务。
func GetLandingStats() LandingStats {
	if landingStatsSnapshotIsEmpty() {
		refreshLandingStats()
	}
	landingStatsMu.RLock()
	defer landingStatsMu.RUnlock()
	snapshot := landingStatsSnapshot
	snapshot.Models = append([]LandingModelUsage(nil), landingStatsSnapshot.Models...)
	return snapshot
}

func landingStatsSnapshotIsEmpty() bool {
	landingStatsMu.RLock()
	defer landingStatsMu.RUnlock()
	return landingStatsSnapshot.UpdatedTime == 0
}

// RecordLandingVisit 记录一次落地页访问。
//
// 只累加在内存里，由后台任务批量落库，避免首页每次打开都写一次数据库。
func RecordLandingVisit() {
	landingVisitMu.Lock()
	landingVisitPending++
	landingVisitMu.Unlock()
}

// StartLandingStatsTask 启动首页统计的后台刷新任务。
func StartLandingStatsTask() {
	landingStatsTaskOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			ctx := context.Background()
			logger.LogInfo(ctx, fmt.Sprintf("landing stats task started: tick=%s", landingStatsTickInterval))
			ticker := time.NewTicker(landingStatsTickInterval)
			defer ticker.Stop()

			refreshLandingStats()
			for range ticker.C {
				if time.Since(time.Unix(landingStatsLastRefresh, 0)) >= landingStatsRefreshGap {
					refreshLandingStats()
				}
				if time.Since(time.Unix(landingStatsLastFlush, 0)) >= landingStatsVisitFlushGap {
					flushLandingVisits(ctx)
				}
			}
		})
	})
}

// refreshLandingStats 重新聚合当天用量并刷新缓存。
func refreshLandingStats() {
	// 串行化：首次访问的并发请求可能同时进来，避免重复打日志表。
	landingStatsRefreshMu.Lock()
	defer landingStatsRefreshMu.Unlock()

	now := time.Now()
	today := now.Format(landingStatsDateLayout)
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).Unix()

	snapshot := LandingStats{
		Date:        today,
		Models:      make([]LandingModelUsage, 0),
		UpdatedTime: common.GetTimestamp(),
	}

	if model.LOG_DB != nil {
		var rows []LandingModelUsage
		err := model.LOG_DB.Table("logs").
			Select("model_name, COUNT(*) AS calls, " +
				"COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens, " +
				"COALESCE(SUM(completion_tokens), 0) AS completion_tokens").
			Where("type = ? AND created_at >= ?", model.LogTypeConsume, todayStart).
			Group("model_name").
			Scan(&rows).Error
		if err != nil {
			logger.LogWarn(context.Background(), fmt.Sprintf("failed to aggregate today model usage: %v", err))
		} else {
			for i := range rows {
				rows[i].TotalTokens = rows[i].PromptTokens + rows[i].CompletionTokens
				snapshot.TodayCalls += rows[i].Calls
				snapshot.TodayPromptTokens += rows[i].PromptTokens
				snapshot.TodayCompletionTokens += rows[i].CompletionTokens
			}
			snapshot.Models = rows
		}
	}
	snapshot.TodayTokens = snapshot.TodayPromptTokens + snapshot.TodayCompletionTokens

	visits, err := model.GetLandingVisits(today)
	if err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("failed to read landing visits: %v", err))
	}
	landingVisitMu.Lock()
	visits += landingVisitPending
	landingVisitMu.Unlock()
	snapshot.TodayVisits = visits

	if count, err := model.CountActiveUsers(); err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("failed to count users: %v", err))
	} else {
		snapshot.UserCount = count
	}

	landingStatsMu.Lock()
	landingStatsSnapshot = snapshot
	landingStatsMu.Unlock()
	landingStatsLastRefresh = time.Now().Unix()
}

// flushLandingVisits 把内存里累积的访问量落到数据库；失败则放回等待下个周期。
func flushLandingVisits(ctx context.Context) {
	landingVisitMu.Lock()
	pending := landingVisitPending
	landingVisitPending = 0
	landingVisitMu.Unlock()
	if pending == 0 {
		landingStatsLastFlush = time.Now().Unix()
		return
	}
	if err := model.AddLandingVisits(time.Now().Format(landingStatsDateLayout), pending); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("failed to persist landing visits: %v", err))
		landingVisitMu.Lock()
		landingVisitPending += pending
		landingVisitMu.Unlock()
		return
	}
	landingStatsLastFlush = time.Now().Unix()
}
