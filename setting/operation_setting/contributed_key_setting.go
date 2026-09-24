package operation_setting

import (
	"encoding/json"
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

// ContributedKeyProvider 描述一个允许用户贡献上游 Key 的供应商。
//
// 用户端只需要填写 Key，API 地址由后台统一维护，避免用户填错。
type ContributedKeyProvider struct {
	Key            string `json:"key"`             // 唯一标识，例如 sensenova
	Name           string `json:"name"`            // 展示名称
	BaseURL        string `json:"base_url"`        // 上游 API 地址，例如 https://token.sensenova.cn/v1
	Models         string `json:"models"`          // 兜底模型列表（逗号分隔），验证成功后可被上游返回的列表覆盖
	VerifyModel    string `json:"verify_model"`    // 非空时额外发起一次 1 token 的对话探测
	ChannelType    int    `json:"channel_type"`    // 自动创建渠道时使用的渠道类型
	Description    string `json:"description"`     // 用户端展示说明
	ModelsEndpoint string `json:"models_endpoint"` // 验证地址，默认 /models
	ChatEndpoint   string `json:"chat_endpoint"`   // 对话探测地址，默认 /chat/completions
	DocsURL        string `json:"docs_url"`        // Key 获取地址，用户端展示
	Enabled        bool   `json:"enabled"`         // 是否允许用户贡献该供应商的 Key
}

// ContributedKeySetting 贡献上游 Key 功能配置
type ContributedKeySetting struct {
	Enabled           bool    `json:"enabled"`             // 是否启用
	RewardAmount      float64 `json:"reward_amount"`       // 每个有效 Key 每天奖励（美元）
	DailyCapAmount    float64 `json:"daily_cap_amount"`    // 每个用户每天奖励上限（美元），<=0 表示不限制
	RewardPerKey      bool    `json:"reward_per_key"`      // true=按 Key 数量累计，false=按不同供应商去重累计
	ResetHour         int     `json:"reset_hour"`          // 每日额度重置时间（0-23 时，本地时区）
	VerifyIntervalMin int     `json:"verify_interval_min"` // 定时验证周期（分钟）
	AutoCreateChannel bool    `json:"auto_create_channel"` // 验证成功后将 Key 加入共享号池
	ChannelGroup      string  `json:"channel_group"`       // 共享号池所属分组
	ChannelWeight     int     `json:"channel_weight"`      // 共享号池权重
	ChannelTag        string  `json:"channel_tag"`         // 共享号池标签前缀，最终标签为 <前缀>:<供应商>
	MaxKeysPerUser    int     `json:"max_keys_per_user"`   // 单用户最多可贡献的 Key 数量，<=0 表示不限制
	Providers         string  `json:"providers"`           // 供应商列表 JSON
}

var contributedKeySetting = ContributedKeySetting{
	Enabled:           false,
	RewardAmount:      20,
	DailyCapAmount:    40,
	RewardPerKey:      true,
	ResetHour:         0,
	VerifyIntervalMin: 60,
	AutoCreateChannel: true,
	ChannelGroup:      "default",
	ChannelWeight:     1,
	ChannelTag:        ContributedPoolTagPrefix,
	MaxKeysPerUser:    10,
}

// ContributedPoolTagPrefix 共享号池渠道的默认标签前缀。
// 同一供应商的所有贡献 Key 汇聚成一个多 Key 轮询渠道，标签为 <前缀>:<供应商标识>。
const ContributedPoolTagPrefix = "contributed-pool"

// ContributedPoolTag 返回某个供应商共享号池渠道使用的标签。
func ContributedPoolTag(providerKey string) string {
	prefix := strings.TrimSpace(contributedKeySetting.ChannelTag)
	if prefix == "" {
		prefix = ContributedPoolTagPrefix
	}
	return prefix + ":" + providerKey
}

func init() {
	contributedKeySetting.Providers = defaultContributedKeyProvidersJSON()
	config.GlobalConfig.Register("contributed_key_setting", &contributedKeySetting)
}

// GetContributedKeySetting 获取贡献上游 Key 配置
func GetContributedKeySetting() *ContributedKeySetting {
	return &contributedKeySetting
}

// IsContributedKeyEnabled 是否启用贡献上游 Key 功能
func IsContributedKeyEnabled() bool {
	return contributedKeySetting.Enabled
}

// DefaultContributedKeyProviders 内置供应商列表。
func DefaultContributedKeyProviders() []ContributedKeyProvider {
	return []ContributedKeyProvider{
		{
			Key:            "sensenova",
			Name:           "商汤 SenseNova",
			BaseURL:        "https://token.sensenova.cn/v1", // 上游 API 地址（仅供服务端调用）
			VerifyModel:    "",
			DocsURL:        "https://www.sensenova.cn/", // 用户获取 Key 的入口（官网，不是 API 端点）
			ChannelType:    1, // OpenAI 兼容协议
			Enabled:        true,
			ModelsEndpoint: "/models",
			ChatEndpoint:   "/chat/completions",
			Description:    "user only needs to paste the key, the API address is maintained by the site",
		},
		{
			Key:            "openai-compatible",
			Name:           "OpenAI Compatible",
			BaseURL:        "",
			ChannelType:    1,
			Enabled:        false,
			ModelsEndpoint: "/models",
			ChatEndpoint:   "/chat/completions",
			Description:    "any OpenAI compatible upstream; fill base url in admin settings first",
		},
	}
}

// defaultContributedKeyProvidersJSON 序列化内置供应商列表，作为配置默认值。
func defaultContributedKeyProvidersJSON() string {
	data, err := json.Marshal(DefaultContributedKeyProviders())
	if err != nil {
		return "[]"
	}
	return string(data)
}

// contributedLegacyDocsURLs 早期版本把上游 API 端点误当成了「获取 Key 的入口」下发给用户。
// 命中这些旧值时直接返回官网，管理员不需要再去后台改一遍 JSON。
var contributedLegacyDocsURLs = map[string]string{
	"https://token.sensenova.cn":    "https://www.sensenova.cn/",
	"https://token.sensenova.cn/":   "https://www.sensenova.cn/",
	"https://token.sensenova.cn/v1": "https://www.sensenova.cn/",
}

// GetContributedKeyProviders 解析当前供应商配置，解析失败时回退到内置列表。
func GetContributedKeyProviders() []ContributedKeyProvider {
	raw := strings.TrimSpace(contributedKeySetting.Providers)
	if raw == "" {
		return DefaultContributedKeyProviders()
	}
	var providers []ContributedKeyProvider
	if err := json.Unmarshal([]byte(raw), &providers); err != nil || len(providers) == 0 {
		return DefaultContributedKeyProviders()
	}
	for i := range providers {
		if fixed, ok := contributedLegacyDocsURLs[strings.TrimSpace(providers[i].DocsURL)]; ok {
			providers[i].DocsURL = fixed
		}
	}
	return providers
}

// GetContributedKeyProvider 按标识查找供应商。
func GetContributedKeyProvider(key string) (ContributedKeyProvider, bool) {
	for _, provider := range GetContributedKeyProviders() {
		if provider.Key == key {
			return provider, true
		}
	}
	return ContributedKeyProvider{}, false
}

// GetContributedKeyProviderName 返回供应商展示名，找不到时回退为标识本身。
func GetContributedKeyProviderName(key string) string {
	if provider, ok := GetContributedKeyProvider(key); ok && provider.Name != "" {
		return provider.Name
	}
	return key
}

// NormalizeContributedKeySetting 修正运行期可能出现的越界配置。
func NormalizeContributedKeySetting() {
	if contributedKeySetting.ResetHour < 0 || contributedKeySetting.ResetHour > 23 {
		contributedKeySetting.ResetHour = 0
	}
	if contributedKeySetting.VerifyIntervalMin <= 0 {
		contributedKeySetting.VerifyIntervalMin = 60
	}
	if strings.TrimSpace(contributedKeySetting.ChannelGroup) == "" {
		contributedKeySetting.ChannelGroup = "default"
	}
	if contributedKeySetting.RewardAmount < 0 {
		contributedKeySetting.RewardAmount = 0
	}
	if contributedKeySetting.DailyCapAmount < 0 {
		contributedKeySetting.DailyCapAmount = 0
	}
}
