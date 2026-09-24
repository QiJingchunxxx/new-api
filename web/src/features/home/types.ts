/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
// ============================================================================
// Home Page Types
// ============================================================================

/**
 * Response from home page content API
 */
export interface HomePageContentResponse {
  success: boolean
  message?: string
  data?: string
}

/**
 * Home page content result from hook
 */
export interface HomePageContentResult {
  content: string
  isLoaded: boolean
  isUrl: boolean
}

// ============================================================================
// Home Landing（落地页装修）类型
// ============================================================================

export interface HomeLandingStatItem {
  /** 指标名（第一行） */
  label: string
  /** 指标数值（第二行）；留空则使用站点实时数据 */
  value: string
  /** 数值后缀，紧跟数值显示 */
  suffix: string
  /** 指标说明（第三行小字），留空则不显示 */
  hint: string
}

export interface HomeLandingFaqItem {
  question: string
  answer: string
}

export interface HomeLandingLink {
  label: string
  href: string
}

export interface HomeLandingImage {
  label: string
  image: string
}

export interface HomeLandingHero {
  badge: string
  title: string
  highlight: string
  subtitle: string
  primary_text: string
  primary_link: string
  secondary_text: string
  secondary_link: string
  trust: string
}

export interface HomeLandingConfig {
  hero: HomeLandingHero
  stats: {
    enabled: boolean
    title: string
    subtitle: string
    items: HomeLandingStatItem[]
  }
  models: {
    enabled: boolean
    title: string
    subtitle: string
    limit: number
    groups: string[]
    /** 模型名 -> 展示标签（如「深度推理」），用于卡片右上角徽章 */
    tags: Record<string, string>
  }
  faq: {
    enabled: boolean
    title: string
    subtitle: string
    items: HomeLandingFaqItem[]
  }
  community: {
    enabled: boolean
    title: string
    desc: string
    links: HomeLandingLink[]
    qr_codes: HomeLandingImage[]
  }
}

export interface HomeLandingResponse {
  success: boolean
  message?: string
  data: HomeLandingConfig
}

// ============================================================================
// 首页统计（数据条与模型卡片的用量）
// ============================================================================

/** 单个模型当天的用量 */
export interface LandingModelUsage {
  model_name: string
  calls: number
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

/** 首页数据条使用的统计快照，全部为「当天」口径 */
export interface LandingStats {
  date: string
  today_calls: number
  today_prompt_tokens: number
  today_completion_tokens: number
  today_tokens: number
  today_visits: number
  user_count: number
  models: LandingModelUsage[]
  updated_time: number
}

export interface LandingStatsResponse {
  success: boolean
  message?: string
  data: LandingStats
}
