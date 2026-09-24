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
import { api } from '@/lib/api'

import type {
  AddContributedKeyResponse,
  ContributedKeyMutationResponse,
  ContributedKeysListResponse,
  ContributedKeysResponse,
  ContributedKeyStatsResponse,
  ContributedKeyQuery,
  SimpleQuotaResponse,
  UpdateContributedKeyPayload,
  VerifyContributedKeyResponse,
} from './types'

// ============================================================================
// User APIs
// ============================================================================

export async function getSelfContributedKeys(): Promise<ContributedKeysResponse> {
  const res = await api.get<ContributedKeysResponse>(
    '/api/user/contributed_keys'
  )
  return res.data
}

export async function addSelfContributedKey(payload: {
  provider: string
  key: string
  remark?: string
}): Promise<AddContributedKeyResponse> {
  const res = await api.post<AddContributedKeyResponse>(
    '/api/user/contributed_keys',
    payload
  )
  return res.data
}

export async function deleteSelfContributedKey(
  id: number
): Promise<SimpleQuotaResponse> {
  const res = await api.delete<SimpleQuotaResponse>(
    `/api/user/contributed_keys/${id}`
  )
  return res.data
}

export async function verifySelfContributedKey(
  id: number
): Promise<VerifyContributedKeyResponse> {
  const res = await api.post<VerifyContributedKeyResponse>(
    `/api/user/contributed_keys/${id}/verify`
  )
  return res.data
}

// ============================================================================
// Admin APIs
// ============================================================================

export async function getAllContributedKeys(
  query: ContributedKeyQuery
): Promise<ContributedKeysListResponse> {
  const res = await api.get<ContributedKeysListResponse>(
    '/api/contributed_keys/',
    {
      params: {
        p: query.page,
        page_size: query.pageSize,
        provider: query.provider || undefined,
        status: query.status || undefined,
        keyword: query.keyword || undefined,
        user_id: query.userId || undefined,
      },
    }
  )
  return res.data
}

export async function getContributedKeyStats(): Promise<ContributedKeyStatsResponse> {
  const res = await api.get<ContributedKeyStatsResponse>(
    '/api/contributed_keys/stats'
  )
  return res.data
}

export async function verifyContributedKeys(ids?: number[]) {
  const res = await api.post<{
    success: boolean
    message?: string
    data: { total: number; valid: number }
  }>('/api/contributed_keys/verify', { ids: ids ?? [] })
  return res.data
}

export async function updateContributedKey(
  id: number,
  payload: UpdateContributedKeyPayload
): Promise<ContributedKeyMutationResponse> {
  const res = await api.put<ContributedKeyMutationResponse>(
    `/api/contributed_keys/${id}`,
    payload
  )
  return res.data
}

export async function deleteContributedKey(
  id: number
): Promise<SimpleQuotaResponse> {
  const res = await api.delete<SimpleQuotaResponse>(
    `/api/contributed_keys/${id}`
  )
  return res.data
}

export async function recalculateContributedQuota() {
  const res = await api.post<{
    success: boolean
    message?: string
    data: { users: number; total_quota: number }
  }>('/api/contributed_keys/recalculate')
  return res.data
}
