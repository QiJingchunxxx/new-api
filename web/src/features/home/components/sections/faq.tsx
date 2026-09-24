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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Markdown } from '@/components/ui/markdown'
import { getDefaultFaqItems } from '@/features/faq/constants'

import type { HomeLandingFaqItem } from '../../types'

interface FaqProps {
  className?: string
  title?: string
  subtitle?: string
  items?: HomeLandingFaqItem[]
}

/**
 * 首页「常见问题」区块。
 * 后台未配置时使用内置文案，保证开箱即有内容。
 */
export function Faq(props: FaqProps) {
  const { t } = useTranslation()

  const defaultItems = useMemo<HomeLandingFaqItem[]>(
    () => getDefaultFaqItems(t),
    [t]
  )

  const items =
    props.items && props.items.length > 0 ? props.items : defaultItems

  if (items.length === 0) {
    return null
  }

  return (
    <section
      className={`border-border/40 relative z-10 border-t px-6 py-20 md:py-24 ${props.className ?? ''}`}
    >
      <div className='mx-auto max-w-3xl'>
        <AnimateInView className='mb-8 text-center'>
          <p className='text-muted-foreground mb-2 text-xs font-medium tracking-widest uppercase'>
            {t('FAQ')}
          </p>
          <h2 className='text-2xl font-bold tracking-tight md:text-3xl'>
            {props.title?.trim() || t('Frequently asked questions')}
          </h2>
          <p className='text-muted-foreground/80 mt-2 text-sm leading-relaxed'>
            {props.subtitle?.trim() ||
              t('Everything you need to know before your first call.')}
          </p>
        </AnimateInView>

        <AnimateInView animation='fade-up'>
          <Accordion className='border-border/60 bg-card/60 rounded-2xl border px-5 sm:px-6'>
            {items.map((item, index) => (
              <AccordionItem
                key={`${item.question}-${index}`}
                value={`landing-faq-${index}`}
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
      </div>
    </section>
  )
}
