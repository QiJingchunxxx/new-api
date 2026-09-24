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
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { usePricingData } from '@/features/pricing/hooks'
import { formatNumber } from '@/lib/format'

import type { HomeLandingStatItem } from '../../types'

interface StatsProps {
  className?: string
  title?: string
  subtitle?: string
  /** 后台配置的数据项，按下标覆盖实时数据的标题 / 数值 */
  items?: HomeLandingStatItem[]
}

type MetricItem = {
  label: string
  value: string
  suffix: string
}

export function Stats(props: StatsProps) {
  const { t } = useTranslation()
  const { models, vendors, usableGroup, endpointMap, isLoading, error } =
    usePricingData()

  const configured = props.items ?? []
  // 无法读取实时数据且后台没有配置数值时整块隐藏，避免落地页出现一片占位符。
  const hasConfiguredValue = configured.some((item) => item.value?.trim())
  if (error && !hasConfiguredValue) {
    return null
  }

  const liveMetrics: MetricItem[] = [
    {
      label: t('Available models'),
      value: isLoading ? '-' : formatNumber(models.length),
      suffix: '',
    },
    {
      label: t('Upstream providers'),
      value: isLoading ? '-' : formatNumber(vendors.length),
      suffix: '',
    },
    {
      label: t('Available groups'),
      value: isLoading ? '-' : formatNumber(Object.keys(usableGroup).length),
      suffix: '',
    },
    {
      label: t('Compatible endpoints'),
      value: isLoading ? '-' : formatNumber(Object.keys(endpointMap).length),
      suffix: '',
    },
  ]

  const metrics: MetricItem[] = liveMetrics.map((live, index) => {
    const override = configured[index]
    if (!override) return live
    return {
      label: override.label?.trim() || live.label,
      value: override.value?.trim() || live.value,
      suffix: override.suffix?.trim() || live.suffix,
    }
  })

  return (
    <section className={`relative z-10 px-6 pb-6 ${props.className ?? ''}`}>
      <AnimateInView
        animation='fade-up'
        className='border-border/60 bg-background/60 mx-auto max-w-5xl overflow-hidden rounded-2xl border shadow-sm backdrop-blur-sm'
      >
        <div className='border-border/50 flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3'>
          <div className='flex items-center gap-2'>
            <span className='relative flex size-2'>
              <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70' />
              <span className='relative inline-flex size-2 rounded-full bg-emerald-500' />
            </span>
            <span className='text-sm font-medium'>
              {props.title?.trim() || t('Live overview')}
            </span>
          </div>
          <span className='text-muted-foreground text-xs'>
            {props.subtitle?.trim() ||
              t('Refreshed automatically from live gateway data')}
          </span>
        </div>

        <div className='grid grid-cols-2 gap-y-5 px-5 py-5 lg:grid-cols-4'>
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className='flex flex-col items-center text-center'
            >
              <span className='text-xl font-bold tracking-tight tabular-nums md:text-2xl'>
                {metric.value}
                {metric.suffix ? (
                  <span className='text-muted-foreground ml-1 text-xs font-medium'>
                    {metric.suffix}
                  </span>
                ) : null}
              </span>
              <span className='text-muted-foreground mt-1 text-xs'>
                {metric.label}
              </span>
            </div>
          ))}
        </div>
      </AnimateInView>
    </section>
  )
}
