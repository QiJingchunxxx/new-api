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
import { ArrowRight, Gift, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useSelfContributedKeys } from '@/features/contributed-keys/hooks/use-contributed-keys'
import { formatQuota } from '@/lib/format'

/**
 * 钱包页「每日额度」卡片。
 *
 * 展示用户通过贡献上游 Key 获得的每日额度：按供应商分开展示额度、可用 Key 数量
 * 与重置时刻。只展示额度结果，不展示任何 Key 内容或上游信息。
 */
export function DailyQuotaCard() {
  const { t } = useTranslation()
  const query = useSelfContributedKeys()
  const data = query.data?.data

  if (query.isLoading) {
    return (
      <Card className='items-center justify-center py-8'>
        <Spinner />
      </Card>
    )
  }

  if (!data?.enabled) {
    return null
  }

  const summary = data.summary
  const providers = summary?.providers ?? []
  const resetHour = String(summary?.reset_hour ?? data.setting.reset_hour).padStart(
    2,
    '0'
  )

  return (
    <Card className='gap-0 overflow-hidden py-0'>
      <div className='border-border/60 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-5'>
        <div className='flex items-start gap-3'>
          <div className='bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg'>
            <Gift className='size-4' />
          </div>
          <div>
            <h3 className='text-sm font-semibold'>{t('Daily quota')}</h3>
            <p className='text-muted-foreground mt-0.5 text-xs'>
              {t(
                'Earned by contributing upstream keys, reset automatically every day.'
              )}
            </p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          {summary ? (
            <Badge variant='outline' className='gap-1'>
              <RefreshCw className='size-3' />
              {t('Resets at {{hour}}:00', { hour: resetHour })}
            </Badge>
          ) : null}
          <Button size='sm' variant='outline' render={<Link to='/contributed-keys' />}>
            {t('Manage keys')}
            <ArrowRight className='ms-1 size-3.5' />
          </Button>
        </div>
      </div>

      {providers.length === 0 ? (
        <div className='flex flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-5'>
          <p className='text-muted-foreground text-sm'>
            {t(
              'No contributed keys yet. Share an upstream key to raise your daily quota.'
            )}
          </p>
          <Button size='sm' render={<Link to='/contributed-keys' />}>
            {t('Contribute a key')}
            <ArrowRight className='ms-1 size-3.5' />
          </Button>
        </div>
      ) : (
        <>
          <div className='grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-3'>
            {providers.map((item) => (
              <div
                key={item.provider}
                className='border-border/60 bg-muted/15 rounded-xl border px-4 py-3'
              >
                <div className='flex items-start justify-between gap-2'>
                  <div className='min-w-0'>
                    <div className='truncate text-sm font-medium'>
                      {t('{{provider}} daily quota', {
                        provider: item.provider_name,
                      })}
                    </div>
                    <div className='text-muted-foreground mt-0.5 text-[11px]'>
                      {t('{{reward}} per key', {
                        reward: formatQuota(item.reward_quota),
                      })}
                    </div>
                  </div>
                  <div className='text-lg font-semibold tracking-tight tabular-nums'>
                    {formatQuota(item.quota)}
                  </div>
                </div>
                <div className='border-border/50 mt-3 grid grid-cols-3 gap-2 border-t pt-2.5 text-center'>
                  <div>
                    <div className='text-xs font-semibold tabular-nums'>
                      {item.valid_count}
                    </div>
                    <div className='text-muted-foreground mt-0.5 text-[10px]'>
                      {t('Available')}
                    </div>
                  </div>
                  <div>
                    <div className='text-xs font-semibold tabular-nums'>
                      {item.pending_count}
                    </div>
                    <div className='text-muted-foreground mt-0.5 text-[10px]'>
                      {t('Pending')}
                    </div>
                  </div>
                  <div>
                    <div className='text-xs font-semibold tabular-nums'>
                      {item.invalid_count}
                    </div>
                    <div className='text-muted-foreground mt-0.5 text-[10px]'>
                      {t('Unavailable')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className='border-border/60 text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-xs sm:px-5'>
            <span>
              {t('Granted today: {{quota}}', {
                quota: formatQuota(summary?.today_quota ?? 0),
              })}
            </span>
            <span>
              {summary?.capped
                ? t('Daily cap reached ({{cap}})', {
                    cap: formatQuota(summary.daily_cap_quota),
                  })
                : t('Daily cap {{cap}}', {
                    cap: formatQuota(summary?.daily_cap_quota ?? 0),
                  })}
            </span>
          </div>
        </>
      )}
    </Card>
  )
}
