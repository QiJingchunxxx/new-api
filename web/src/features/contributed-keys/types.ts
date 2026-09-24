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
// Contributed Upstream Key Types
// ============================================================================

export type ContributedProvider = {
  key: string
  name: string
  /** 用户获取 Key 的入口；上游地址等内部配置不下发给用户 */
  docs_url: string
}

/** 0 = 待验证，1 = 验证通过，2 = 验证失败 */
export type ContributedKeyStatus = 0 | 1 | 2

/** 验证失败分类码：用户端只看到分类，看不到上游原始报错 */
export type ContributedReasonCode =
  | ''
  | 'auth'
  | 'quota'
  | 'network'
  | 'upstream'
  | 'format'
  | 'config'
  | 'unknown'

/** 用户端视图：不含上游报错原文、模型列表与号池渠道编号 */
export type ContributedKeyItem = {
  id: number
  provider: string
  provider_name: string
  key_masked: string
  status: ContributedKeyStatus
  enabled: boolean
  reason_code: ContributedReasonCode
  verify_count: number
  last_verify_time: number
  remark: string
  created_time: number
  updated_time: number
}

/** 管理端视图：额外包含排障信息 */
export type ContributedKeyAdminItem = ContributedKeyItem & {
  user_id: number
  username: string
  message: string
  models: string[]
}

export type ContributedKeySettingInfo = {
  reward_amount: number
  reward_quota: number
  daily_cap_amount: number
  daily_cap_quota: number
  reward_per_key: boolean
  reset_hour: number
  verify_interval_min: number
  auto_create_channel: boolean
  channel_group: string
  max_keys_per_user: number
}

/** 单个供应商的每日额度明细（钱包页「每日额度」卡片） */
export type ContributedProviderQuota = {
  provider: string
  provider_name: string
  valid_count: number
  pending_count: number
  invalid_count: number
  counted_units: number
  quota: number
  reward_quota: number
  reset_hour: number
}

export type ContributedKeySummary = {
  valid_count: number
  pending_count: number
  invalid_count: number
  valid_units: number
  total_count: number
  today_quota: number
  entitlement: number
  capped: boolean
  today_date: string
  reward_quota: number
  daily_cap_quota: number
  reset_hour: number
  max_keys: number
  providers: ContributedProviderQuota[]
}

export type ContributedKeysData = {
  enabled: boolean
  setting: ContributedKeySettingInfo
  providers: ContributedProvider[]
  keys: ContributedKeyItem[]
  summary: ContributedKeySummary
}

export type ContributedKeysResponse = {
  success: boolean
  message?: string
  data: ContributedKeysData
}

export type AddContributedKeyResult = {
  valid: boolean
  reason_code: ContributedReasonCode
  key: ContributedKeyItem
  today_quota: number
  reward_quota: number
}

export type AddContributedKeyResponse = {
  success: boolean
  message?: string
  data: AddContributedKeyResult
}

export type VerifyContributedKeyResult = {
  valid: boolean
  reason_code: ContributedReasonCode
  key: ContributedKeyItem
  today_quota: number
}

export type VerifyContributedKeyResponse = {
  success: boolean
  message?: string
  data: VerifyContributedKeyResult
}

export type SimpleQuotaResponse = {
  success: boolean
  message?: string
  data: {
    today_quota: number
  }
}

export type ContributedKeysPage = {
  page: number
  page_size: number
  total: number
  items: ContributedKeyAdminItem[]
}

export type ContributedKeysListResponse = {
  success: boolean
  message?: string
  data: ContributedKeysPage
}

/** 共享号池概览（仅管理端） */
export type ContributedPoolSummary = {
  provider: string
  provider_name: string
  channel_id: number
  status: number
  key_count: number
  disabled_keys: number
  model_count: number
  circuit_broken: boolean
}

export type ContributedKeyStatsResponse = {
  success: boolean
  message?: string
  data: {
    total: number
    valid: number
    invalid: number
    pending: number
    enabled: number
    today_quota: number
    today_grant_date: string
    setting: ContributedKeySettingInfo
    pools: ContributedPoolSummary[]
    /** 全局失败重试次数；为 0 时号池无法在被调用的 Key 出错时自动切换 */
    retry_times: number
  }
}

export type ContributedKeyMutationResponse = {
  success: boolean
  message?: string
  data: {
    key: ContributedKeyAdminItem
    today_quota: number
  }
}

export type ContributedKeyQuery = {
  page: number
  pageSize: number
  provider?: string
  status?: string
  keyword?: string
  userId?: number
}

export type UpdateContributedKeyPayload = {
  enabled?: boolean
  status?: ContributedKeyStatus
  remark?: string
}
