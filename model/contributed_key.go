package model

import (
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"gorm.io/gorm"
)

// 贡献 Key 状态
const (
	ContributedKeyStatusPending = 0 // 待验证
	ContributedKeyStatusValid   = 1 // 验证通过
	ContributedKeyStatusInvalid = 2 // 验证失败
)

// 验证失败原因分类。用户端只看到分类，看不到上游返回的原始报错。
const (
	ContributedReasonNone     = ""
	ContributedReasonAuth     = "auth"     // Key 无效 / 被撤销 / 无权限
	ContributedReasonQuota    = "quota"    // 上游额度不足或触发限流
	ContributedReasonNetwork  = "network"  // 网络不可达或超时
	ContributedReasonUpstream = "upstream" // 上游 5xx
	ContributedReasonFormat   = "format"   // 上游响应无法解析
	ContributedReasonConfig   = "config"   // 站点未正确配置该供应商
	ContributedReasonUnknown  = "unknown"  // 其他
)

// ContributedKey 用户贡献的上游 Key。
//
// Key 明文保存是必须的：验证通过后需要把 Key 写入渠道池供网关转发请求使用，
// 与 Channel.Key 的处理方式保持一致；管理端列表只返回掩码后的 Key。
type ContributedKey struct {
	Id              int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId          int    `json:"user_id" gorm:"index;not null"`
	Username        string `json:"username" gorm:"type:varchar(64);index"`
	Provider        string `json:"provider" gorm:"type:varchar(64);not null;uniqueIndex:idx_contributed_key_unique"`
	Key             string `json:"key" gorm:"type:text;not null"`
	KeyHash         string `json:"-" gorm:"type:varchar(64);not null;uniqueIndex:idx_contributed_key_unique"`
	Status          int    `json:"status" gorm:"default:0;index"`
	Enabled         bool   `json:"enabled" gorm:"default:true;index"`
	Message         string `json:"message" gorm:"type:text"`
	ReasonCode      string `json:"reason_code" gorm:"type:varchar(32)"`
	Models          string `json:"models" gorm:"type:text"`
	VerifyCount     int    `json:"verify_count" gorm:"default:0"`
	LastVerifyTime  int64  `json:"last_verify_time" gorm:"bigint;index"`
	LastVerifyError string `json:"last_verify_error" gorm:"type:text"`
	Remark          string `json:"remark" gorm:"type:varchar(255)"`
	CreatedTime     int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime     int64  `json:"updated_time" gorm:"bigint"`
}

func (ContributedKey) TableName() string {
	return "contributed_keys"
}

// ContributedKeyGrant 记录某个用户某一天通过贡献 Key 获得的额度。
// 跨天后由定时任务回收（settled=true 表示已经扣回），实现“每天重置额度”。
type ContributedKeyGrant struct {
	Id          int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId      int    `json:"user_id" gorm:"not null;uniqueIndex:idx_contributed_grant"`
	GrantDate   string `json:"grant_date" gorm:"type:varchar(10);not null;uniqueIndex:idx_contributed_grant"`
	Quota       int    `json:"quota" gorm:"not null;default:0"`
	KeyUnits    int    `json:"key_units" gorm:"default:0"`
	Settled     bool   `json:"settled" gorm:"default:false;index"`
	CreatedTime int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime int64  `json:"updated_time" gorm:"bigint"`
}

func (ContributedKeyGrant) TableName() string {
	return "contributed_key_grants"
}

// ---------------------------------------------------------------------------
// 查询
// ---------------------------------------------------------------------------

func GetContributedKeysByUser(userId int) ([]*ContributedKey, error) {
	var keys []*ContributedKey
	err := DB.Where("user_id = ?", userId).Order("id desc").Find(&keys).Error
	return keys, err
}

func GetContributedKeyById(id int) (*ContributedKey, error) {
	var key ContributedKey
	err := DB.Where("id = ?", id).First(&key).Error
	if err != nil {
		return nil, err
	}
	return &key, nil
}

// GetContributedKeyByProviderAndHash 用于全局去重：同一个上游 Key 只能被提交一次。
func GetContributedKeyByProviderAndHash(provider, keyHash string) (*ContributedKey, error) {
	var key ContributedKey
	err := DB.Where("provider = ? AND key_hash = ?", provider, keyHash).First(&key).Error
	if err != nil {
		return nil, err
	}
	return &key, nil
}

// ContributedKeyQuery 管理端列表查询条件
type ContributedKeyQuery struct {
	UserId   int
	Provider string
	Status   string // "" / "0" / "1" / "2" / "enabled" / "disabled"
	Keyword  string
	Offset   int
	Limit    int
}

func queryContributedKeys(query ContributedKeyQuery) *gorm.DB {
	tx := DB.Model(&ContributedKey{})
	if query.UserId > 0 {
		tx = tx.Where("user_id = ?", query.UserId)
	}
	if query.Provider != "" {
		tx = tx.Where("provider = ?", query.Provider)
	}
	switch query.Status {
	case "0", "1", "2":
		tx = tx.Where("status = ?", query.Status)
	case "enabled":
		tx = tx.Where("enabled = ?", true)
	case "disabled":
		tx = tx.Where("enabled = ?", false)
	}
	if keyword := strings.TrimSpace(query.Keyword); keyword != "" {
		pattern := "%" + keyword + "%"
		tx = tx.Where("(username LIKE ? OR provider LIKE ? OR remark LIKE ?)", pattern, pattern, pattern)
	}
	return tx
}

func GetContributedKeys(query ContributedKeyQuery) ([]*ContributedKey, int64, error) {
	var total int64
	if err := queryContributedKeys(query).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if query.Limit <= 0 {
		query.Limit = 20
	}
	var keys []*ContributedKey
	err := queryContributedKeys(query).
		Order("id desc").
		Offset(query.Offset).
		Limit(query.Limit).
		Find(&keys).Error
	return keys, total, err
}

// GetContributedKeyStats 管理端总览统计
func GetContributedKeyStats() (map[string]any, error) {
	var total, valid, invalid, pending, enabled int64
	if err := DB.Model(&ContributedKey{}).Count(&total).Error; err != nil {
		return nil, err
	}
	if err := DB.Model(&ContributedKey{}).Where("status = ?", ContributedKeyStatusValid).Count(&valid).Error; err != nil {
		return nil, err
	}
	if err := DB.Model(&ContributedKey{}).Where("status = ?", ContributedKeyStatusInvalid).Count(&invalid).Error; err != nil {
		return nil, err
	}
	if err := DB.Model(&ContributedKey{}).Where("status = ?", ContributedKeyStatusPending).Count(&pending).Error; err != nil {
		return nil, err
	}
	if err := DB.Model(&ContributedKey{}).Where("enabled = ?", true).Count(&enabled).Error; err != nil {
		return nil, err
	}
	var todayQuota int64
	today := ContributedBusinessDate(time.Now())
	err := DB.Model(&ContributedKeyGrant{}).
		Where("grant_date = ?", today).
		Select("COALESCE(SUM(quota), 0)").
		Scan(&todayQuota).Error
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"total":            total,
		"valid":            valid,
		"invalid":          invalid,
		"pending":          pending,
		"enabled":          enabled,
		"today_quota":      todayQuota,
		"today_grant_date": today,
	}, nil
}

// ---------------------------------------------------------------------------
// 写入
// ---------------------------------------------------------------------------

func CreateContributedKey(key *ContributedKey) error {
	now := common.GetTimestamp()
	if key.CreatedTime == 0 {
		key.CreatedTime = now
	}
	key.UpdatedTime = now
	key.KeyHash = HashContributedKey(key.Key)
	return DB.Create(key).Error
}

func UpdateContributedKey(key *ContributedKey) error {
	key.UpdatedTime = common.GetTimestamp()
	return DB.Model(&ContributedKey{}).Where("id = ?", key.Id).Updates(map[string]any{
		"user_id":           key.UserId,
		"username":          key.Username,
		"provider":          key.Provider,
		"key":               key.Key,
		"key_hash":          key.KeyHash,
		"status":            key.Status,
		"enabled":           key.Enabled,
		"message":           key.Message,
		"reason_code":       key.ReasonCode,
		"models":            key.Models,
		"verify_count":      key.VerifyCount,
		"last_verify_time":  key.LastVerifyTime,
		"last_verify_error": key.LastVerifyError,
		"remark":            key.Remark,
		"updated_time":      key.UpdatedTime,
	}).Error
}

// UpdateContributedKeyVerification 只更新验证结果相关的字段，避免覆盖管理端备注等字段。
func UpdateContributedKeyVerification(id, status int, reasonCode, message, models string, verifyCount int) error {
	now := common.GetTimestamp()
	return DB.Model(&ContributedKey{}).Where("id = ?", id).Updates(map[string]any{
		"status":            status,
		"reason_code":       reasonCode,
		"message":           message,
		"models":            models,
		"verify_count":      verifyCount,
		"last_verify_time":  now,
		"last_verify_error": message,
		"updated_time":      now,
	}).Error
}

func DeleteContributedKey(id int) error {
	return DB.Where("id = ?", id).Delete(&ContributedKey{}).Error
}

// ---------------------------------------------------------------------------
// 额度计算
// ---------------------------------------------------------------------------

const (
	contributedGrantDateFormat  = "2006-01-02"
	contributedDefaultChunkSize = 200
)

// contributedQuotaRecalcLock 串行化单进程内的额度重算。
// 同一用户的多次并发重算会互相覆盖发放记录，导致额度重复发放或漏发。
var contributedQuotaRecalcLock sync.Mutex

// ContributedBusinessDate 返回贡献额度所属的业务日期。
// 后台可配置重置时刻（reset_hour），例如配置为 4 表示每天 04:00 重置额度。
func ContributedBusinessDate(now time.Time) string {
	operation_setting.NormalizeContributedKeySetting()
	hour := operation_setting.GetContributedKeySetting().ResetHour
	if hour > 0 {
		now = now.Add(-time.Duration(hour) * time.Hour)
	}
	return now.Format(contributedGrantDateFormat)
}

// HashContributedKey 计算 Key 摘要，用于唯一索引与去重。
func HashContributedKey(key string) string {
	return hex.EncodeToString(common.Sha256Raw([]byte(strings.TrimSpace(key))))
}

// IsDuplicateContributedKeyError 判断错误是否来自唯一索引冲突。
// 不同数据库驱动的报错文案不一致，这里只做必要的粗匹配。
func IsDuplicateContributedKeyError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "unique") || strings.Contains(message, "duplicate")
}

// MaskContributedKey 返回掩码后的 Key，供前端展示。
func MaskContributedKey(key string) string {
	trimmed := strings.TrimSpace(key)
	if len(trimmed) <= 10 {
		if len(trimmed) <= 4 {
			return "****"
		}
		return trimmed[:2] + "****" + trimmed[len(trimmed)-2:]
	}
	return trimmed[:6] + "****" + trimmed[len(trimmed)-4:]
}

// QuotaFromContributedAmount 把美元金额换算为额度单位。
func QuotaFromContributedAmount(amount float64) int {
	if amount <= 0 {
		return 0
	}
	return int(math.Round(amount * common.QuotaPerUnit))
}

// CountUserValidContributedUnits 统计用户当前可用于计算奖励的有效 Key 数量。
// rewardPerKey=true 时按 Key 计数，否则按去重后的供应商计数。
func CountUserValidContributedUnits(userId int, rewardPerKey bool) (int, error) {
	tx := DB.Model(&ContributedKey{}).
		Where("user_id = ? AND status = ? AND enabled = ?", userId, ContributedKeyStatusValid, true)
	var count int64
	var err error
	if rewardPerKey {
		err = tx.Count(&count).Error
	} else {
		err = tx.Distinct("provider").Count(&count).Error
	}
	if err != nil {
		return 0, err
	}
	return int(count), nil
}

// GetContributedGrant 读取某用户某天的发放记录。
func GetContributedGrant(userId int, date string) (*ContributedKeyGrant, error) {
	var grant ContributedKeyGrant
	err := DB.Where("user_id = ? AND grant_date = ?", userId, date).First(&grant).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &grant, nil
}

// RecalcUserContributionQuota 重算用户当天应得的贡献额度并补齐差额。
//
// 返回值当天实际发放的额度。Key 全部失效或功能关闭时会自动把已发放的额度扣回，
// 对应需求中的“贡献的 Key 不可用则清空额度”。
//
// 并发安全：同一进程内用互斥锁串行化；跨实例的并发用“发放记录行上的
// 比较并交换 + 唯一索引兜底”保证只发放一次。
func RecalcUserContributionQuota(userId int) (int, error) {
	contributedQuotaRecalcLock.Lock()
	defer contributedQuotaRecalcLock.Unlock()

	setting := operation_setting.GetContributedKeySetting()
	operation_setting.NormalizeContributedKeySetting()

	units := 0
	entitlement := 0
	if setting.Enabled {
		validUnits, err := CountUserValidContributedUnits(userId, setting.RewardPerKey)
		if err != nil {
			return 0, err
		}
		if validUnits > 0 {
			units = validUnits
			entitlement = validUnits * QuotaFromContributedAmount(setting.RewardAmount)
			if capQuota := QuotaFromContributedAmount(setting.DailyCapAmount); capQuota > 0 && entitlement > capQuota {
				entitlement = capQuota
			}
		}
	}

	today := ContributedBusinessDate(time.Now())
	var grant ContributedKeyGrant
	queryErr := DB.Where("user_id = ? AND grant_date = ?", userId, today).First(&grant).Error
	if queryErr != nil && !errors.Is(queryErr, gorm.ErrRecordNotFound) {
		return 0, queryErr
	}
	now := common.GetTimestamp()

	if errors.Is(queryErr, gorm.ErrRecordNotFound) {
		if entitlement == 0 {
			return 0, nil
		}
		grant = ContributedKeyGrant{
			UserId:      userId,
			GrantDate:   today,
			Quota:       entitlement,
			KeyUnits:    units,
			CreatedTime: now,
			UpdatedTime: now,
		}
		if err := DB.Create(&grant).Error; err != nil {
			if IsDuplicateContributedKeyError(err) {
				// 唯一索引兜底：并发插入失败说明今天已经发放过，交由赢家处理。
				return 0, nil
			}
			return 0, err
		}
		if err := DeltaUpdateUserQuota(userId, entitlement); err != nil {
			return 0, err
		}
		return entitlement, nil
	}

	current := 0
	if !grant.Settled {
		current = grant.Quota
	}
	delta := entitlement - current
	if delta == 0 {
		return entitlement, nil
	}
	result := DB.Model(&ContributedKeyGrant{}).
		Where("id = ? AND quota = ?", grant.Id, grant.Quota).
		Updates(map[string]any{
			"quota":        entitlement,
			"key_units":    units,
			"settled":      false,
			"updated_time": now,
		})
	if result.Error != nil {
		return 0, result.Error
	}
	if result.RowsAffected == 0 {
		// 其他实例已经改写过今天的发放记录，本次不再重复发放。
		return entitlement, nil
	}
	if err := DeltaUpdateUserQuota(userId, delta); err != nil {
		// 回滚发放记录，否则下次重算会认为差额已结清，导致永久少发。
		DB.Model(&ContributedKeyGrant{}).Where("id = ?", grant.Id).Update("quota", current)
		return 0, err
	}
	return entitlement, nil
}

// RolloverContributionGrants 回收所有跨天的贡献额度，实现每日重置。
//
// 先置 settled 标记再扣回额度，保证任务重试时不会重复扣减。
func RolloverContributionGrants() (int, error) {
	today := ContributedBusinessDate(time.Now())
	var grants []ContributedKeyGrant
	err := DB.Where("grant_date < ? AND settled = ?", today, false).
		Order("id asc").
		Limit(contributedDefaultChunkSize).
		Find(&grants).Error
	if err != nil {
		return 0, err
	}
	recycled := 0
	for i := range grants {
		grant := grants[i]
		result := DB.Model(&ContributedKeyGrant{}).
			Where("id = ? AND settled = ?", grant.Id, false).
			Updates(map[string]any{"settled": true, "updated_time": common.GetTimestamp()})
		if result.Error != nil {
			return recycled, result.Error
		}
		if result.RowsAffected == 0 {
			continue
		}
		if grant.Quota > 0 {
			if err := DecreaseUserQuota(grant.UserId, grant.Quota, true); err != nil {
				common.SysError(fmt.Sprintf("failed to recycle contributed quota: user_id=%d quota=%d err=%v", grant.UserId, grant.Quota, err))
				continue
			}
		}
		recycled++
	}
	return recycled, nil
}

// ListContributedKeyUserIds 返回所有持有有效 Key 的用户，用于定时重算与补发。
func ListContributedKeyUserIds() ([]int, error) {
	var ids []int
	err := DB.Model(&ContributedKey{}).
		Where("status = ? AND enabled = ?", ContributedKeyStatusValid, true).
		Distinct("user_id").
		Pluck("user_id", &ids).Error
	return ids, err
}

// ListKeysNeedingVerification 按最近验证时间排序，取出需要重新验证的 Key。
// 有效与失效的 Key 都会被周期复检：失效的 Key 在上游充值后可以自动恢复。
func ListKeysNeedingVerification(beforeTimestamp int64, limit int) ([]*ContributedKey, error) {
	var keys []*ContributedKey
	err := DB.Where("enabled = ?", true).
		Where("last_verify_time <= ?", beforeTimestamp).
		Order("last_verify_time asc").
		Limit(limit).
		Find(&keys).Error
	return keys, err
}

// CountUserContributedKeys 统计用户累计提交的 Key 数量（含失效），用于限制单人提交数量。
func CountUserContributedKeys(userId int) (int, error) {
	var count int64
	err := DB.Model(&ContributedKey{}).Where("user_id = ?", userId).Count(&count).Error
	return int(count), err
}

// ListValidContributedKeysByProvider 返回某供应商全部可用的贡献 Key。
// 按 id 升序，保证共享号池的 Key 顺序稳定（轮询索引才有意义）。
func ListValidContributedKeysByProvider(provider string) ([]*ContributedKey, error) {
	var keys []*ContributedKey
	err := DB.Where("provider = ? AND status = ? AND enabled = ?", provider, ContributedKeyStatusValid, true).
		Order("id asc").
		Find(&keys).Error
	return keys, err
}

// ListDistinctContributedProviders 返回当前存在有效 Key 的供应商列表。
func ListDistinctContributedProviders() ([]string, error) {
	var providers []string
	err := DB.Model(&ContributedKey{}).
		Where("status = ? AND enabled = ?", ContributedKeyStatusValid, true).
		Distinct("provider").
		Pluck("provider", &providers).Error
	return providers, err
}

// ---------------------------------------------------------------------------
// 共享号池（每个供应商一个多 Key 轮询渠道）
// ---------------------------------------------------------------------------

// GetContributedPoolChannel 按标签查找某个供应商的共享号池渠道，不存在时返回 nil。
func GetContributedPoolChannel(provider string) (*Channel, error) {
	channels, err := GetChannelsByTag(operation_setting.ContributedPoolTag(provider), true, true)
	if err != nil {
		return nil, err
	}
	if len(channels) == 0 {
		return nil, nil
	}
	return channels[0], nil
}

// ContributedPoolSummary 管理端的共享号池概览。
// 暴露渠道编号与内部计数，仅供管理员排障，不下发给普通用户。
type ContributedPoolSummary struct {
	Provider      string `json:"provider"`
	ProviderName  string `json:"provider_name"`
	ChannelId     int    `json:"channel_id"`
	Status        int    `json:"status"`
	KeyCount      int    `json:"key_count"`
	DisabledKeys  int    `json:"disabled_keys"`
	ModelCount    int    `json:"model_count"`
	CircuitBroken bool   `json:"circuit_broken"`
}

// GetContributedPoolSummaries 汇总所有已配置供应商的号池状态。
func GetContributedPoolSummaries() ([]ContributedPoolSummary, error) {
	providers := operation_setting.GetContributedKeyProviders()
	summaries := make([]ContributedPoolSummary, 0, len(providers))
	for _, provider := range providers {
		summary := ContributedPoolSummary{
			Provider:     provider.Key,
			ProviderName: provider.Name,
		}
		validKeys, err := ListValidContributedKeysByProvider(provider.Key)
		if err != nil {
			return nil, err
		}
		summary.KeyCount = len(validKeys)
		pool, err := GetContributedPoolChannel(provider.Key)
		if err != nil {
			return nil, err
		}
		if pool != nil {
			summary.ChannelId = pool.Id
			summary.Status = pool.Status
			summary.ModelCount = len(pool.GetModels())
			summary.DisabledKeys = len(pool.ChannelInfo.MultiKeyStatusList)
			summary.CircuitBroken = len(validKeys) > 0 && pool.Status != common.ChannelStatusEnabled
		}
		summaries = append(summaries, summary)
	}
	return summaries, nil
}

// SaveContributedPoolChannel 静默写入共享号池渠道并刷新调度能力与内存缓存。
//
// 这里刻意不走 Channel.Update / UpdateChannelStatus：那两个入口会向管理员推送
// “渠道已禁用/已启用”通知，而号池里的 Key 会频繁进出，通知会被刷屏。
func SaveContributedPoolChannel(pool *Channel) error {
	if pool.Id > 0 {
		updates := Channel{
			Id:          pool.Id,
			Key:         pool.Key,
			Models:      pool.Models,
			Group:       pool.Group,
			Status:      pool.Status,
			Name:        pool.Name,
			BaseURL:     pool.BaseURL,
			Weight:      pool.Weight,
			Tag:         pool.Tag,
			Remark:      pool.Remark,
			ChannelInfo: pool.ChannelInfo,
		}
		// 用 Select 明确列名，保证零值（例如 Status）也会被写入。
		err := DB.Model(&Channel{}).Where("id = ?", pool.Id).
			Select("key", "models", "group", "status", "name", "base_url", "weight", "tag", "remark", "channel_info").
			Updates(updates).Error
		if err != nil {
			return err
		}
		if err := pool.UpdateAbilities(nil); err != nil {
			return err
		}
	} else {
		if err := pool.Insert(); err != nil {
			return err
		}
	}
	CacheUpdateChannel(pool)
	return nil
}

// ContributedProviderQuota 用户在单个供应商上的贡献额度明细。
// 用于钱包页的「每日额度」卡片：只暴露额度与 Key 数量，不含任何 Key 内容或上游信息。
type ContributedProviderQuota struct {
	Provider     string `json:"provider"`
	ProviderName string `json:"provider_name"`
	ValidCount   int    `json:"valid_count"`
	PendingCount int    `json:"pending_count"`
	InvalidCount int    `json:"invalid_count"`
	CountedUnits int    `json:"counted_units"`
	Quota        int    `json:"quota"`
	RewardQuota  int    `json:"reward_quota"`
	ResetHour    int    `json:"reset_hour"`
}

// GetUserContributionSummary 返回用户端需要的摘要信息。
func GetUserContributionSummary(userId int) (map[string]any, error) {
	setting := operation_setting.GetContributedKeySetting()
	keys, err := GetContributedKeysByUser(userId)
	if err != nil {
		return nil, err
	}

	rewardQuota := QuotaFromContributedAmount(setting.RewardAmount)
	capQuota := QuotaFromContributedAmount(setting.DailyCapAmount)

	validCount := 0
	pendingCount := 0
	invalidCount := 0
	providerOrder := make([]string, 0)
	providerStats := make(map[string]*ContributedProviderQuota)
	for _, key := range keys {
		stat, ok := providerStats[key.Provider]
		if !ok {
			stat = &ContributedProviderQuota{
				Provider:     key.Provider,
				ProviderName: operation_setting.GetContributedKeyProviderName(key.Provider),
				RewardQuota:  rewardQuota,
				ResetHour:    setting.ResetHour,
			}
			providerStats[key.Provider] = stat
			providerOrder = append(providerOrder, key.Provider)
		}
		switch {
		case key.Status == ContributedKeyStatusValid && key.Enabled:
			validCount++
			stat.ValidCount++
		case key.Status == ContributedKeyStatusPending:
			stat.PendingCount++
			pendingCount++
		default:
			stat.InvalidCount++
			if key.Status == ContributedKeyStatusInvalid {
				invalidCount++
			}
		}
	}

	for _, provider := range providerOrder {
		stat := providerStats[provider]
		if stat.ValidCount == 0 {
			continue
		}
		units := stat.ValidCount
		if !setting.RewardPerKey {
			units = 1
		}
		stat.CountedUnits = units
		stat.Quota = units * rewardQuota
	}

	units, err := CountUserValidContributedUnits(userId, setting.RewardPerKey)
	if err != nil {
		return nil, err
	}
	entitlement := units * rewardQuota
	capped := false
	if capQuota > 0 && entitlement > capQuota {
		entitlement = capQuota
		capped = true
	}

	today := ContributedBusinessDate(time.Now())
	grant, err := GetContributedGrant(userId, today)
	if err != nil {
		return nil, err
	}
	grantedQuota := 0
	if grant != nil && !grant.Settled {
		grantedQuota = grant.Quota
	}

	providers := make([]ContributedProviderQuota, 0, len(providerOrder))
	for _, provider := range providerOrder {
		providers = append(providers, *providerStats[provider])
	}

	return map[string]any{
		"valid_count":     validCount,
		"pending_count":   pendingCount,
		"invalid_count":   invalidCount,
		"valid_units":     units,
		"total_count":     len(keys),
		"today_quota":     grantedQuota,
		"entitlement":     entitlement,
		"capped":          capped,
		"today_date":      today,
		"reward_quota":    rewardQuota,
		"daily_cap_quota": capQuota,
		"reset_hour":      setting.ResetHour,
		"max_keys":        setting.MaxKeysPerUser,
		"providers":       providers,
	}, nil
}
