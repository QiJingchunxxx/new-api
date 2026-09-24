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
import type { ContributedReasonCode } from './types'

/**
 * 验证失败原因码 → 面向用户的文案。
 *
 * 只告诉用户"哪一类问题"，不暴露上游返回的原始报错、上游地址或号池内部状态。
 */
const REASON_KEYS: Record<ContributedReasonCode, string> = {
  '': '',
  auth: 'The key is invalid or has been revoked',
  quota: 'The upstream account is out of quota or rate limited',
  network: 'Network issue detected, the system will retry automatically',
  upstream: 'The upstream service is temporarily unavailable',
  format: 'Unexpected upstream response, please try again later',
  config: 'This provider is temporarily unavailable',
  unknown: 'Verification failed, please try again later',
}

export function contributedReasonKey(code: ContributedReasonCode): string {
  return REASON_KEYS[code] ?? REASON_KEYS.unknown
}
