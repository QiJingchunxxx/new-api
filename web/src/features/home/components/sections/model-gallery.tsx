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
import { Link } from '@tanstack/react-router'
import { ArrowRight, Boxes } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { Badge } from '@/components/ui/badge'
import { usePricingData } from '@/features/pricing/hooks'
import { formatCompactNumber, formatNumber } from '@/lib/format'

import { useLandingStats } from '../../hooks'

interface ModelGalleryProps {
  className?: string
  title?: string
  subtitle?: string
  limit?: number
  groups?: string[]
  /** 模型名 -> 展示标签，来自后台装修配置 */
  tags?: Record<string, string>
}

const DEFAULT_LIMIT = 12
const MAX_LIMIT = 60

/**
 * 首页「支持的模型」区块。
 *
 * 数据直接来自网关的实时定价目录，因此展示的可用性与分组永远与真实调度一致，
 * 不需要运营手工维护一张模型清单。
 */
export function ModelGallery(props: ModelGalleryProps) {
  const { t } = useTranslation()
  const { models, isLoading } = usePricingData()
  const stats = useLandingStats()

  // 日志里的模型名与定价目录里的展示名可能不一致，两个键都查一次。
  const usageByModel = useMemo(() => {
    const map = new Map<string, { calls: number; tokens: number }>()
    for (const item of stats?.models ?? []) {
      map.set(item.model_name, {
        calls: item.calls,
        tokens: item.total_tokens,
      })
    }
    return map
  }, [stats])

  const visibleModels = useMemo(() => {
    const filterGroups = (props.groups ?? []).filter(
      (group) => group.trim() !== ''
    )
    const filtered =
      filterGroups.length === 0
        ? models
        : models.filter((model) =>
            model.enable_groups.some((group) => filterGroups.includes(group))
          )
    const limit = Math.min(
      Math.max(props.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT
    )
    return filtered.slice(0, limit)
  }, [models, props.groups, props.limit])

  if (isLoading || visibleModels.length === 0) {
    return null
  }

  return (
    <section
      className={`border-border/40 relative z-10 border-t px-6 py-20 md:py-24 ${props.className ?? ''}`}
    >
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-10 flex flex-wrap items-end justify-between gap-4'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight md:text-[28px]'>
              {props.title?.trim() || t('Supported Models')}
            </h2>
            <p className='text-muted-foreground/80 mt-2.5 max-w-2xl text-sm leading-relaxed'>
              {props.subtitle?.trim() ||
                t(
                  'Availability, groups and endpoints come straight from the gateway, so what you see here is exactly what can be scheduled.'
                )}
            </p>
          </div>
          <Link
            to='/pricing'
            className='text-muted-foreground hover:text-foreground group inline-flex items-center gap-1 text-sm font-medium transition-colors'
          >
            {t('Browse all models')}
            <ArrowRight className='size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
          </Link>
        </AnimateInView>

        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {visibleModels.map((model, index) => {
            const groups = model.enable_groups ?? []
            const available = groups.length > 0
            const tag =
              props.tags?.[model.model_name] ?? props.tags?.[model.key] ?? ''
            const usage =
              usageByModel.get(model.model_name) ?? usageByModel.get(model.key)
            return (
              <AnimateInView
                key={model.key}
                delay={Math.min(index * 40, 320)}
                className='border-border/60 bg-card hover:border-border flex flex-col rounded-xl border p-5 transition-colors'
              >
                <div className='flex items-start justify-between gap-3'>
                  <div
                    className='min-w-0 truncate text-sm font-semibold'
                    title={model.model_name}
                  >
                    {model.model_name}
                  </div>
                  {tag ? (
                    <Badge
                      variant='secondary'
                      className='shrink-0 rounded-md bg-blue-50 px-1.5 py-0 text-[10px] font-normal text-blue-600 dark:bg-blue-500/15 dark:text-blue-300'
                    >
                      {tag}
                    </Badge>
                  ) : !available ? (
                    <Badge
                      variant='outline'
                      className='text-muted-foreground shrink-0 rounded-md px-1.5 py-0 text-[10px] font-normal'
                    >
                      {t('Unavailable')}
                    </Badge>
                  ) : null}
                </div>

                <p className='text-muted-foreground/80 mt-2.5 line-clamp-2 min-h-9 text-xs leading-relaxed'>
                  {model.description?.trim() ||
                    t('Routed through the unified gateway.')}
                </p>

                <div className='border-border/50 mt-4 grid grid-cols-3 gap-3 border-t pt-3.5'>
                  <div className='min-w-0'>
                    <div className='text-muted-foreground truncate text-[11px]'>
                      {t('Context')}
                    </div>
                    <div className='mt-0.5 truncate text-sm font-semibold tabular-nums'>
                      {model.context_length
                        ? formatCompactNumber(model.context_length)
                        : '-'}
                    </div>
                  </div>
                  <div className='min-w-0'>
                    <div className='text-muted-foreground truncate text-[11px]'>
                      {t('Calls today')}
                    </div>
                    <div className='mt-0.5 truncate text-sm font-semibold tabular-nums'>
                      {formatNumber(usage?.calls ?? 0)}
                    </div>
                  </div>
                  <div className='min-w-0'>
                    <div className='text-muted-foreground truncate text-[11px]'>
                      {t('Tokens today')}
                    </div>
                    <div className='mt-0.5 truncate text-sm font-semibold tabular-nums'>
                      {formatNumber(usage?.tokens ?? 0)}
                    </div>
                  </div>
                </div>
              </AnimateInView>
            )
          })}
        </div>

        {models.length > visibleModels.length ? (
          <div className='mt-8 flex justify-center'>
            <Link
              to='/pricing'
              className='border-border/60 hover:bg-muted/40 inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-medium transition-colors'
            >
              <Boxes className='size-4' />
              {t('See all {{count}} models', { count: models.length })}
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  )
}
