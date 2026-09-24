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
import {
  Info,
  KeyRound,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { PasswordInput } from '@/components/password-input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatQuota, formatTimestampToDate } from '@/lib/format'

import { contributedReasonKey } from '../constants'
import {
  useAddContributedKey,
  useDeleteSelfContributedKey,
  useSelfContributedKeys,
  useVerifySelfContributedKey,
} from '../hooks/use-contributed-keys'
import type { ContributedKeyItem } from '../types'
import { ContributedKeyStatusBadge } from './status-badge'

function StatTile(props: { label: string; value: string; hint?: string }) {
  return (
    <div className='border-border/60 bg-muted/20 rounded-xl border px-4 py-3'>
      <div className='text-muted-foreground text-xs'>{props.label}</div>
      <div className='mt-1 text-lg font-semibold tracking-tight'>
        {props.value}
      </div>
      {props.hint ? (
        <div className='text-muted-foreground/70 mt-0.5 text-[11px]'>
          {props.hint}
        </div>
      ) : null}
    </div>
  )
}

export function MyContributionPanel() {
  const { t } = useTranslation()
  const query = useSelfContributedKeys()
  const addMutation = useAddContributedKey()
  const deleteMutation = useDeleteSelfContributedKey()
  const verifyMutation = useVerifySelfContributedKey()

  const [provider, setProvider] = useState('')
  const [keyValue, setKeyValue] = useState('')
  const [remark, setRemark] = useState('')
  const [pendingDelete, setPendingDelete] = useState<ContributedKeyItem | null>(
    null
  )

  const data = query.data?.data
  const providers = data?.providers ?? []
  const keys = data?.keys ?? []
  const setting = data?.setting
  const summary = data?.summary

  const activeProvider = useMemo(() => {
    if (provider) return provider
    return providers[0]?.key ?? ''
  }, [provider, providers])

  const activeDocsUrl = useMemo(
    () => providers.find((item) => item.key === activeProvider)?.docs_url ?? '',
    [providers, activeProvider]
  )

  const rewardText = setting ? formatQuota(setting.reward_quota) : '-'
  const capText = setting?.daily_cap_quota
    ? formatQuota(setting.daily_cap_quota)
    : t('Unlimited')
  const resetText = String(setting?.reset_hour ?? 0).padStart(2, '0')

  const handleSubmit = async () => {
    const trimmed = keyValue.trim()
    if (!activeProvider || !trimmed) return
    try {
      await addMutation.mutateAsync({
        provider: activeProvider,
        key: trimmed,
        remark: remark.trim() || undefined,
      })
      setKeyValue('')
      setRemark('')
    } catch {
      // 错误提示已在 mutation 中处理
    }
  }

  if (query.isLoading) {
    return (
      <div className='text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm'>
        <Spinner />
        {t('Loading...')}
      </div>
    )
  }

  if (data && !data.enabled) {
    return (
      <Alert>
        <Info className='size-4' />
        <AlertDescription>
          {t(
            'The contributed upstream key program is currently disabled. Please contact the administrator.'
          )}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
        <StatTile
          label={t('Quota earned today')}
          value={summary ? formatQuota(summary.today_quota) : '-'}
          hint={summary?.today_date}
        />
        <StatTile
          label={t('Available keys')}
          value={`${summary?.valid_count ?? 0}`}
          hint={t('{{count}} counted for reward', {
            count: summary?.valid_units ?? 0,
          })}
        />
        <StatTile
          label={t('Pending verification')}
          value={`${summary?.pending_count ?? 0}`}
        />
        <StatTile
          label={t('Unavailable keys')}
          value={`${summary?.invalid_count ?? 0}`}
          hint={t('Total submitted: {{count}}', {
            count: summary?.total_count ?? 0,
          })}
        />
      </div>

      <Card className='gap-0 overflow-hidden py-0'>
        <div className='border-border/60 border-b px-5 py-4'>
          <div className='flex items-start gap-3'>
            <div className='bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg'>
              <KeyRound className='size-4' />
            </div>
            <div className='min-w-0'>
              <h3 className='text-sm font-semibold'>
                {t('Contribute upstream key')}
              </h3>
              <p className='text-muted-foreground mt-0.5 text-xs leading-relaxed'>
                {t(
                  'Share an upstream provider key to raise your daily quota. Paste the key only — everything else is handled for you.'
                )}
              </p>
            </div>
          </div>
          <div className='mt-3 flex flex-wrap items-center gap-1.5'>
            <Badge variant='outline' className='gap-1'>
              <Sparkles className='size-3' />
              {t('{{reward}} per key / day', { reward: rewardText })}
            </Badge>
            <Badge variant='outline'>
              {t('Daily cap {{cap}}', { cap: capText })}
            </Badge>
            {setting ? (
              <Badge variant='outline'>
                {t('Resets daily at {{hour}}:00', { hour: resetText })}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className='space-y-4 px-5 py-4'>
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='contributed-provider'>{t('Provider')}</Label>
              <Select
                value={activeProvider}
                onValueChange={(value) => setProvider(String(value ?? ''))}
              >
                <SelectTrigger id='contributed-provider' className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((item) => (
                    <SelectItem key={item.key} value={item.key}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeDocsUrl ? (
                <p className='text-muted-foreground text-xs'>
                  {t('Get your key here:')}{' '}
                  <a
                    className='text-primary hover:underline'
                    href={activeDocsUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    {activeDocsUrl}
                  </a>
                </p>
              ) : null}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='contributed-key'>{t('Upstream key')}</Label>
              <PasswordInput
                id='contributed-key'
                value={keyValue}
                onChange={(event) => setKeyValue(event.target.value)}
                placeholder='sk-...'
                autoComplete='off'
                spellCheck={false}
              />
              <p className='text-muted-foreground text-xs'>
                {t('Only the key is required, no other configuration.')}
              </p>
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='contributed-remark'>{t('Note (optional)')}</Label>
            <Input
              id='contributed-remark'
              value={remark}
              maxLength={120}
              onChange={(event) => setRemark(event.target.value)}
              placeholder={t('e.g. shared from my personal plan')}
            />
          </div>

          <div className='space-y-2'>
            <div className='flex items-center gap-2'>
              <Button
                onClick={handleSubmit}
                disabled={
                  addMutation.isPending || !activeProvider || !keyValue.trim()
                }
              >
                {addMutation.isPending ? <Spinner /> : null}
                {t('Submit & verify')}
              </Button>
              <span className='text-muted-foreground text-xs'>
                {t(
                  'The key is verified against the provider immediately after submission.'
                )}
              </span>
            </div>
            <p className='text-muted-foreground/80 flex items-start gap-1.5 text-xs leading-relaxed'>
              <ShieldCheck className='mt-0.5 size-3.5 shrink-0' />
              {t(
                'By submitting you agree that the key is used to serve model calls for this site. It is never shown to other users.'
              )}
            </p>
          </div>
        </div>
      </Card>

      {summary && summary.providers.length > 0 ? (
        <Card className='gap-0 overflow-hidden py-0'>
          <div className='border-border/60 border-b px-5 py-3.5'>
            <h3 className='text-sm font-semibold'>{t('Daily quota by provider')}</h3>
            <p className='text-muted-foreground mt-0.5 text-xs'>
              {summary.capped
                ? t(
                    'The daily cap is reached, extra keys no longer raise today quota.'
                  )
                : t('Quota is granted per available key and resets every day.')}
            </p>
          </div>
          <div className='grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3'>
            {summary.providers.map((item) => (
              <div
                key={item.provider}
                className='border-border/60 bg-muted/15 rounded-xl border px-4 py-3'
              >
                <div className='flex items-center justify-between gap-2'>
                  <span className='truncate text-sm font-medium'>
                    {item.provider_name}
                  </span>
                  <span className='text-sm font-semibold tabular-nums'>
                    {formatQuota(item.quota)}
                  </span>
                </div>
                <div className='text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]'>
                  <span>
                    {t('{{count}} available keys', {
                      count: item.valid_count,
                    })}
                  </span>
                  <span>
                    {t('{{reward}} per key', {
                      reward: formatQuota(item.reward_quota),
                    })}
                  </span>
                  <span>
                    {t('Resets daily at {{hour}}:00', {
                      hour: String(item.reset_hour).padStart(2, '0'),
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card className='gap-0 overflow-hidden py-0'>
        <div className='border-border/60 border-b px-5 py-3.5'>
          <h3 className='text-sm font-semibold'>{t('My contributed keys')}</h3>
          <p className='text-muted-foreground mt-0.5 text-xs'>
            {t(
              'Unavailable keys are removed from your daily quota automatically.'
            )}
          </p>
        </div>
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Provider')}</TableHead>
                <TableHead>{t('Key')}</TableHead>
                <TableHead>{t('Status')}</TableHead>
                <TableHead>{t('Last verified')}</TableHead>
                <TableHead className='text-end'>{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className='text-muted-foreground py-10 text-center text-sm'
                  >
                    {t('No keys contributed yet.')}
                  </TableCell>
                </TableRow>
              ) : (
                keys.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className='font-medium'>
                      {item.provider_name}
                    </TableCell>
                    <TableCell className='font-mono text-xs'>
                      {item.key_masked}
                    </TableCell>
                    <TableCell>
                      <div className='flex flex-col gap-1'>
                        <ContributedKeyStatusBadge
                          status={item.status}
                          enabled={item.enabled}
                        />
                        {item.status !== 1 && item.reason_code ? (
                          <span className='text-muted-foreground max-w-60 truncate text-[11px]'>
                            {t(contributedReasonKey(item.reason_code))}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className='text-muted-foreground text-xs'>
                      {item.last_verify_time
                        ? formatTimestampToDate(item.last_verify_time)
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center justify-end gap-1'>
                        <Button
                          size='sm'
                          variant='ghost'
                          disabled={verifyMutation.isPending}
                          onClick={() => verifyMutation.mutate(item.id)}
                        >
                          <RotateCw className='size-3.5' />
                          {t('Re-verify')}
                        </Button>
                        <Button
                          size='sm'
                          variant='ghost'
                          className='text-destructive hover:text-destructive'
                          onClick={() => setPendingDelete(item)}
                        >
                          <Trash2 className='size-3.5' />
                          {t('Remove')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className='gap-0 py-0'>
        <div className='border-border/60 border-b px-5 py-3.5'>
          <h3 className='text-sm font-semibold'>{t('How it works')}</h3>
        </div>
        <ol className='text-muted-foreground space-y-2 px-5 py-4 text-xs leading-relaxed'>
          <li className='flex gap-2'>
            <span className='text-foreground font-semibold'>1.</span>
            {t(
              'Submit a valid upstream key. The system verifies it against the provider right away.'
            )}
          </li>
          <li className='flex gap-2'>
            <span className='text-foreground font-semibold'>2.</span>
            {t(
              'Every available key adds {{reward}} to your quota for the day.',
              { reward: rewardText }
            )}
          </li>
          <li className='flex gap-2'>
            <span className='text-foreground font-semibold'>3.</span>
            {t(
              'Contributed quota is reset every day at {{hour}}:00, and re-granted for keys that are still available.',
              { hour: resetText }
            )}
          </li>
          <li className='flex gap-2'>
            <span className='text-foreground font-semibold'>4.</span>
            {t(
              'Keys are checked periodically. If a key stops working, the quota it granted is reclaimed automatically.'
            )}
          </li>
          <li className='flex gap-2'>
            <span className='text-foreground font-semibold'>5.</span>
            {t(
              'Use the key you created on the API Keys page to call models.'
            )}
          </li>
        </ol>
      </Card>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title={t('Remove this key?')}
        desc={t(
          'The key will stop being used for shared calls and its quota will be reclaimed.'
        )}
        confirmText={t('Remove')}
        destructive
        isLoading={deleteMutation.isPending}
        handleConfirm={() => {
          if (!pendingDelete) return
          deleteMutation.mutate(pendingDelete.id)
          setPendingDelete(null)
        }}
      />
    </div>
  )
}
