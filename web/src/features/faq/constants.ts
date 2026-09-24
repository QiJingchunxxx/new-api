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
import { type TFunction } from 'i18next'

import type { HomeLandingFaqItem } from '@/features/home/types'

/**
 * 落地页与使用指南共用的内置问答。
 *
 * 管理员在「系统设置 → 内容 → 首页装修」里配置 faq_items 后会整体覆盖这里，
 * 因此这份默认内容只是开箱兜底。
 */
export function getDefaultFaqItems(t: TFunction): HomeLandingFaqItem[] {
  return [
    {
      question: t('How do I start using the gateway?'),
      answer: t(
        '1. Register an account and sign in.\n2. Create an API key on the **API Keys** page.\n3. Point your client at the gateway address and paste the key — no provider-specific configuration is needed.'
      ),
    },
    {
      question: t('How is quota calculated?'),
      answer: t(
        'Quota is consumed per request based on the model ratio and token usage. Every request is logged, so you can always inspect cost, latency and token counts on the usage log page.'
      ),
    },
    {
      question: t('Can I raise my daily quota without paying?'),
      answer: t(
        'Yes. Contribute an upstream provider key on the **Contribute Upstream Key** page. Once it is verified you receive extra daily quota, and the quota is re-granted every day while the key stays available.'
      ),
    },
    {
      question: t('Which clients are supported?'),
      answer: t(
        'Any client that speaks the OpenAI, Claude or Gemini compatible protocol works: Cherry Studio, Cline, LobeChat, OpenAI SDKs, and more. Only the base URL and API key need to be configured.'
      ),
    },
  ]
}

/** 使用指南页右侧「快速上手」的三步说明 */
export function getQuickStartSteps(t: TFunction) {
  return [
    {
      title: t('Create an account'),
      description: t(
        'Sign up and sign in. New accounts start with the welcome quota configured by the site.'
      ),
    },
    {
      title: t('Create an API key'),
      description: t(
        'Open the API Keys page and create a key. Keep it secret — it represents your account.'
      ),
    },
    {
      title: t('Point your client here'),
      description: t(
        'Fill in the gateway address and the key in any compatible client, then pick a model and start chatting.'
      ),
    },
  ]
}
