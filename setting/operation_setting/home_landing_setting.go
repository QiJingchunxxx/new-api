package operation_setting

import (
	"encoding/json"
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

// HomeLandingStatItem 落地页数据条的一项。
// Value 为空时前端使用站点的实时数据。
type HomeLandingStatItem struct {
	Label  string `json:"label"`
	Value  string `json:"value"`
	Suffix string `json:"suffix"`
}

// HomeLandingFaqItem 落地页常见问题。
type HomeLandingFaqItem struct {
	Question string `json:"question"`
	Answer   string `json:"answer"`
}

// HomeLandingLink 落地页外链（交流群、文档等）。
type HomeLandingLink struct {
	Label string `json:"label"`
	Href  string `json:"href"`
}

// HomeLandingImage 落地页图片（群二维码等）。
type HomeLandingImage struct {
	Label string `json:"label"`
	Image string `json:"image"`
}

// HomeLandingSetting 落地页装修配置。
//
// 所有文案字段默认为空：为空时前端使用内置的多语言默认文案，
// 管理员按需覆盖即可，避免升级后文案被旧配置锁死。
type HomeLandingSetting struct {
	HeroBadge         string `json:"hero_badge"`          // 顶部小标签
	HeroTitle         string `json:"hero_title"`          // 主标题（前置部分）
	HeroHighlight     string `json:"hero_highlight"`      // 主标题高亮部分（渐变文字）
	HeroSubtitle      string `json:"hero_subtitle"`       // 副标题
	HeroPrimaryText   string `json:"hero_primary_text"`   // 主按钮文案
	HeroPrimaryLink   string `json:"hero_primary_link"`   // 主按钮链接（留空跳转注册）
	HeroSecondaryText string `json:"hero_secondary_text"` // 次按钮文案
	HeroSecondaryLink string `json:"hero_secondary_link"` // 次按钮链接
	HeroTrust         string `json:"hero_trust"`          // 按钮下方的小字提示

	StatsEnabled  bool   `json:"stats_enabled"`  // 是否展示数据条
	StatsTitle    string `json:"stats_title"`    // 数据条主标题
	StatsSubtitle string `json:"stats_subtitle"` // 数据条副标题
	StatsItems    string `json:"stats_items"`    // JSON: [{"label","value","suffix"}]

	ModelsEnabled  bool   `json:"models_enabled"`  // 是否展示支持的模型
	ModelsTitle    string `json:"models_title"`    // 区块标题
	ModelsSubtitle string `json:"models_subtitle"` // 区块副标题
	ModelsLimit    int    `json:"models_limit"`    // 展示数量上限
	ModelsGroups   string `json:"models_groups"`   // 只展示这些分组（逗号分隔，留空=全部）

	FaqEnabled  bool   `json:"faq_enabled"`  // 是否展示常见问题
	FaqTitle    string `json:"faq_title"`    // 区块标题
	FaqSubtitle string `json:"faq_subtitle"` // 区块副标题
	FaqItems    string `json:"faq_items"`    // JSON: [{"question","answer"}]

	CommunityEnabled bool   `json:"community_enabled"` // 是否展示交流群
	CommunityTitle   string `json:"community_title"`   // 区块标题
	CommunityDesc    string `json:"community_desc"`    // 区块描述
	CommunityLinks   string `json:"community_links"`   // JSON: [{"label","href"}]
	CommunityQrCodes string `json:"community_qr_codes"` // JSON: [{"label","image"}]
}

var homeLandingSetting = HomeLandingSetting{
	StatsEnabled:     true,
	ModelsEnabled:    true,
	ModelsLimit:      12,
	FaqEnabled:       true,
	CommunityEnabled: true,
}

func init() {
	config.GlobalConfig.Register("home_landing_setting", &homeLandingSetting)
}

// GetHomeLandingSetting 获取落地页配置。
func GetHomeLandingSetting() *HomeLandingSetting {
	return &homeLandingSetting
}

// ParseHomeLandingStatItems 解析数据条配置，解析失败时返回空列表。
func ParseHomeLandingStatItems(raw string) []HomeLandingStatItem {
	items := make([]HomeLandingStatItem, 0)
	if strings.TrimSpace(raw) == "" {
		return items
	}
	if err := json.Unmarshal([]byte(raw), &items); err != nil {
		return make([]HomeLandingStatItem, 0)
	}
	return items
}

// ParseHomeLandingFaqItems 解析常见问题配置，解析失败时返回空列表。
func ParseHomeLandingFaqItems(raw string) []HomeLandingFaqItem {
	items := make([]HomeLandingFaqItem, 0)
	if strings.TrimSpace(raw) == "" {
		return items
	}
	if err := json.Unmarshal([]byte(raw), &items); err != nil {
		return make([]HomeLandingFaqItem, 0)
	}
	return items
}

// ParseHomeLandingLinks 解析外链配置。
func ParseHomeLandingLinks(raw string) []HomeLandingLink {
	items := make([]HomeLandingLink, 0)
	if strings.TrimSpace(raw) == "" {
		return items
	}
	if err := json.Unmarshal([]byte(raw), &items); err != nil {
		return make([]HomeLandingLink, 0)
	}
	return items
}

// ParseHomeLandingImages 解析图片配置。
func ParseHomeLandingImages(raw string) []HomeLandingImage {
	items := make([]HomeLandingImage, 0)
	if strings.TrimSpace(raw) == "" {
		return items
	}
	if err := json.Unmarshal([]byte(raw), &items); err != nil {
		return make([]HomeLandingImage, 0)
	}
	return items
}

// HomeLandingGroups 返回落地页模型区块需要展示的分组。
func HomeLandingGroups() []string {
	groups := make([]string, 0)
	for _, group := range strings.Split(homeLandingSetting.ModelsGroups, ",") {
		if trimmed := strings.TrimSpace(group); trimmed != "" {
			groups = append(groups, trimmed)
		}
	}
	return groups
}
