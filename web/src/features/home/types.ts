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
  label: string
  value: string
  suffix: string
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
