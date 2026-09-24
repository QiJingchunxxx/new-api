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
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Save } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { JsonCodeEditor } from '@/components/json-code-editor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { getSystemOptions } from '@/features/system-settings/api'
import { useUpdateOption } from '@/features/system-settings/hooks/use-update-option'
import { requireServerSuccess } from '@/lib/server-error-message'

import { useContributedKeyStats } from '../hooks/use-contributed-keys'

const OPTION_PREFIX = 'contributed_key_setting.'

type FormState = {
  enabled: boolean
  rewardAmount: string
  dailyCapAmount: string
  rewardPerKey: boolean
  resetHour: string
  verifyIntervalMin: string
  autoCreateChannel: boolean
  channelGroup: string
  channelWeight: string
  channelTag: string
  maxKeysPerUser: string
  providers: string
}

const DEFAULT_FORM: FormState = {
  enabled: false,
  rewardAmount: '20',
  dailyCapAmount: '40',
  rewardPerKey: true,
  resetHour: '0',
  verifyIntervalMin: '60',
  autoCreateChannel: true,
  channelGroup: 'default',
  channelWeight: '1',
  channelTag: 'contributed',
  maxKeysPerUser: '10',
  providers: '[]',
}

function Row(props: {
  label: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className='border-border/60 grid gap-2 border-b py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_18rem] md:items-start md:gap-6'>
      <div className='min-w-0'>
        <div className='text-sm font-medium'>{props.label}</div>
        {props.description ? (
          <p className='text-muted-foreground mt-0.5 text-xs leading-relaxed'>
            {props.description}
          </p>
        ) : null}
      </div>
      <div className='flex items-center md:justify-end'>{props.children}</div>
    </div>
  )
}

export function SettingsPanel() {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const statsQuery = useContributedKeyStats(true)
  const optionsQuery = useQuery({
    queryKey: ['system-options'],
    queryFn: async () => requireServerSuccess(await getSystemOptions()),
    staleTime: 60 * 1000,
  })

  const retryTimes = statsQuery.data?.data.retry_times ?? 0
  const failoverReady = retryTimes > 0

  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [dirty, setDirty] = useState(false)

  const optionMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const option of optionsQuery.data?.data ?? []) {
      map.set(option.key, option.value)
    }
    return map
  }, [optionsQuery.data])

  useEffect(() => {
    if (optionsQuery.data == null) return
    const read = (key: string, fallback: string) =>
      optionMap.get(OPTION_PREFIX + key) ?? fallback
    setForm({
      enabled: read('enabled', 'false') === 'true',
      rewardAmount: read('reward_amount', '20'),
      dailyCapAmount: read('daily_cap_amount', '40'),
      rewardPerKey: read('reward_per_key', 'true') === 'true',
      resetHour: read('reset_hour', '0'),
      verifyIntervalMin: read('verify_interval_min', '60'),
      autoCreateChannel: read('auto_create_channel', 'true') === 'true',
      channelGroup: read('channel_group', 'default'),
      channelWeight: read('channel_weight', '1'),
      channelTag: read('channel_tag', 'contributed-pool'),
      maxKeysPerUser: read('max_keys_per_user', '10'),
      providers: read('providers', '[]'),
    })
    setDirty(false)
  }, [optionsQuery.data, optionMap])

  if (optionsQuery.isLoading) {
    return (
      <div className='text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm'>
        <Spinner />
        {t('Loading...')}
      </div>
    )
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const handleSave = async () => {
    const updates: Array<{ key: string; value: string | boolean | number }> = [
      { key: OPTION_PREFIX + 'enabled', value: form.enabled },
      { key: OPTION_PREFIX + 'reward_amount', value: Number(form.rewardAmount) || 0 },
      {
        key: OPTION_PREFIX + 'daily_cap_amount',
        value: Number(form.dailyCapAmount) || 0,
      },
      { key: OPTION_PREFIX + 'reward_per_key', value: form.rewardPerKey },
      {
        key: OPTION_PREFIX + 'reset_hour',
        value: Math.min(23, Math.max(0, Number(form.resetHour) || 0)),
      },
      {
        key: OPTION_PREFIX + 'verify_interval_min',
        value: Math.max(5, Number(form.verifyIntervalMin) || 60),
      },
      {
        key: OPTION_PREFIX + 'auto_create_channel',
        value: form.autoCreateChannel,
      },
      { key: OPTION_PREFIX + 'channel_group', value: form.channelGroup.trim() || 'default' },
      {
        key: OPTION_PREFIX + 'channel_weight',
        value: Math.max(0, Number(form.channelWeight) || 0),
      },
      { key: OPTION_PREFIX + 'channel_tag', value: form.channelTag.trim() },
      {
        key: OPTION_PREFIX + 'max_keys_per_user',
        value: Math.max(0, Number(form.maxKeysPerUser) || 0),
      },
      { key: OPTION_PREFIX + 'providers', value: form.providers },
    ]
    for (const item of updates) {
      await updateOption.mutateAsync(item)
    }
    setDirty(false)
  }

  return (
    <div className='space-y-4'>
      <Card className='gap-0 py-0'>
        <div className='border-border/60 flex items-center justify-between gap-3 border-b px-5 py-3.5'>
          <div>
            <h3 className='text-sm font-semibold'>
              {t('Reward rules')}
            </h3>
            <p className='text-muted-foreground mt-0.5 text-xs'>
              {t(
                'Configure how much quota a contributed upstream key grants, and when it is reset.'
              )}
            </p>
          </div>
          <Button onClick={handleSave} disabled={!dirty || updateOption.isPending}>
            {updateOption.isPending ? (
              <Spinner className='size-3.5' />
            ) : (
              <Save className='size-3.5' />
            )}
            {t('Save settings')}
          </Button>
        </div>
        <div className='px-5'>
          <Row
            label={t('Enable contributed keys')}
            description={t(
              'Allow users to submit upstream keys and receive extra daily quota.'
            )}
          >
            <Switch
              checked={form.enabled}
              onCheckedChange={(checked) => update('enabled', checked)}
            />
          </Row>
          <Row
            label={t('Reward per key (USD / day)')}
            description={t(
              'Quota granted for each available key, counted per day.'
            )}
          >
            <Input
              className='w-28 text-end'
              inputMode='decimal'
              value={form.rewardAmount}
              onChange={(event) => update('rewardAmount', event.target.value)}
            />
          </Row>
          <Row
            label={t('Daily cap (USD)')}
            description={t(
              'Maximum quota a single user can earn per day. Set 0 for no limit.'
            )}
          >
            <Input
              className='w-28 text-end'
              inputMode='decimal'
              value={form.dailyCapAmount}
              onChange={(event) => update('dailyCapAmount', event.target.value)}
            />
          </Row>
          <Row
            label={t('Count every key')}
            description={t(
              'On: every key stacks. Off: only distinct providers stack.'
            )}
          >
            <Switch
              checked={form.rewardPerKey}
              onCheckedChange={(checked) => update('rewardPerKey', checked)}
            />
          </Row>
          <Row
            label={t('Daily reset hour')}
            description={t(
              'Hour of the day when contributed quota is reclaimed and re-granted.'
            )}
          >
            <Input
              className='w-28 text-end'
              inputMode='numeric'
              value={form.resetHour}
              onChange={(event) => update('resetHour', event.target.value)}
            />
          </Row>
          <Row
            label={t('Verification interval (minutes)')}
            description={t(
              'How often contributed keys are re-verified in the background.'
            )}
          >
            <Input
              className='w-28 text-end'
              inputMode='numeric'
              value={form.verifyIntervalMin}
              onChange={(event) =>
                update('verifyIntervalMin', event.target.value)
              }
            />
          </Row>
          <Row
            label={t('Max keys per user')}
            description={t('Set 0 for no limit.')}
          >
            <Input
              className='w-28 text-end'
              inputMode='numeric'
              value={form.maxKeysPerUser}
              onChange={(event) => update('maxKeysPerUser', event.target.value)}
            />
          </Row>
        </div>
      </Card>

      <Card className='gap-0 py-0'>
        <div className='border-border/60 flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5'>
          <div>
            <h3 className='text-sm font-semibold'>{t('Seamless failover')}</h3>
            <p className='text-muted-foreground mt-0.5 text-xs'>
              {t(
                'Pooled calls rotate between keys. If the key in use fails, the request must be retried on another key so users never notice.'
              )}
            </p>
          </div>
          <Badge
            variant='outline'
            className={
              failoverReady
                ? 'border-success/40 bg-success/10 text-success'
                : 'border-warning/40 bg-warning/10 text-warning'
            }
          >
            {failoverReady
              ? t('Retries: {{count}}', { count: retryTimes })
              : t('Retries disabled')}
          </Badge>
        </div>
        <div className='flex flex-wrap items-center justify-between gap-3 px-5 py-4'>
          <p className='text-muted-foreground max-w-2xl text-xs leading-relaxed'>
            {failoverReady
              ? t(
                  'Failed requests are retried on another pooled key automatically.'
                )
              : t(
                  'Request retries are currently disabled, so a broken key would surface an error to the caller. Turn on retries to keep the pool transparent.'
                )}
          </p>
          {!failoverReady ? (
            <Button
              size='sm'
              disabled={updateOption.isPending}
              onClick={() =>
                updateOption.mutate({ key: 'RetryTimes', value: 2 })
              }
            >
              {updateOption.isPending ? (
                <Spinner className='size-3.5' />
              ) : (
                <AlertTriangle className='size-3.5' />
              )}
              {t('Enable retries (2 times)')}
            </Button>
          ) : null}
        </div>
      </Card>

      <Card className='gap-0 py-0'>
        <div className='border-border/60 border-b px-5 py-3.5'>
          <h3 className='text-sm font-semibold'>{t('Shared key pool')}</h3>
          <p className='text-muted-foreground mt-0.5 text-xs'>
            {t(
              'Verified keys are merged into one channel per provider and rotated in turn, so every user can call those models.'
            )}
          </p>
        </div>
        <div className='px-5'>
          <Row
            label={t('Add keys to the shared pool')}
            description={t('Off: keys are only verified and rewarded, nothing is pooled.')}
          >
            <Switch
              checked={form.autoCreateChannel}
              onCheckedChange={(checked) => update('autoCreateChannel', checked)}
            />
          </Row>
          <Row
            label={t('Pool group')}
            description={t('Group that pooled models are published to.')}
          >
            <Input
              className='w-40 text-end'
              value={form.channelGroup}
              onChange={(event) => update('channelGroup', event.target.value)}
            />
          </Row>
          <Row label={t('Channel weight')}>
            <Input
              className='w-28 text-end'
              inputMode='numeric'
              value={form.channelWeight}
              onChange={(event) => update('channelWeight', event.target.value)}
            />
          </Row>
          <Row
            label={t('Pool tag prefix')}
            description={t(
              'Internal tag used to locate the pooled channel, e.g. contributed-pool:sensenova. Changing it rebuilds the pool.'
            )}
          >
            <Input
              className='w-40 text-end'
              value={form.channelTag}
              onChange={(event) => update('channelTag', event.target.value)}
            />
          </Row>
        </div>
      </Card>

      <Card className='gap-0 py-0'>
        <div className='border-border/60 border-b px-5 py-3.5'>
          <h3 className='text-sm font-semibold'>{t('Providers')}</h3>
          <p className='text-muted-foreground mt-0.5 text-xs'>
            {t(
              'Define which upstream providers users can contribute keys for. Users never type an API address.'
            )}
          </p>
        </div>
        <div className='space-y-3 px-5 py-4'>
          <JsonCodeEditor
            value={form.providers}
            onChange={(value) => update('providers', value)}
            heightClassName='h-64 min-h-64 max-h-64'
          />
          <div className='text-muted-foreground space-y-1 text-xs leading-relaxed'>
            <p>
              {t(
                'Fields: key, name, base_url, channel_type, verify_model, models, models_endpoint, chat_endpoint, docs_url, enabled, description.'
              )}
            </p>
            <p>
              {t(
                'A built-in preset for SimSun SenseNova already points at its OpenAI compatible endpoint, so users only paste their key.'
              )}
            </p>
          </div>
          <div className='flex justify-end'>
            <Button
              onClick={handleSave}
              disabled={!dirty || updateOption.isPending}
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
      </Card>

      <p className='text-muted-foreground px-1 text-xs'>
        {t(
          'Option keys are stored as contributed_key_setting.* and take effect immediately without a restart.'
        )}
      </p>
    </div>
  )
}
