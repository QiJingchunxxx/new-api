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

import { HeroTerminalDemo } from '../hero-terminal-demo'
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
  const className = 'group h-12 rounded-xl px-6 text-sm font-medium'
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

  const badge = config?.badge?.trim() || t('Unified AI gateway')
  const title = config?.title?.trim() || t('One key for')
  const highlight =
    config?.highlight?.trim() || t('every major AI model')
  const subtitle =
    config?.subtitle?.trim() ||
    t(
      'Call dozens of upstream providers through a single OpenAI compatible API. Transparent billing, automatic failover and real-time usage insights, ready out of the box.'
    )
  const primaryText = config?.primary_text?.trim() || t('Get your key')
  const primaryLink = config?.primary_link?.trim() || '/sign-up'
  const secondaryText = config?.secondary_text?.trim() || t('View pricing')
  const secondaryLink = config?.secondary_link?.trim() || '/pricing'
  const trust =
    config?.trust?.trim() ||
    t('No credit card required · Sign up to claim free quota')

  return (
    <section
      className={`relative z-10 overflow-hidden px-6 pt-20 pb-14 md:pt-28 md:pb-16 ${props.className ?? ''}`}
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
        <div
          className='landing-animate-fade-up border-border/60 bg-background/70 mb-6 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] font-medium shadow-xs backdrop-blur-sm'
          style={{ animationDelay: '0ms' }}
        >
          <span className='relative flex size-1.5'>
            <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75' />
            <span className='relative inline-flex size-1.5 rounded-full bg-emerald-500' />
          </span>
          {badge}
        </div>

        <h1
          className='landing-animate-fade-up text-[clamp(2rem,5vw,3.5rem)] leading-[1.12] font-bold tracking-tight'
          style={{ animationDelay: '60ms' }}
        >
          {title}{' '}
          <span className='bg-gradient-to-r from-blue-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent dark:from-blue-400 dark:via-violet-400 dark:to-fuchsia-400'>
            {highlight}
          </span>
        </h1>

        <p
          className='landing-animate-fade-up text-muted-foreground/85 mt-5 max-w-2xl text-sm leading-relaxed opacity-0 md:text-base'
          style={{ animationDelay: '120ms' }}
        >
          {subtitle}
        </p>

        <div
          className='landing-animate-fade-up mt-9 flex flex-wrap items-center justify-center gap-3 opacity-0'
          style={{ animationDelay: '180ms' }}
        >
          <HeroAction
            label={props.isAuthenticated ? t('Go to Dashboard') : primaryText}
            to={props.isAuthenticated ? '/dashboard' : primaryLink}
            withIcon
          />
          <HeroAction
            label={secondaryText}
            to={secondaryLink}
            variant='outline'
          />
        </div>

        {trust ? (
          <p
            className='landing-animate-fade-up text-muted-foreground/70 mt-5 text-xs opacity-0'
            style={{ animationDelay: '240ms' }}
          >
            {trust}
          </p>
        ) : null}

        <div
          className='landing-animate-fade-up mt-12 w-full opacity-0'
          style={{ animationDelay: '300ms' }}
        >
          <HeroTerminalDemo />
        </div>
      </div>
    </section>
  )
}
