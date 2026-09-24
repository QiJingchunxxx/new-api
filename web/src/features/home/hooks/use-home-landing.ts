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
import { useQuery } from '@tanstack/react-query'

import { getHomeLandingConfig } from '../api'

/**
 * 落地页装修配置。
 *
 * 接口失败时返回 undefined，区块会退回内置的多语言默认文案，
 * 保证落地页在接口异常时依然可以正常渲染。
 */
export function useHomeLanding() {
  const { data } = useQuery({
    queryKey: ['home-landing'],
    queryFn: async () => {
      try {
        const result = await getHomeLandingConfig()
        return result.success ? result.data : undefined
      } catch {
        return undefined
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  return data
}
