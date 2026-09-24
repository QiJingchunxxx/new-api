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
import { useEffect } from 'react'

import { getLandingStats, recordLandingVisit } from '../api'
import type { LandingStats } from '../types'

const LANDING_STATS_QUERY_KEY = ['landing-stats']
const VISIT_SESSION_KEY = 'landing-visit-reported'

/**
 * 首页统计快照（当天调用次数、Token 消耗、页面访问量、注册用户数）。
 *
 * 服务端已把聚合结果缓存在内存里，这里只做轮询读取；接口异常时返回 undefined，
 * 数据条会自动退回网关能力数据，落地页不会因此空一块。
 */
export function useLandingStats(): LandingStats | undefined {
  const { data } = useQuery({
    queryKey: LANDING_STATS_QUERY_KEY,
    queryFn: async () => {
      try {
        const result = await getLandingStats()
        return result.success ? result.data : undefined
      } catch {
        return undefined
      }
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  })
  return data
}

/** 首页挂载时上报一次访问；同一个标签页会话内只上报一次。 */
export function useLandingVisitReporter() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(VISIT_SESSION_KEY)) return
      sessionStorage.setItem(VISIT_SESSION_KEY, '1')
    } catch {
      // 隐私模式下 sessionStorage 不可用，直接上报即可。
    }
    void recordLandingVisit()
  }, [])
}
