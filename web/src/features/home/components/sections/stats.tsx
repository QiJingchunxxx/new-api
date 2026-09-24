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
import { cn } from '@/lib/utils'

import { useLandingStats } from '../../hooks'
import type { HomeLandingStatItem } from '../../types'

interface StatsProps {
  className?: string
  title?: string
  subtitle?: string
  /** 后台配置的数据项，按下标覆盖实时数据的名称 / 数值 / 说明 */
  items?: HomeLandingStatItem[]
}

type MetricItem = {
  label: string
  value: string
  suffix: string
  hint: string
}

/**
 * 首页「今日实时」数据条。
 *
 * 横向单行卡片：左侧状态灯与标题，右侧四组指标（调用次数、Token 消耗、
 * 页面访问量、注册用户数）。数值来自服务端缓存的统计快照；统计接口不可用时
 * 退回网关能力数据，避免落地页空掉一块。
 */
export function Stats(props: StatsProps) {
  const { t } = useTranslation()
  const stats = useLandingStats()
  const { models, vendors, usableGroup, endpointMap } = usePricingData()

  const configured = props.items ?? []

  const liveMetrics: MetricItem[] = stats
    ? [
        {
          label: t('Calls today'),
          value: formatNumber(stats.today_calls),
          suffix: '',
          hint: t('Across all models'),
        },
        {
          label: t('Tokens used'),
          value: formatNumber(stats.today_tokens),
          suffix: 'tok',
          hint: t('Input {{input}} · Output {{output}}', {
            input: formatNumber(stats.today_prompt_tokens),
            output: formatNumber(stats.today_completion_tokens),
          }),
        },
        {
          label: t('Today visits'),
          value: formatNumber(stats.today_visits),
          suffix: '',
          hint: t('Page view statistics'),
        },
        {
          label: t('Total users'),
          value: formatNumber(stats.user_count),
          suffix: '',
          hint: t('Registered users'),
        },
      ]
    : [
        {
          label: t('Available models'),
          value: formatNumber(models.length),
          suffix: '',
          hint: t('Across the gateway'),
        },
        {
          label: t('Upstream providers'),
          value: formatNumber(vendors.length),
          suffix: '',
          hint: t('Connected vendors'),
        },
        {
          label: t('Available groups'),
          value: formatNumber(Object.keys(usableGroup).length),
          suffix: '',
          hint: t('Model groups'),
        },
        {
          label: t('Compatible endpoints'),
          value: formatNumber(Object.keys(endpointMap).length),
          suffix: '',
          hint: t('API endpoints'),
        },
      ]

  const metrics: MetricItem[] = liveMetrics.map((live, index) => {
    const override = configured[index]
    if (!override) return live
    return {
      label: override.label?.trim() || live.label,
      value: override.value?.trim() || live.value,
      suffix: override.suffix?.trim() || live.suffix,
      hint: override.hint?.trim() || live.hint,
    }
  })

  return (
    <section className={`relative z-10 px-6 pb-12 ${props.className ?? ''}`}>
      <AnimateInView
        animation='fade-up'
        className='border-border/60 bg-background mx-auto max-w-5xl overflow-hidden rounded-2xl border shadow-sm'
      >
        <div className='flex flex-col gap-6 px-6 py-5 lg:flex-row lg:items-center lg:gap-8'>
          <div className='flex shrink-0 items-center gap-2 lg:w-24'>
            <span className='relative flex size-2'>
              <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70' />
              <span className='relative inline-flex size-2 rounded-full bg-emerald-500' />
            </span>
            <span className='text-sm font-medium whitespace-nowrap'>
              {props.title?.trim() || t('Live today')}
            </span>
          </div>

          <div className='lg:divide-border/60 grid flex-1 grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-4 lg:divide-x'>
            {metrics.map((metric, index) => (
              <div
                key={`${metric.label}-${index}`}
                className={cn('flex min-w-0 flex-col', index > 0 && 'lg:pl-6')}
              >
                <span className='text-muted-foreground truncate text-xs'>
                  {metric.label}
                </span>
                <span className='mt-1 text-2xl leading-none font-bold tracking-tight tabular-nums'>
                  {metric.value}
                  {metric.suffix ? (
                    <span className='text-muted-foreground ml-1 text-[11px] font-medium'>
                      {metric.suffix}
                    </span>
                  ) : null}
                </span>
                {metric.hint ? (
                  <span
                    className='text-muted-foreground/60 mt-1.5 truncate text-[11px]'
                    title={metric.hint}
                  >
                    {metric.hint}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </AnimateInView>
    </section>
  )
}
