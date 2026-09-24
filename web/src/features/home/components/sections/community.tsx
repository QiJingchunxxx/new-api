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
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { useStatus } from '@/hooks/use-status'
import { cn } from '@/lib/utils'

import type { HomeLandingImage, HomeLandingLink } from '../../types'

interface CommunityProps {
  className?: string
  title?: string
  desc?: string
  links?: HomeLandingLink[]
  qrCodes?: HomeLandingImage[]
}

/**
 * 首页「遇到问题」区块：文档入口 + 交流群二维码。
 * 二维码由管理员在后台配置，未配置时只展示文档入口。
 */
export function Community(props: CommunityProps) {
  const { t } = useTranslation()
  const { status } = useStatus()

  // 默认文档入口只使用后台配置的地址，不再回退到上游项目的文档站。
  const docsUrl = (status?.docs_link as string | undefined) || ''

  const configuredLinks = (props.links ?? []).filter(
    (link) => link.href?.trim() && link.label?.trim()
  )
  const links: HomeLandingLink[] =
    configuredLinks.length > 0
      ? configuredLinks
      : docsUrl
        ? [{ label: t('Documentation'), href: docsUrl }]
        : []

  const qrCodes = (props.qrCodes ?? []).filter((item) => item.image?.trim())

  return (
    <section
      className={`border-border/40 relative z-10 border-t px-6 py-20 md:py-24 ${props.className ?? ''}`}
    >
      <AnimateInView
        animation='fade-up'
        className='mx-auto max-w-4xl'
      >
        <div className='border-border/60 bg-card flex flex-col gap-8 rounded-2xl border p-6 md:flex-row md:items-center md:justify-between md:p-8'>
          <div className='min-w-0'>
            <h2 className='text-xl font-bold tracking-tight md:text-2xl'>
              {props.title?.trim() || t('Ran into a problem? Join us')}
            </h2>
            <p className='text-muted-foreground/80 mt-2.5 max-w-xl text-sm leading-relaxed'>
              {props.desc?.trim() ||
                t(
                  'Ask questions, report issues and share feedback with other users and the maintainers.'
                )}
            </p>
            <div className='mt-5 flex flex-wrap items-center gap-2.5'>
              {links.map((link) => {
                const isExternal = /^https?:\/\//i.test(link.href)
                return (
                  <a
                    key={`${link.label}-${link.href}`}
                    href={link.href}
                    {...(isExternal
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                    className='border-border/60 hover:bg-muted/40 group inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium transition-colors'
                  >
                    {link.label}
                    {isExternal ? (
                      <ArrowRight className='size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
                    ) : null}
                  </a>
                )
              })}
            </div>
          </div>

          {qrCodes.length > 0 ? (
            <div className='flex shrink-0 flex-wrap items-start gap-4'>
              {qrCodes.map((item, index) => (
                <div
                  key={`${item.label}-${item.image}`}
                  className='border-border/60 bg-background flex w-36 flex-col items-center rounded-xl border p-3'
                >
                  {item.label ? (
                    <span
                      className={cn(
                        'mb-2.5 rounded-md px-2 py-0.5 text-[11px] font-medium',
                        index % 2 === 0
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                          : 'bg-blue-500/10 text-blue-600 dark:text-blue-300'
                      )}
                    >
                      {item.label}
                    </span>
                  ) : null}
                  <img
                    src={item.image}
                    alt={item.label || t('Community QR code')}
                    className='size-24 rounded-lg object-contain'
                    loading='lazy'
                  />
                  <span className='text-muted-foreground mt-2.5 text-[10px]'>
                    {t('Long press or screenshot to scan')}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </AnimateInView>
    </section>
  )
}
