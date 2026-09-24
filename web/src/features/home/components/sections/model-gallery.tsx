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
import { usePricingData } from '@/features/pricing/hooks'
import { formatCompactNumber } from '@/lib/format'

interface ModelGalleryProps {
  className?: string
  title?: string
  subtitle?: string
  limit?: number
  groups?: string[]
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
            <p className='text-muted-foreground mb-2 text-xs font-medium tracking-widest uppercase'>
              {t('Supported Models')}
            </p>
            <h2 className='text-2xl font-bold tracking-tight md:text-3xl'>
              {props.title?.trim() || t('Live model catalog')}
            </h2>
            <p className='text-muted-foreground/80 mt-2 max-w-2xl text-sm leading-relaxed'>
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

        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
          {visibleModels.map((model, index) => {
            const groups = model.enable_groups ?? []
            const endpoints = model.supported_endpoint_types ?? []
            const available = groups.length > 0
            return (
              <AnimateInView
                key={model.key}
                delay={Math.min(index * 40, 320)}
                className='border-border/60 bg-card hover:border-border/90 flex flex-col rounded-xl border p-4 transition-colors'
              >
                <div className='flex items-start justify-between gap-2'>
                  <div className='min-w-0'>
                    <div
                      className='truncate text-sm font-semibold'
                      title={model.model_name}
                    >
                      {model.model_name}
                    </div>
                    {model.vendor_name ? (
                      <div className='text-muted-foreground mt-0.5 truncate text-[11px]'>
                        {model.vendor_name}
                      </div>
                    ) : null}
                  </div>
                  <span
                    className={`mt-0.5 size-2 shrink-0 rounded-full ${available ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
                    title={available ? t('Available') : t('Unavailable')}
                  />
                </div>

                <p className='text-muted-foreground/80 mt-2 line-clamp-2 min-h-8 text-xs leading-relaxed'>
                  {model.description?.trim() ||
                    t('Routed through the unified gateway.')}
                </p>

                <div className='border-border/50 mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-center'>
                  <div>
                    <div className='text-xs font-semibold tabular-nums'>
                      {model.context_length
                        ? formatCompactNumber(model.context_length)
                        : '-'}
                    </div>
                    <div className='text-muted-foreground mt-0.5 text-[10px]'>
                      {t('Context')}
                    </div>
                  </div>
                  <div>
                    <div className='text-xs font-semibold tabular-nums'>
                      {groups.length}
                    </div>
                    <div className='text-muted-foreground mt-0.5 text-[10px]'>
                      {t('Groups')}
                    </div>
                  </div>
                  <div>
                    <div className='text-xs font-semibold tabular-nums'>
                      {endpoints.length}
                    </div>
                    <div className='text-muted-foreground mt-0.5 text-[10px]'>
                      {t('Endpoints')}
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
