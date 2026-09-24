package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/bytedance/gopkg/util/gopool"
)

const (
	contributedKeyHTTPTimeout   = 15 * time.Second
	contributedKeyMaxModels     = 200
	contributedKeyMaxBodyBytes  = 512 * 1024
	contributedKeyErrorSnippet  = 200
	contributedKeyVerifyWorkers = 5
	contributedPoolMaxModels    = 500
)

var contributedKeyHTTPClient = &http.Client{Timeout: contributedKeyHTTPTimeout}

// upstreamModelsResponse OpenAI 兼容协议 GET /models 的响应体。
type upstreamModelsResponse struct {
	Data []struct {
		Id string `json:"id"`
	} `json:"data"`
}

// upstreamErrorResponse 上游返回的部分错误结构，用于给出更友好的提示。
type upstreamErrorResponse struct {
	Error struct {
		Message string `json:"message"`
	} `json:"error"`
	Message string `json:"message"`
}

func contributedEndpointURL(provider operation_setting.ContributedKeyProvider, endpoint, fallback string) string {
	base := strings.TrimSuffix(strings.TrimSpace(provider.BaseURL), "/")
	if base == "" {
		return ""
	}
	path := strings.TrimSpace(endpoint)
	if path == "" {
		path = fallback
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	return base + path
}

// contributedVerifyError 带分类码的验证错误。
// 分类码会下发到用户端（只说"哪一类问题"），原始文案只留给管理端。
type contributedVerifyError struct {
	code    string
	message string
}

func (e *contributedVerifyError) Error() string {
	return e.message
}

func newContributedVerifyError(code, message string) error {
	return &contributedVerifyError{code: code, message: message}
}

// contributedReasonCode 从错误中提取分类码，识别不到时归为 unknown。
func contributedReasonCode(err error) string {
	var verifyErr *contributedVerifyError
	if errors.As(err, &verifyErr) && verifyErr.code != "" {
		return verifyErr.code
	}
	return model.ContributedReasonUnknown
}

// classifyContributedHTTPStatus 把上游 HTTP 状态码映射成对用户友好的分类。
func classifyContributedHTTPStatus(statusCode int) string {
	switch {
	case statusCode == http.StatusUnauthorized || statusCode == http.StatusForbidden:
		return model.ContributedReasonAuth
	case statusCode == http.StatusPaymentRequired || statusCode == http.StatusTooManyRequests:
		return model.ContributedReasonQuota
	case statusCode >= 500:
		return model.ContributedReasonUpstream
	default:
		return model.ContributedReasonUnknown
	}
}

func readContributedSnippet(body io.Reader) string {
	data, err := io.ReadAll(io.LimitReader(body, contributedKeyMaxBodyBytes))
	if err != nil || len(data) == 0 {
		return ""
	}
	var parsed upstreamErrorResponse
	if err := common.Unmarshal(data, &parsed); err == nil {
		if parsed.Error.Message != "" {
			return parsed.Error.Message
		}
		if parsed.Message != "" {
			return parsed.Message
		}
	}
	text := strings.TrimSpace(string(data))
	if len(text) > contributedKeyErrorSnippet {
		text = text[:contributedKeyErrorSnippet]
	}
	return text
}

// fetchContributedKeyModels 向上游请求模型列表，成功即认为 Key 可用。
func fetchContributedKeyModels(ctx context.Context, provider operation_setting.ContributedKeyProvider, key string) ([]string, error) {
	url := contributedEndpointURL(provider, provider.ModelsEndpoint, "/models")
	if url == "" {
		return nil, newContributedVerifyError(model.ContributedReasonConfig, "该供应商未配置上游地址，请联系管理员")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, newContributedVerifyError(model.ContributedReasonUnknown, err.Error())
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Accept", "application/json")
	resp, err := contributedKeyHTTPClient.Do(req)
	if err != nil {
		return nil, newContributedVerifyError(model.ContributedReasonNetwork, "网络异常，稍后会自动重试")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		snippet := readContributedSnippet(resp.Body)
		if snippet == "" {
			snippet = http.StatusText(resp.StatusCode)
		}
		return nil, newContributedVerifyError(
			classifyContributedHTTPStatus(resp.StatusCode),
			fmt.Sprintf("上游返回 %d：%s", resp.StatusCode, snippet),
		)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, contributedKeyMaxBodyBytes))
	if err != nil {
		return nil, newContributedVerifyError(model.ContributedReasonNetwork, "读取上游响应失败")
	}
	var parsed upstreamModelsResponse
	if err := common.Unmarshal(body, &parsed); err != nil {
		return nil, newContributedVerifyError(model.ContributedReasonFormat, "上游响应格式无法解析")
	}
	models := make([]string, 0, len(parsed.Data))
	seen := make(map[string]struct{}, len(parsed.Data))
	for _, item := range parsed.Data {
		modelId := strings.TrimSpace(item.Id)
		if modelId == "" {
			continue
		}
		if _, ok := seen[modelId]; ok {
			continue
		}
		seen[modelId] = struct{}{}
		models = append(models, modelId)
		if len(models) >= contributedKeyMaxModels {
			break
		}
	}
	return models, nil
}

// probeContributedKeyChat 可选的一轮最小对话探测，用于确认 Key 真正可以出模型。
func probeContributedKeyChat(ctx context.Context, provider operation_setting.ContributedKeyProvider, key string) error {
	modelName := strings.TrimSpace(provider.VerifyModel)
	url := contributedEndpointURL(provider, provider.ChatEndpoint, "/chat/completions")
	if modelName == "" || url == "" {
		return nil
	}
	payload := map[string]any{
		"model":      modelName,
		"messages":   []map[string]string{{"role": "user", "content": "ping"}},
		"max_tokens": 1,
		"stream":     false,
	}
	body, err := common.Marshal(payload)
	if err != nil {
		return newContributedVerifyError(model.ContributedReasonUnknown, err.Error())
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return newContributedVerifyError(model.ContributedReasonUnknown, err.Error())
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")
	resp, err := contributedKeyHTTPClient.Do(req)
	if err != nil {
		return newContributedVerifyError(model.ContributedReasonNetwork, "网络异常，稍后会自动重试")
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		snippet := readContributedSnippet(resp.Body)
		if snippet == "" {
			snippet = http.StatusText(resp.StatusCode)
		}
		return newContributedVerifyError(
			classifyContributedHTTPStatus(resp.StatusCode),
			fmt.Sprintf("探测失败（%d）：%s", resp.StatusCode, snippet),
		)
	}
	return nil
}

// VerifyContributedKey 校验贡献的 Key 并落库，同时按结果重算贡献者当天的额度。
//
// 只负责“这个 Key 现在到底能不能用”：号池的增删由调用方在批量结束后统一同步，
// 避免一次批量验证里反复重建同一个号池。
func VerifyContributedKey(ctx context.Context, contributed *model.ContributedKey) bool {
	if contributed == nil {
		return false
	}
	provider, ok := operation_setting.GetContributedKeyProvider(contributed.Provider)

	message := ""
	reasonCode := model.ContributedReasonUnknown
	status := model.ContributedKeyStatusInvalid
	var models []string

	switch {
	case !ok:
		message = "未知的上游供应商"
		reasonCode = model.ContributedReasonConfig
	case !provider.Enabled:
		message = "该供应商当前不支持贡献"
		reasonCode = model.ContributedReasonConfig
	default:
		fetched, err := fetchContributedKeyModels(ctx, provider, contributed.Key)
		if err != nil {
			message = err.Error()
			reasonCode = contributedReasonCode(err)
		} else if err := probeContributedKeyChat(ctx, provider, contributed.Key); err != nil {
			message = err.Error()
			reasonCode = contributedReasonCode(err)
		} else {
			models = fetched
			status = model.ContributedKeyStatusValid
			reasonCode = model.ContributedReasonNone
			message = "验证通过"
		}
	}

	modelsStr := strings.Join(models, ",")
	contributed.Status = status
	contributed.Message = message
	contributed.ReasonCode = reasonCode
	contributed.Models = modelsStr
	contributed.VerifyCount++
	if err := model.UpdateContributedKeyVerification(contributed.Id, status, reasonCode, message, modelsStr, contributed.VerifyCount); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("failed to update contributed key %d verification result: %v", contributed.Id, err))
	}
	if _, err := model.RecalcUserContributionQuota(contributed.UserId); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("failed to recalculate contributed quota for user %d: %v", contributed.UserId, err))
	}
	return status == model.ContributedKeyStatusValid
}

// VerifyContributedKeysConcurrently 并发校验一批贡献的 Key，返回校验通过的数量。
// 单个 Key 的失败不会中断整批任务。
func VerifyContributedKeysConcurrently(ctx context.Context, keys []*model.ContributedKey) int {
	if len(keys) == 0 {
		return 0
	}
	sem := make(chan struct{}, contributedKeyVerifyWorkers)
	var wg sync.WaitGroup
	var validCount atomic.Int64
	for _, item := range keys {
		contributed := item
		sem <- struct{}{}
		wg.Add(1)
		gopool.Go(func() {
			defer func() {
				if r := recover(); r != nil {
					logger.LogWarn(ctx, fmt.Sprintf("contributed key verification panic: key_id=%d err=%v", contributed.Id, r))
				}
				<-sem
				wg.Done()
			}()
			if VerifyContributedKey(ctx, contributed) {
				validCount.Add(1)
			}
		})
	}
	wg.Wait()
	return int(validCount.Load())
}

// SyncContributedPool 依据当前可用 Key 重建某个供应商的共享号池渠道。
// heal=true 表示这次同步来自定时复检，可以顺带把请求链路临时禁用的 Key 放回池子。
func SyncContributedPool(ctx context.Context, providerKey string) {
	SyncContributedPools(ctx, []string{providerKey}, false)
}

// SyncContributedPools 批量同步多个供应商的共享号池，最后统一刷新一次渠道缓存。
func SyncContributedPools(ctx context.Context, providerKeys []string, heal bool) {
	if len(providerKeys) == 0 {
		return
	}
	changed := 0
	seen := make(map[string]struct{}, len(providerKeys))
	for _, providerKey := range providerKeys {
		trimmed := strings.TrimSpace(providerKey)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		touched, err := syncContributedPool(trimmed, heal)
		if err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("failed to sync contributed pool for %s: %v", trimmed, err))
			continue
		}
		if touched {
			changed++
		}
	}
	if changed > 0 {
		// 号池变化必须立刻生效，否则用户贡献的 Key 要等到下一次渠道缓存同步才可用。
		model.InitChannelCache()
	}
}

// syncContributedPool 重建单个供应商的号池，返回是否有实际变更。
//
// 号池使用多 Key 轮询模式：请求按顺序轮询池内 Key，某个 Key 出错时网关会只把该 Key
// 标记禁用并立即换用下一个（对调用方完全无感）；所有 Key 都失效才会停用整个号池。
func syncContributedPool(providerKey string, heal bool) (bool, error) {
	setting := operation_setting.GetContributedKeySetting()
	operation_setting.NormalizeContributedKeySetting()
	if !setting.AutoCreateChannel {
		return false, nil
	}
	provider, ok := operation_setting.GetContributedKeyProvider(providerKey)
	if !ok {
		return false, nil
	}
	baseURL := strings.TrimSuffix(strings.TrimSpace(provider.BaseURL), "/")
	if baseURL == "" {
		return false, nil
	}

	keys, err := model.ListValidContributedKeysByProvider(providerKey)
	if err != nil {
		return false, err
	}
	pool, err := model.GetContributedPoolChannel(providerKey)
	if err != nil {
		return false, err
	}

	keyList, modelsStr := buildContributedPoolContent(keys, provider)
	if len(keyList) == 0 || modelsStr == "" {
		// 池子里没有可用 Key：静默停用号池，不再把请求调度过来。
		if pool == nil || pool.Status != common.ChannelStatusEnabled {
			return false, nil
		}
		pool.Key = ""
		pool.Status = common.ChannelStatusAutoDisabled
		pool.ChannelInfo = model.ChannelInfo{
			IsMultiKey:   true,
			MultiKeyMode: constant.MultiKeyModePolling,
			MultiKeySize: 0,
		}
		if err := model.SaveContributedPoolChannel(pool); err != nil {
			return false, err
		}
		return true, nil
	}

	group := strings.TrimSpace(setting.ChannelGroup)
	if group == "" {
		group = "default"
	}
	weight := uint(setting.ChannelWeight)
	autoBan := 1 // 开启自动禁用：某个 Key 出错时只会禁用该 Key，由网关自动切到下一个
	remark := "共享号池：由用户贡献的上游 Key 汇聚而成，请勿手工改 Key"
	tag := operation_setting.ContributedPoolTag(providerKey)
	name := fmt.Sprintf("[共享号池] %s", provider.Name)

	newKeyStr := strings.Join(keyList, "\n")
	if pool == nil {
		pool = &model.Channel{
			Type:        provider.ChannelType,
			CreatedTime: common.GetTimestamp(),
			BaseURL:     &baseURL,
		}
	}
	touched := pool.Id == 0 ||
		pool.Key != newKeyStr ||
		pool.Models != modelsStr ||
		pool.Status != common.ChannelStatusEnabled

	info := pool.ChannelInfo
	if pool.Key != newKeyStr {
		// Key 列表变了，索引已经错位，旧的禁用记录必须整体丢弃。
		info.MultiKeyStatusList = nil
		info.MultiKeyDisabledReason = nil
		info.MultiKeyDisabledTime = nil
		info.MultiKeyPollingIndex = 0
	} else if heal && len(info.MultiKeyStatusList) > 0 {
		// 复检结果才是权威：池内还留着的 Key 当前可用，把请求链路临时禁用的记录清掉。
		info.MultiKeyStatusList = nil
		info.MultiKeyDisabledReason = nil
		info.MultiKeyDisabledTime = nil
	}
	info.IsMultiKey = true
	info.MultiKeyMode = constant.MultiKeyModePolling
	info.MultiKeySize = len(keyList)
	if info.MultiKeyPollingIndex < 0 || info.MultiKeyPollingIndex >= len(keyList) {
		info.MultiKeyPollingIndex = 0
	}

	pool.Key = newKeyStr
	pool.Models = modelsStr
	pool.Status = common.ChannelStatusEnabled
	pool.BaseURL = &baseURL
	pool.Group = group
	pool.Name = name
	pool.Weight = &weight
	pool.AutoBan = &autoBan
	pool.Remark = &remark
	pool.Tag = &tag
	pool.ChannelInfo = info

	if err := model.SaveContributedPoolChannel(pool); err != nil {
		return false, err
	}
	return touched, nil
}

// buildContributedPoolContent 汇总可用 Key 与模型并集。
func buildContributedPoolContent(keys []*model.ContributedKey, provider operation_setting.ContributedKeyProvider) ([]string, string) {
	keyList := make([]string, 0, len(keys))
	seenKeys := make(map[string]struct{}, len(keys))
	modelSet := make(map[string]struct{})
	for _, key := range keys {
		trimmed := strings.TrimSpace(key.Key)
		if trimmed == "" {
			continue
		}
		if _, ok := seenKeys[trimmed]; ok {
			continue
		}
		seenKeys[trimmed] = struct{}{}
		keyList = append(keyList, trimmed)
		for _, item := range strings.Split(key.Models, ",") {
			if name := strings.TrimSpace(item); name != "" {
				modelSet[name] = struct{}{}
			}
		}
	}
	modelList := make([]string, 0, len(modelSet))
	for name := range modelSet {
		modelList = append(modelList, name)
	}
	sort.Strings(modelList)
	if len(modelList) > contributedPoolMaxModels {
		modelList = modelList[:contributedPoolMaxModels]
	}
	modelsStr := strings.Join(modelList, ",")
	if modelsStr == "" {
		modelsStr = strings.TrimSpace(provider.Models)
	}
	return keyList, modelsStr
}
