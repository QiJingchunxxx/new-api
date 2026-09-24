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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import i18next from 'i18next'
import { toast } from 'sonner'

import { api } from '@/lib/api'
import { handleServerError } from '@/lib/handle-server-error'
import { requireServerSuccess } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import { contributedReasonKey } from '../constants'

import {
  addSelfContributedKey,
  deleteContributedKey,
  deleteSelfContributedKey,
  getAllContributedKeys,
  getContributedKeyStats,
  getSelfContributedKeys,
  recalculateContributedQuota,
  updateContributedKey,
  verifyContributedKeys,
  verifySelfContributedKey,
} from '../api'
import type { ContributedKeyQuery, UpdateContributedKeyPayload } from '../types'

export const CONTRIBUTED_KEYS_QUERY_KEY = 'contributed-keys'

export function useSelfContributedKeys() {
  return useQuery({
    queryKey: [CONTRIBUTED_KEYS_QUERY_KEY, 'self'],
    queryFn: async () => requireServerSuccess(await getSelfContributedKeys()),
    staleTime: 30 * 1000,
  })
}

export function useContributedKeyStats(enabled: boolean) {
  return useQuery({
    queryKey: [CONTRIBUTED_KEYS_QUERY_KEY, 'stats'],
    queryFn: async () => requireServerSuccess(await getContributedKeyStats()),
    enabled,
    staleTime: 30 * 1000,
  })
}

export function useAllContributedKeys(query: ContributedKeyQuery, enabled: boolean) {
  return useQuery({
    queryKey: [CONTRIBUTED_KEYS_QUERY_KEY, 'all', query],
    queryFn: async () => {
      const result = requireServerSuccess(await getAllContributedKeys(query))
      return result.data
    },
    enabled,
    staleTime: 15 * 1000,
    placeholderData: (previous) => previous,
  })
}

/** 额度变化后刷新当前用户，保证头部余额展示与后端一致 */
async function refreshCurrentUser() {
  try {
    const res = await api.get('/api/user/self', { skipErrorHandler: true })
    const payload = requireServerSuccess(res.data)
    if (payload?.data) {
      useAuthStore.getState().auth.setUser(payload.data)
    }
  } catch {
    // 刷新失败不影响贡献流程，下一次页面加载会重新同步。
  }
}

/** 影响额度与用户信息的接口调用后统一刷新 */
function useInvalidateContributedKeys() {
  const queryClient = useQueryClient()
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [CONTRIBUTED_KEYS_QUERY_KEY],
      }),
      queryClient.invalidateQueries({ queryKey: ['status'] }),
      refreshCurrentUser(),
    ])
  }
}

export function useAddContributedKey() {
  const invalidate = useInvalidateContributedKeys()
  return useMutation({
    mutationFn: async (payload: {
      provider: string
      key: string
      remark?: string
    }) => requireServerSuccess(await addSelfContributedKey(payload)),
    onSuccess: async (result) => {
      await invalidate()
      if (result.data.valid) {
        toast.success(
          i18next.t(
            'Key verified. Contributed quota for today: {{quota}}',
            { quota: result.data.today_quota }
          )
        )
      } else {
        toast.warning(
          i18next.t(contributedReasonKey(result.data.reason_code))
        )
      }
    },
    onError: (error: Error) =>
      handleServerError(error, i18next.t('Failed to submit key')),
  })
}

export function useDeleteSelfContributedKey() {
  const invalidate = useInvalidateContributedKeys()
  return useMutation({
    mutationFn: async (id: number) =>
      requireServerSuccess(await deleteSelfContributedKey(id)),
    onSuccess: async () => {
      await invalidate()
      toast.success(i18next.t('Key removed'))
    },
    onError: (error: Error) =>
      handleServerError(error, i18next.t('Failed to remove key')),
  })
}

export function useVerifySelfContributedKey() {
  const invalidate = useInvalidateContributedKeys()
  return useMutation({
    mutationFn: async (id: number) =>
      requireServerSuccess(await verifySelfContributedKey(id)),
    onSuccess: async (result) => {
      await invalidate()
      if (result.data.valid) {
        toast.success(i18next.t('Key is available'))
      } else {
        toast.warning(i18next.t(contributedReasonKey(result.data.reason_code)))
      }
    },
    onError: (error: Error) =>
      handleServerError(error, i18next.t('Failed to verify key')),
  })
}

export function useVerifyContributedKeys() {
  const invalidate = useInvalidateContributedKeys()
  return useMutation({
    mutationFn: async (ids?: number[]) =>
      requireServerSuccess(await verifyContributedKeys(ids)),
    onSuccess: async (result) => {
      await invalidate()
      toast.success(
        i18next.t('Verified {{total}} keys, {{valid}} available', {
          total: result.data.total,
          valid: result.data.valid,
        })
      )
    },
    onError: (error: Error) =>
      handleServerError(error, i18next.t('Failed to verify keys')),
  })
}

export function useUpdateContributedKey() {
  const invalidate = useInvalidateContributedKeys()
  return useMutation({
    mutationFn: async (payload: {
      id: number
      values: UpdateContributedKeyPayload
    }) => requireServerSuccess(await updateContributedKey(payload.id, payload.values)),
    onSuccess: async () => {
      await invalidate()
      toast.success(i18next.t('Key updated'))
    },
    onError: (error: Error) =>
      handleServerError(error, i18next.t('Failed to update key')),
  })
}

export function useDeleteContributedKey() {
  const invalidate = useInvalidateContributedKeys()
  return useMutation({
    mutationFn: async (id: number) =>
      requireServerSuccess(await deleteContributedKey(id)),
    onSuccess: async () => {
      await invalidate()
      toast.success(i18next.t('Key removed'))
    },
    onError: (error: Error) =>
      handleServerError(error, i18next.t('Failed to remove key')),
  })
}

export function useRecalculateContributedQuota() {
  const invalidate = useInvalidateContributedKeys()
  return useMutation({
    mutationFn: async () =>
      requireServerSuccess(await recalculateContributedQuota()),
    onSuccess: async (result) => {
      await invalidate()
      toast.success(
        i18next.t('Recalculated for {{users}} users', {
          users: result.data.users,
        })
      )
    },
    onError: (error: Error) =>
      handleServerError(error, i18next.t('Failed to recalculate quota')),
  })
}
