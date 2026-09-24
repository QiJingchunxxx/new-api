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
import { Save } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { JsonCodeEditor } from '@/components/json-code-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import type { ContentSettings } from '../types'

const OPTION_PREFIX = 'home_landing_setting.'

type FieldKind = 'text' | 'textarea' | 'switch' | 'json'

type FieldDef = {
  key: string
  kind: FieldKind
  label: string
  hint?: string
  placeholder?: string
}

type FieldGroup = {
  title: string
  hint?: string
  fields: FieldDef[]
}

/**
 * 落地页装修表单结构。
 *
 * 加字段只需要往这里加一行：读写、脏检查、保存都按同一套规则处理。
 */
const FIELD_GROUPS: FieldGroup[] = [
  {
    title: 'Hero section',
    hint: 'Leave a field empty to keep the built-in localized copy.',
    fields: [
      { key: 'hero_badge', kind: 'text', label: 'Top badge' },
      { key: 'hero_title', kind: 'text', label: 'Headline' },
      { key: 'hero_highlight', kind: 'text', label: 'Headline highlight' },
      { key: 'hero_subtitle', kind: 'textarea', label: 'Subtitle' },
      { key: 'hero_primary_text', kind: 'text', label: 'Primary button label' },
      { key: 'hero_primary_link', kind: 'text', label: 'Primary button link' },
      {
        key: 'hero_secondary_text',
        kind: 'text',
        label: 'Secondary button label',
      },
      {
        key: 'hero_secondary_link',
        kind: 'text',
        label: 'Secondary button link',
      },
      { key: 'hero_trust', kind: 'text', label: 'Trust line' },
    ],
  },
  {
    title: 'Live overview',
    hint: 'Values left empty are filled with live gateway data.',
    fields: [
      { key: 'stats_enabled', kind: 'switch', label: 'Show the section' },
      { key: 'stats_title', kind: 'text', label: 'Title' },
      { key: 'stats_subtitle', kind: 'text', label: 'Subtitle' },
      {
        key: 'stats_items',
        kind: 'json',
        label: 'Metrics',
        hint: 'JSON array: [{"label","value","suffix"}] — matched to live metrics by position.',
      },
    ],
  },
  {
    title: 'Supported models',
    fields: [
      { key: 'models_enabled', kind: 'switch', label: 'Show the section' },
      { key: 'models_title', kind: 'text', label: 'Title' },
      { key: 'models_subtitle', kind: 'text', label: 'Subtitle' },
      { key: 'models_limit', kind: 'text', label: 'Card limit' },
      {
        key: 'models_groups',
        kind: 'text',
        label: 'Only these groups',
        hint: 'Comma separated. Empty means every group.',
      },
    ],
  },
  {
    title: 'FAQ',
    fields: [
      { key: 'faq_enabled', kind: 'switch', label: 'Show the section' },
      { key: 'faq_title', kind: 'text', label: 'Title' },
      { key: 'faq_subtitle', kind: 'text', label: 'Subtitle' },
      {
        key: 'faq_items',
        kind: 'json',
        label: 'Questions',
        hint: 'JSON array: [{"question","answer"}]. Empty keeps the built-in FAQ.',
      },
    ],
  },
  {
    title: 'Community',
    fields: [
      { key: 'community_enabled', kind: 'switch', label: 'Show the section' },
      { key: 'community_title', kind: 'text', label: 'Title' },
      { key: 'community_desc', kind: 'textarea', label: 'Description' },
      {
        key: 'community_links',
        kind: 'json',
        label: 'Links',
        hint: 'JSON array: [{"label","href"}]. Empty falls back to the docs link.',
      },
      {
        key: 'community_qr_codes',
        kind: 'json',
        label: 'QR codes',
        hint: 'JSON array: [{"label","image"}], image is an absolute URL.',
      },
    ],
  },
]

type HomeLandingSectionProps = {
  settings: ContentSettings
}

export function HomeLandingSection(props: HomeLandingSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const initial = useMemo(() => {
    const next: Record<string, string | boolean> = {}
    for (const group of FIELD_GROUPS) {
      for (const field of group.fields) {
        const raw = props.settings[
          `${OPTION_PREFIX}${field.key}` as keyof ContentSettings
        ]
        next[field.key] =
          field.kind === 'switch'
            ? raw === true || raw === 'true'
            : raw == null
              ? ''
              : String(raw)
      }
    }
    return next
  }, [props.settings])

  const [form, setForm] = useState<Record<string, string | boolean>>(initial)

  const changedKeys = useMemo(
    () =>
      Object.keys(initial).filter((key) => initial[key] !== form[key]),
    [initial, form]
  )

  const setValue = (key: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    for (const key of changedKeys) {
      await updateOption.mutateAsync({
        key: `${OPTION_PREFIX}${key}`,
        value: form[key],
      })
    }
  }

  return (
    <SettingsSection title={t('Landing page')}>
      <div className='space-y-6'>
        {FIELD_GROUPS.map((group) => (
          <div
            key={group.title}
            className='border-border/60 rounded-xl border p-4'
          >
            <div className='mb-3'>
              <h4 className='text-sm font-semibold'>{t(group.title)}</h4>
              {group.hint ? (
                <p className='text-muted-foreground mt-0.5 text-xs'>
                  {t(group.hint)}
                </p>
              ) : null}
            </div>

            <div className='space-y-3'>
              {group.fields.map((field) => {
                const id = `home-landing-${field.key}`
                return (
                  <div
                    key={field.key}
                    className='border-border/50 grid gap-2 border-b pb-3 last:border-b-0 last:pb-0 md:grid-cols-[14rem_minmax(0,1fr)] md:items-start md:gap-4'
                  >
                    <div className='min-w-0'>
                      <Label htmlFor={id} className='text-sm font-medium'>
                        {t(field.label)}
                      </Label>
                      {field.hint ? (
                        <p className='text-muted-foreground mt-0.5 text-xs leading-relaxed'>
                          {t(field.hint)}
                        </p>
                      ) : null}
                    </div>
                    <div className='min-w-0'>
                      {field.kind === 'switch' ? (
                        <Switch
                          id={id}
                          checked={Boolean(form[field.key])}
                          onCheckedChange={(checked) =>
                            setValue(field.key, checked)
                          }
                        />
                      ) : field.kind === 'textarea' ? (
                        <Textarea
                          id={id}
                          rows={3}
                          value={String(form[field.key] ?? '')}
                          placeholder={field.placeholder}
                          onChange={(event) =>
                            setValue(field.key, event.target.value)
                          }
                        />
                      ) : field.kind === 'json' ? (
                        <JsonCodeEditor
                          value={String(form[field.key] ?? '')}
                          onChange={(value) => setValue(field.key, value)}
                          heightClassName='h-40 min-h-40 max-h-40'
                        />
                      ) : (
                        <Input
                          id={id}
                          value={String(form[field.key] ?? '')}
                          placeholder={field.placeholder}
                          onChange={(event) =>
                            setValue(field.key, event.target.value)
                          }
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        <div className='flex items-center justify-between gap-3'>
          <p className='text-muted-foreground text-xs'>
            {changedKeys.length === 0
              ? t('No unsaved changes')
              : t('{{count}} field(s) changed', { count: changedKeys.length })}
          </p>
          <Button
            onClick={handleSave}
            disabled={changedKeys.length === 0 || updateOption.isPending}
          >
            {updateOption.isPending ? (
              <Spinner className='size-3.5' />
            ) : (
              <Save className='size-3.5' />
            )}
            {t('Save settings')}
          </Button>
        </div>
      </div>
    </SettingsSection>
  )
}
