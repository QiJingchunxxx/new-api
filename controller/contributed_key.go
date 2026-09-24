package controller

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const contributedKeyManualBatchLimit = 30

// ---------------------------------------------------------------------------
// 视图
// ---------------------------------------------------------------------------

// contributedKeyAdminPayload 管理端视图：包含排障所需的全部信息。
type contributedKeyAdminPayload struct {
	Id             int      `json:"id"`
	UserId         int      `json:"user_id"`
	Username       string   `json:"username"`
	Provider       string   `json:"provider"`
	ProviderName   string   `json:"provider_name"`
	KeyMasked      string   `json:"key_masked"`
	Status         int      `json:"status"`
	Enabled        bool     `json:"enabled"`
	ReasonCode     string   `json:"reason_code"`
	Message        string   `json:"message"`
	Models         []string `json:"models"`
	VerifyCount    int      `json:"verify_count"`
	LastVerifyTime int64    `json:"last_verify_time"`
	Remark         string   `json:"remark"`
	CreatedTime    int64    `json:"created_time"`
	UpdatedTime    int64    `json:"updated_time"`
}

// buildContributedKeyAdminPayload 组装管理端视图。
func buildContributedKeyAdminPayload(key *model.ContributedKey) contributedKeyAdminPayload {
	return contributedKeyAdminPayload{
		Id:             key.Id,
		UserId:         key.UserId,
		Username:       key.Username,
		Provider:       key.Provider,
		ProviderName:   operation_setting.GetContributedKeyProviderName(key.Provider),
		KeyMasked:      model.MaskContributedKey(key.Key),
		Status:         key.Status,
		Enabled:        key.Enabled,
		ReasonCode:     key.ReasonCode,
		Message:        key.Message,
		Models:         splitContributedModels(key.Models),
		VerifyCount:    key.VerifyCount,
		LastVerifyTime: key.LastVerifyTime,
		Remark:         key.Remark,
		CreatedTime:    key.CreatedTime,
		UpdatedTime:    key.UpdatedTime,
	}
}

// contributedKeyUserPayload 用户端视图。
//
// 只保留用户自己需要的信息：Key 掩码、状态、验证时间。上游报错原文、模型列表、
// 号池渠道编号等内部信息一律不下发，避免暴露上游与共享号池的细节。
type contributedKeyUserPayload struct {
	Id             int    `json:"id"`
	Provider       string `json:"provider"`
	ProviderName   string `json:"provider_name"`
	KeyMasked      string `json:"key_masked"`
	Status         int    `json:"status"`
	Enabled        bool   `json:"enabled"`
	ReasonCode     string `json:"reason_code"`
	VerifyCount    int    `json:"verify_count"`
	LastVerifyTime int64  `json:"last_verify_time"`
	Remark         string `json:"remark"`
	CreatedTime    int64  `json:"created_time"`
	UpdatedTime    int64  `json:"updated_time"`
}

func buildContributedKeyUserPayload(key *model.ContributedKey) contributedKeyUserPayload {
	return contributedKeyUserPayload{
		Id:             key.Id,
		Provider:       key.Provider,
		ProviderName:   operation_setting.GetContributedKeyProviderName(key.Provider),
		KeyMasked:      model.MaskContributedKey(key.Key),
		Status:         key.Status,
		Enabled:        key.Enabled,
		ReasonCode:     key.ReasonCode,
		VerifyCount:    key.VerifyCount,
		LastVerifyTime: key.LastVerifyTime,
		Remark:         key.Remark,
		CreatedTime:    key.CreatedTime,
		UpdatedTime:    key.UpdatedTime,
	}
}

func splitContributedModels(raw string) []string {
	models := make([]string, 0)
	for _, item := range strings.Split(raw, ",") {
		if trimmed := strings.TrimSpace(item); trimmed != "" {
			models = append(models, trimmed)
		}
	}
	return models
}

func contributedKeySettingPayload() gin.H {
	setting := operation_setting.GetContributedKeySetting()
	operation_setting.NormalizeContributedKeySetting()
	return gin.H{
		"reward_amount":       setting.RewardAmount,
		"reward_quota":        model.QuotaFromContributedAmount(setting.RewardAmount),
		"daily_cap_amount":    setting.DailyCapAmount,
		"daily_cap_quota":     model.QuotaFromContributedAmount(setting.DailyCapAmount),
		"reward_per_key":      setting.RewardPerKey,
		"reset_hour":          setting.ResetHour,
		"verify_interval_min": setting.VerifyIntervalMin,
		"auto_create_channel": setting.AutoCreateChannel,
		"channel_group":       setting.ChannelGroup,
		"max_keys_per_user":   setting.MaxKeysPerUser,
	}
}

// ---------------------------------------------------------------------------
// 用户端
// ---------------------------------------------------------------------------

// GetSelfContributedKeys 获取当前用户的贡献 Key、额度摘要与可选供应商。
func GetSelfContributedKeys(c *gin.Context) {
	userId := c.GetInt("id")
	setting := operation_setting.GetContributedKeySetting()
	operation_setting.NormalizeContributedKeySetting()

	summary, err := model.GetUserContributionSummary(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	keys, err := model.GetContributedKeysByUser(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]contributedKeyUserPayload, 0, len(keys))
	for _, key := range keys {
		items = append(items, buildContributedKeyUserPayload(key))
	}
	providers := make([]gin.H, 0)
	for _, provider := range operation_setting.GetContributedKeyProviders() {
		if !provider.Enabled {
			continue
		}
		// 只下发展示名与取 Key 的入口：上游地址属于站点内部配置，不对用户暴露。
		providers = append(providers, gin.H{
			"key":      provider.Key,
			"name":     provider.Name,
			"docs_url": provider.DocsURL,
		})
	}
	common.ApiSuccess(c, gin.H{
		"enabled":   setting.Enabled,
		"setting":   contributedKeySettingPayload(),
		"providers": providers,
		"keys":      items,
		"summary":   summary,
	})
}

type addContributedKeyRequest struct {
	Provider string `json:"provider"`
	Key      string `json:"key"`
	Remark   string `json:"remark"`
}

// AddSelfContributedKey 提交一个上游 Key：立即验证，通过后发放额度并加入共享号池。
func AddSelfContributedKey(c *gin.Context) {
	setting := operation_setting.GetContributedKeySetting()
	operation_setting.NormalizeContributedKeySetting()
	if !setting.Enabled {
		common.ApiErrorMsg(c, "贡献上游 Key 功能未启用")
		return
	}
	var req addContributedKeyRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "请求参数格式错误")
		return
	}
	providerKey := strings.TrimSpace(req.Provider)
	keyValue := strings.TrimSpace(req.Key)
	if keyValue == "" {
		common.ApiErrorMsg(c, "请填写上游 Key")
		return
	}
	provider, ok := operation_setting.GetContributedKeyProvider(providerKey)
	if !ok || !provider.Enabled {
		common.ApiErrorMsg(c, "该供应商暂不支持贡献")
		return
	}

	userId := c.GetInt("id")
	if setting.MaxKeysPerUser > 0 {
		count, err := model.CountUserContributedKeys(userId)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if count >= setting.MaxKeysPerUser {
			common.ApiErrorMsg(c, fmt.Sprintf("最多只能贡献 %d 个 Key", setting.MaxKeysPerUser))
			return
		}
	}

	keyHash := model.HashContributedKey(keyValue)
	existing, err := model.GetContributedKeyByProviderAndHash(providerKey, keyHash)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiError(c, err)
		return
	}
	if existing != nil {
		if existing.UserId == userId {
			common.ApiErrorMsg(c, "该 Key 已提交过，无需重复提交")
		} else {
			common.ApiErrorMsg(c, "该 Key 已被提交过")
		}
		return
	}

	contributed := &model.ContributedKey{
		UserId:   userId,
		Username: c.GetString("username"),
		Provider: providerKey,
		Key:      keyValue,
		Status:   model.ContributedKeyStatusPending,
		Enabled:  true,
		Remark:   strings.TrimSpace(req.Remark),
	}
	if err := model.CreateContributedKey(contributed); err != nil {
		if model.IsDuplicateContributedKeyError(err) {
			common.ApiErrorMsg(c, "该 Key 已提交过，无需重复提交")
			return
		}
		common.ApiError(c, err)
		return
	}

	valid := service.VerifyContributedKey(context.Background(), contributed)
	service.SyncContributedPool(context.Background(), providerKey)
	granted, err := model.RecalcUserContributionQuota(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if valid {
		model.RecordLog(userId, model.LogTypeSystem, fmt.Sprintf("贡献上游 Key（%s）验证通过，今日贡献额度 %s", provider.Name, logger.LogQuota(granted)))
	}
	common.ApiSuccess(c, gin.H{
		"valid":        valid,
		"reason_code":  contributed.ReasonCode,
		"key":          buildContributedKeyUserPayload(contributed),
		"today_quota":  granted,
		"reward_quota": model.QuotaFromContributedAmount(setting.RewardAmount),
	})
}

func loadOwnContributedKey(c *gin.Context) (*model.ContributedKey, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的 Key 编号")
		return nil, false
	}
	contributed, err := model.GetContributedKeyById(id)
	if err != nil {
		common.ApiErrorMsg(c, "Key 记录不存在")
		return nil, false
	}
	if contributed.UserId != c.GetInt("id") {
		common.ApiErrorMsg(c, "无权操作该 Key")
		return nil, false
	}
	return contributed, true
}

// DeleteSelfContributedKey 删除自己贡献的 Key，并回收对应额度与号池中的 Key。
func DeleteSelfContributedKey(c *gin.Context) {
	contributed, ok := loadOwnContributedKey(c)
	if !ok {
		return
	}
	if err := model.DeleteContributedKey(contributed.Id); err != nil {
		common.ApiError(c, err)
		return
	}
	service.SyncContributedPool(context.Background(), contributed.Provider)
	granted, err := model.RecalcUserContributionQuota(contributed.UserId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"today_quota": granted})
}

// VerifySelfContributedKey 重新验证自己贡献的 Key。
func VerifySelfContributedKey(c *gin.Context) {
	contributed, ok := loadOwnContributedKey(c)
	if !ok {
		return
	}
	valid := service.VerifyContributedKey(context.Background(), contributed)
	service.SyncContributedPool(context.Background(), contributed.Provider)
	granted, err := model.RecalcUserContributionQuota(contributed.UserId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"valid":       valid,
		"reason_code": contributed.ReasonCode,
		"key":         buildContributedKeyUserPayload(contributed),
		"today_quota": granted,
	})
}

// ---------------------------------------------------------------------------
// 管理端
// ---------------------------------------------------------------------------

// GetAllContributedKeys 分页查询全部贡献的 Key。
func GetAllContributedKeys(c *gin.Context) {
	userId, _ := strconv.Atoi(c.Query("user_id"))
	pageInfo := common.GetPageQuery(c)
	keys, total, err := model.GetContributedKeys(model.ContributedKeyQuery{
		UserId:   userId,
		Provider: strings.TrimSpace(c.Query("provider")),
		Status:   strings.TrimSpace(c.Query("status")),
		Keyword:  strings.TrimSpace(c.Query("keyword")),
		Offset:   pageInfo.GetStartIdx(),
		Limit:    pageInfo.GetPageSize(),
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]contributedKeyAdminPayload, 0, len(keys))
	for _, key := range keys {
		items = append(items, buildContributedKeyAdminPayload(key))
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

// GetContributedKeyStats 管理端统计概览。
func GetContributedKeyStats(c *gin.Context) {
	stats, err := model.GetContributedKeyStats()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	stats["setting"] = contributedKeySettingPayload()
	// 失败重试次数决定号池能否在被调用的 Key 出错时立刻换一把：为 0 时不会重试，
	// 用户就会直接看到错误，因此这里下发给管理端做提示与一键修正。
	stats["retry_times"] = common.RetryTimes
	pools, err := model.GetContributedPoolSummaries()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	stats["pools"] = pools
	common.ApiSuccess(c, stats)
}

type verifyContributedKeysRequest struct {
	Ids []int `json:"ids"`
}

// VerifyContributedKeys 批量（或全量前 N 条）验证贡献的 Key。
func VerifyContributedKeys(c *gin.Context) {
	var req verifyContributedKeysRequest
	// 允许空 body：空 body 表示验证最近的一批 Key。
	_ = common.DecodeJson(c.Request.Body, &req)
	targets := make([]*model.ContributedKey, 0, len(req.Ids))
	if len(req.Ids) > 0 {
		if len(req.Ids) > contributedKeyManualBatchLimit {
			common.ApiErrorMsg(c, fmt.Sprintf("单次最多验证 %d 个 Key", contributedKeyManualBatchLimit))
			return
		}
		for _, id := range req.Ids {
			key, err := model.GetContributedKeyById(id)
			if err != nil {
				continue
			}
			targets = append(targets, key)
		}
	} else {
		keys, _, err := model.GetContributedKeys(model.ContributedKeyQuery{
			Limit: contributedKeyManualBatchLimit,
		})
		if err != nil {
			common.ApiError(c, err)
			return
		}
		targets = append(targets, keys...)
	}
	if len(targets) == 0 {
		common.ApiSuccess(c, gin.H{"total": 0, "valid": 0})
		return
	}
	providers := make([]string, 0, len(targets))
	for _, item := range targets {
		providers = append(providers, item.Provider)
	}
	validCount := service.VerifyContributedKeysConcurrently(context.Background(), targets)
	service.SyncContributedPools(context.Background(), providers, true)
	common.ApiSuccess(c, gin.H{"total": len(targets), "valid": validCount})
}

type updateContributedKeyRequest struct {
	Enabled *bool   `json:"enabled"`
	Status  *int    `json:"status"`
	Remark  *string `json:"remark"`
}

// UpdateContributedKey 管理端调整贡献的 Key（启停 / 强制状态 / 备注）。
func UpdateContributedKey(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的 Key 编号")
		return
	}
	var req updateContributedKeyRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "请求参数格式错误")
		return
	}
	contributed, err := model.GetContributedKeyById(id)
	if err != nil {
		common.ApiErrorMsg(c, "Key 记录不存在")
		return
	}
	if req.Enabled != nil {
		contributed.Enabled = *req.Enabled
	}
	if req.Remark != nil {
		contributed.Remark = strings.TrimSpace(*req.Remark)
	}
	if req.Status != nil {
		switch *req.Status {
		case model.ContributedKeyStatusPending, model.ContributedKeyStatusValid, model.ContributedKeyStatusInvalid:
			contributed.Status = *req.Status
		default:
			common.ApiErrorMsg(c, "无效的状态值")
			return
		}
	}
	if err := model.UpdateContributedKey(contributed); err != nil {
		common.ApiError(c, err)
		return
	}
	service.SyncContributedPool(context.Background(), contributed.Provider)
	granted, err := model.RecalcUserContributionQuota(contributed.UserId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"key":         buildContributedKeyAdminPayload(contributed),
		"today_quota": granted,
	})
}

// DeleteContributedKey 管理端删除贡献的 Key。
func DeleteContributedKey(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的 Key 编号")
		return
	}
	contributed, err := model.GetContributedKeyById(id)
	if err != nil {
		common.ApiErrorMsg(c, "Key 记录不存在")
		return
	}
	if err := model.DeleteContributedKey(contributed.Id); err != nil {
		common.ApiError(c, err)
		return
	}
	service.SyncContributedPool(context.Background(), contributed.Provider)
	granted, err := model.RecalcUserContributionQuota(contributed.UserId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"today_quota": granted})
}

// RecalculateContributedQuota 依据当前有效 Key 重算所有用户的贡献额度。
func RecalculateContributedQuota(c *gin.Context) {
	userIds, err := model.ListContributedKeyUserIds()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	total := 0
	for _, userId := range userIds {
		granted, err := model.RecalcUserContributionQuota(userId)
		if err != nil {
			continue
		}
		total += granted
	}
	providers, err := model.ListDistinctContributedProviders()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	service.SyncContributedPools(context.Background(), providers, true)
	common.ApiSuccess(c, gin.H{"users": len(userIds), "total_quota": total})
}
