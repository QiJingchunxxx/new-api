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
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import type { HomeLandingHero } from '../../types'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
  config?: HomeLandingHero
}

/**
 * 主视觉按钮。
 *
 * `to` 支持站内路径与外部链接；未配置时不渲染按钮，
 * 这样管理员可以在后台关掉任意一个入口。
 */
function HeroAction(props: {
  label: string
  to?: string
  variant?: 'default' | 'outline'
  withIcon?: boolean
}) {
  const to = props.to?.trim()
  if (!to) return null

  const label = (
    <>
      {props.label}
      {props.withIcon ? (
        <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
      ) : null}
    </>
  )

  const isExternal = /^https?:\/\//i.test(to)
  // 主行动点用实心蓝，和标题的蓝紫渐变同色系；次行动点保持描边样式。
  const className =
    props.variant === 'outline'
      ? 'group h-12 rounded-xl px-6 text-sm font-medium'
      : 'group h-12 rounded-xl bg-blue-600 px-6 text-sm font-medium text-white shadow-sm hover:bg-blue-700'
  if (isExternal) {
    return (
      <Button
        variant={props.variant}
        className={className}
        render={<a href={to} target='_blank' rel='noopener noreferrer' />}
      >
        {label}
      </Button>
    )
  }
  return (
    <Button
      variant={props.variant}
      className={className}
      render={<Link to={to} />}
    >
      {label}
    </Button>
  )
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const config = props.config

  const title = config?.title?.trim() || t('One key for')
  const highlight = config?.highlight?.trim() || t('every major AI model')
  const subtitle =
    config?.subtitle?.trim() ||
    t(
      'Call dozens of upstream providers through a single OpenAI compatible API. Transparent billing, automatic failover and real-time usage insights, ready out of the box.'
    )
  const primaryText = config?.primary_text?.trim() || t('Get your key')
  const primaryLink = config?.primary_link?.trim() || '/sign-up'
  // 次要入口默认不展示，管理员在后台填了文案才会出现，保持主视觉只有一个行动点。
  const secondaryText = config?.secondary_text?.trim() || ''
  const secondaryLink = config?.secondary_link?.trim() || '/pricing'
  const trust =
    config?.trust?.trim() ||
    t('No credit card required · Sign up to claim free quota')

  return (
    <section
      className={`relative z-10 overflow-hidden px-6 pt-24 pb-12 md:pt-32 md:pb-14 ${props.className ?? ''}`}
    >
      {/* Radial gradient background */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 -z-10 opacity-25 dark:opacity-[0.12]'
        style={{
          background: [
            'radial-gradient(ellipse 55% 45% at 25% 15%, oklch(0.72 0.18 250 / 80%) 0%, transparent 70%)',
            'radial-gradient(ellipse 45% 40% at 78% 12%, oklch(0.65 0.15 200 / 60%) 0%, transparent 70%)',
            'radial-gradient(ellipse 40% 35% at 50% 75%, oklch(0.70 0.12 280 / 40%) 0%, transparent 70%)',
          ].join(', '),
        }}
      />
      {/* Grid pattern */}
      <div
        aria-hidden
        className='absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_65%_55%_at_50%_25%,black_15%,transparent_100%)] bg-[size:4rem_4rem] opacity-[0.08]'
      />

      <div className='mx-auto flex max-w-4xl flex-col items-center text-center'>
        <h1
          className='landing-animate-fade-up text-[clamp(2rem,5.2vw,3.5rem)] leading-[1.15] font-bold tracking-tight'
          style={{ animationDelay: '0ms' }}
        >
          {title}{' '}
          <span className='bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 bg-clip-text text-transparent dark:from-orange-400 dark:via-rose-400 dark:to-purple-400'>
            {highlight}
          </span>
        </h1>

        <p
          className='landing-animate-fade-up text-muted-foreground/85 mt-5 max-w-2xl text-sm leading-relaxed opacity-0 md:text-[15px]'
          style={{ animationDelay: '80ms' }}
        >
          {subtitle}
        </p>

        <div
          className='landing-animate-fade-up mt-8 flex flex-wrap items-center justify-center gap-3 opacity-0'
          style={{ animationDelay: '140ms' }}
        >
          <HeroAction label={primaryText} to={primaryLink} withIcon />
          {secondaryText ? (
            <HeroAction
              label={secondaryText}
              to={secondaryLink}
              variant='outline'
            />
          ) : null}
        </div>

        {trust ? (
          <p
            className='landing-animate-fade-up text-muted-foreground/70 mt-5 text-xs opacity-0'
            style={{ animationDelay: '200ms' }}
          >
            {trust}
          </p>
        ) : null}
      </div>
    </section>
  )
}
