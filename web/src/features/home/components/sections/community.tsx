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
import { BookOpen, ExternalLink, MessagesSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { useStatus } from '@/hooks/use-status'

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

  const docsUrl =
    (status?.docs_link as string | undefined) || 'https://docs.newapi.pro'

  const configuredLinks = (props.links ?? []).filter(
    (link) => link.href?.trim() && link.label?.trim()
  )
  const links: HomeLandingLink[] =
    configuredLinks.length > 0
      ? configuredLinks
      : [{ label: t('Documentation'), href: docsUrl }]

  const qrCodes = (props.qrCodes ?? []).filter((item) => item.image?.trim())

  return (
    <section
      className={`border-border/40 relative z-10 border-t px-6 py-20 md:py-24 ${props.className ?? ''}`}
    >
      <AnimateInView
        animation='fade-up'
        className='mx-auto max-w-4xl'
      >
        <div className='border-border/60 bg-card/60 flex flex-col gap-8 rounded-2xl border p-6 md:flex-row md:items-center md:justify-between md:p-8'>
          <div className='min-w-0'>
            <div className='text-muted-foreground mb-3 inline-flex items-center gap-1.5 text-xs font-medium tracking-widest uppercase'>
              <MessagesSquare className='size-3.5' />
              {t('Community')}
            </div>
            <h2 className='text-xl font-bold tracking-tight md:text-2xl'>
              {props.title?.trim() || t('Ran into a problem? Join us')}
            </h2>
            <p className='text-muted-foreground/80 mt-2 max-w-xl text-sm leading-relaxed'>
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
                    className='border-border/60 hover:bg-muted/40 inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium transition-colors'
                  >
                    <BookOpen className='size-3.5' />
                    {link.label}
                    {isExternal ? (
                      <ExternalLink className='text-muted-foreground size-3' />
                    ) : null}
                  </a>
                )
              })}
            </div>
          </div>

          {qrCodes.length > 0 ? (
            <div className='flex shrink-0 items-center gap-4'>
              {qrCodes.map((item) => (
                <div
                  key={`${item.label}-${item.image}`}
                  className='flex flex-col items-center gap-2'
                >
                  <img
                    src={item.image}
                    alt={item.label || t('Community QR code')}
                    className='border-border/60 size-28 rounded-xl border object-contain'
                    loading='lazy'
                  />
                  <span className='text-muted-foreground text-[11px]'>
                    {item.label}
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
