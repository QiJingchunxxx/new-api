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
import { BookOpen, LifeBuoy, MessagesSquare } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'
import { AnimateInView } from '@/components/animate-in-view'
import { Button } from '@/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Markdown } from '@/components/ui/markdown'
import { useHomeLanding } from '@/features/home/hooks'
import { useStatus } from '@/hooks/use-status'

import { getDefaultFaqItems, getQuickStartSteps } from './constants'

/**
 * 使用指南（常见问题）页面。
 *
 * 问答内容与首页 FAQ 区块共用后台配置（系统设置 → 内容 → 首页装修 → faq_items），
 * 保证同一份内容只维护一次。
 */
export function Faq() {
  const { t } = useTranslation()
  const landing = useHomeLanding()
  const { status } = useStatus()

  // 文档入口只使用后台配置的地址，不再回退到上游项目的文档站。
  const docsUrl = (status?.docs_link as string | undefined) || ''

  const defaults = useMemo(() => getDefaultFaqItems(t), [t])
  const items =
    landing?.faq.items && landing.faq.items.length > 0
      ? landing.faq.items
      : defaults
  const steps = useMemo(() => getQuickStartSteps(t), [t])

  return (
    <PublicLayout showMainContainer={false}>
      <section className='relative overflow-hidden px-6 pt-20 pb-12 md:pt-24'>
        <div
          aria-hidden
          className='pointer-events-none absolute inset-0 -z-10 opacity-20 dark:opacity-[0.10]'
          style={{
            background: [
              'radial-gradient(ellipse 55% 45% at 25% 10%, oklch(0.72 0.18 250 / 70%) 0%, transparent 70%)',
              'radial-gradient(ellipse 45% 40% at 80% 5%, oklch(0.65 0.15 200 / 50%) 0%, transparent 70%)',
            ].join(', '),
          }}
        />
        <div className='mx-auto max-w-6xl'>
          <p className='text-muted-foreground mb-2 text-xs font-medium tracking-widest uppercase'>
            {t('Help Center')}
          </p>
          <h1 className='text-3xl font-bold tracking-tight md:text-4xl'>
            {landing?.faq.title?.trim() || t('Frequently asked questions')}
          </h1>
          <p className='text-muted-foreground/85 mt-3 max-w-2xl text-sm leading-relaxed md:text-base'>
            {landing?.faq.subtitle?.trim() ||
              t(
                'Everything you need to know before your first call: how to get a key, how quota is calculated, and how to plug the gateway into your client.'
              )}
          </p>
        </div>
      </section>

      <section className='px-6 pb-20'>
        <div className='mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start'>
          <AnimateInView animation='fade-up'>
            <Accordion className='border-border/60 bg-card/60 rounded-2xl border px-5 sm:px-6'>
              {items.map((item, index) => (
                <AccordionItem
                  key={`${item.question}-${index}`}
                  value={`faq-${index}`}
                  className='border-border/50'
                >
                  <AccordionTrigger className='text-start text-sm font-medium hover:no-underline'>
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent>
                    <Markdown className='text-muted-foreground text-sm leading-relaxed'>
                      {item.answer}
                    </Markdown>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </AnimateInView>

          <div className='space-y-4 lg:sticky lg:top-24'>
            <div className='border-border/60 bg-card/60 rounded-2xl border p-5'>
              <div className='text-muted-foreground mb-3 inline-flex items-center gap-1.5 text-xs font-medium tracking-widest uppercase'>
                <BookOpen className='size-3.5' />
                {t('Quick start')}
              </div>
              <ol className='space-y-4'>
                {steps.map((step, index) => (
                  <li key={step.title} className='flex gap-3'>
                    <span className='bg-muted text-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold'>
                      {index + 1}
                    </span>
                    <div className='min-w-0'>
                      <div className='text-sm font-medium'>{step.title}</div>
                      <p className='text-muted-foreground mt-0.5 text-xs leading-relaxed'>
                        {step.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className='border-border/60 bg-card/60 rounded-2xl border p-5'>
              <div className='text-muted-foreground mb-2 inline-flex items-center gap-1.5 text-xs font-medium tracking-widest uppercase'>
                <LifeBuoy className='size-3.5' />
                {t('Still stuck?')}
              </div>
              <p className='text-muted-foreground text-xs leading-relaxed'>
                {t(
                  'Read the documentation or drop by the community channel, we are happy to help.'
                )}
              </p>
              <div className='mt-4 flex flex-col gap-2'>
                {docsUrl ? (
                  <Button
                    size='sm'
                    variant='outline'
                    className='w-full justify-between'
                    render={
                      <a
                        href={docsUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                      />
                    }
                  >
                    {t('Docs')}
                    <BookOpen className='size-3.5' />
                  </Button>
                ) : null}
                <Button
                  size='sm'
                  variant='ghost'
                  className='w-full justify-between'
                  render={<Link to='/contributed-keys' />}
                >
                  {t('Contribute Upstream Key')}
                  <MessagesSquare className='size-3.5' />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </PublicLayout>
  )
}
