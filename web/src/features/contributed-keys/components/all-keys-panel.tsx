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
  ChevronLeft,
  ChevronRight,
  Power,
  RefreshCw,
  RotateCw,
  Search,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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

import {
  useAllContributedKeys,
  useContributedKeyStats,
  useDeleteContributedKey,
  useRecalculateContributedQuota,
  useSelfContributedKeys,
  useUpdateContributedKey,
  useVerifyContributedKeys,
} from '../hooks/use-contributed-keys'
import type { ContributedKeyAdminItem } from '../types'
import { ContributedKeyStatusBadge } from './status-badge'

const PAGE_SIZE = 20

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

export function AllKeysPanel() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [provider, setProvider] = useState('')
  const [status, setStatus] = useState('')
  const [keyword, setKeyword] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [pendingDelete, setPendingDelete] =
    useState<ContributedKeyAdminItem | null>(null)

  const statsQuery = useContributedKeyStats(true)
  const listQuery = useAllContributedKeys(
    {
      page,
      pageSize: PAGE_SIZE,
      provider,
      status,
      keyword: searchTerm,
    },
    true
  )
  const providerQuery = useSelfContributedKeys()

  const verifyMutation = useVerifyContributedKeys()
  const updateMutation = useUpdateContributedKey()
  const deleteMutation = useDeleteContributedKey()
  const recalcMutation = useRecalculateContributedQuota()

  const stats = statsQuery.data?.data
  const pools = stats?.pools ?? []
  const failoverReady = (stats?.retry_times ?? 0) > 0
  const pageData = listQuery.data
  const items = pageData?.items ?? []
  const total = pageData?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const providerOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of providerQuery.data?.data.providers ?? []) {
      map.set(item.key, item.name)
    }
    for (const item of items) {
      if (!map.has(item.provider)) {
        map.set(item.provider, item.provider_name)
      }
    }
    return Array.from(map.entries())
  }, [providerQuery.data, items])

  const busy =
    verifyMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    recalcMutation.isPending

  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-2 gap-3 lg:grid-cols-5'>
        <StatTile label={t('Total keys')} value={`${stats?.total ?? 0}`} />
        <StatTile label={t('Available')} value={`${stats?.valid ?? 0}`} />
        <StatTile label={t('Unavailable')} value={`${stats?.invalid ?? 0}`} />
        <StatTile
          label={t('Pending verification')}
          value={`${stats?.pending ?? 0}`}
        />
        <StatTile
          label={t('Quota granted today')}
          value={stats ? formatQuota(stats.today_quota) : '-'}
          hint={stats?.today_grant_date}
        />
      </div>

      {pools.length > 0 ? (
        <Card className='gap-0 overflow-hidden py-0'>
          <div className='border-border/60 border-b px-4 py-3'>
            <h3 className='text-sm font-semibold'>{t('Shared key pools')}</h3>
            <p className='text-muted-foreground mt-0.5 text-xs'>
              {t(
                'Each provider is served by one pooled channel that rotates through every contributed key. A failing key is skipped instantly and re-tested later.'
              )}
            </p>
          </div>
          <div className='grid gap-3 px-4 py-3.5 sm:grid-cols-2 lg:grid-cols-3'>
            {!failoverReady ? (
              <Alert variant='destructive' className='sm:col-span-2 lg:col-span-3'>
                <AlertDescription>
                  {t(
                    'Request retries are disabled, so a failing pooled key would surface an error to callers. Enable retries in the Settings tab.'
                  )}
                </AlertDescription>
              </Alert>
            ) : null}
            {pools.map((pool) => (
              <div
                key={pool.provider}
                className='border-border/60 bg-muted/15 rounded-xl border px-4 py-3'
              >
                <div className='flex items-center justify-between gap-2'>
                  <span className='truncate text-sm font-medium'>
                    {pool.provider_name}
                  </span>
                  <Badge
                    variant='outline'
                    className={
                      pool.circuit_broken
                        ? 'border-destructive/40 bg-destructive/10 text-destructive'
                        : 'border-success/40 bg-success/10 text-success'
                    }
                  >
                    {pool.circuit_broken ? t('Disabled') : t('Running')}
                  </Badge>
                </div>
                <div className='text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]'>
                  <span>{t('{{count}} keys in pool', { count: pool.key_count })}</span>
                  {pool.disabled_keys > 0 ? (
                    <span className='text-warning'>
                      {t('{{count}} skipped', { count: pool.disabled_keys })}
                    </span>
                  ) : null}
                  <span>{t('{{count}} models', { count: pool.model_count })}</span>
                  {pool.channel_id > 0 ? (
                    <span>{t('Channel #{{id}}', { id: pool.channel_id })}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card className='gap-0 overflow-hidden py-0'>
        <div className='border-border/60 flex flex-wrap items-center gap-2 border-b px-4 py-3'>
          <div className='relative'>
            <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2' />
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setPage(1)
                  setSearchTerm(keyword)
                }
              }}
              placeholder={t('Search user, provider or note')}
              className='h-8 w-56 pl-8'
            />
          </div>
          <Select
            value={provider || 'all'}
            onValueChange={(value) => {
              setPage(1)
              setProvider(value === 'all' ? '' : String(value ?? ''))
            }}
          >
            <SelectTrigger size='sm' className='min-w-32'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>{t('All providers')}</SelectItem>
              {providerOptions.map(([key, name]) => (
                <SelectItem key={key} value={key}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status || 'all'}
            onValueChange={(value) => {
              setPage(1)
              setStatus(value === 'all' ? '' : String(value ?? ''))
            }}
          >
            <SelectTrigger size='sm' className='min-w-32'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>{t('All statuses')}</SelectItem>
              <SelectItem value='1'>{t('Available')}</SelectItem>
              <SelectItem value='2'>{t('Unavailable')}</SelectItem>
              <SelectItem value='0'>{t('Pending verification')}</SelectItem>
              <SelectItem value='enabled'>{t('Enabled')}</SelectItem>
              <SelectItem value='disabled'>{t('Disabled')}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size='sm'
            variant='outline'
            onClick={() => {
              setPage(1)
              setSearchTerm(keyword)
              listQuery.refetch()
              statsQuery.refetch()
            }}
          >
            <RefreshCw className='size-3.5' />
            {t('Refresh')}
          </Button>
          <div className='ms-auto flex items-center gap-2'>
            <Button
              size='sm'
              variant='outline'
              disabled={busy}
              onClick={() => verifyMutation.mutate(undefined)}
            >
              <RotateCw className='size-3.5' />
              {t('Verify a batch')}
            </Button>
            <Button
              size='sm'
              variant='outline'
              disabled={busy}
              onClick={() => recalcMutation.mutate()}
            >
              {t('Recalculate quota')}
            </Button>
          </div>
        </div>

        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-16'>ID</TableHead>
                <TableHead>{t('User')}</TableHead>
                <TableHead>{t('Provider')}</TableHead>
                <TableHead>{t('Key')}</TableHead>
                <TableHead>{t('Status')}</TableHead>
                <TableHead>{t('Models')}</TableHead>
                <TableHead>{t('Last verified')}</TableHead>
                <TableHead className='text-end'>{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className='py-10 text-center'>
                    <Spinner className='mx-auto' />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className='text-muted-foreground py-10 text-center text-sm'
                  >
                    {t('No contributed keys found.')}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className='text-muted-foreground font-mono text-xs'>
                      {item.id}
                    </TableCell>
                    <TableCell className='font-medium'>
                      {item.username || `#${item.user_id}`}
                    </TableCell>
                    <TableCell>{item.provider_name}</TableCell>
                    <TableCell className='font-mono text-xs'>
                      {item.key_masked}
                    </TableCell>
                    <TableCell>
                      <div className='flex flex-col gap-1'>
                        <ContributedKeyStatusBadge
                          status={item.status}
                          enabled={item.enabled}
                        />
                        {item.message && item.status !== 1 ? (
                          <span
                            className='text-muted-foreground max-w-56 truncate text-[11px]'
                            title={item.message}
                          >
                            {item.message}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className='text-muted-foreground text-xs'>
                      {item.models.length > 0 ? item.models.length : '-'}
                    </TableCell>
                    <TableCell className='text-muted-foreground text-xs'>
                      {formatTimestampToDate(item.last_verify_time)}
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center justify-end gap-1'>
                        <Button
                          size='sm'
                          variant='ghost'
                          disabled={busy}
                          onClick={() => verifyMutation.mutate([item.id])}
                        >
                          <RotateCw className='size-3.5' />
                          {t('Verify')}
                        </Button>
                        <Button
                          size='sm'
                          variant='ghost'
                          disabled={busy}
                          onClick={() =>
                            updateMutation.mutate({
                              id: item.id,
                              values: { enabled: !item.enabled },
                            })
                          }
                        >
                          <Power className='size-3.5' />
                          {item.enabled ? t('Disable') : t('Enable')}
                        </Button>
                        <Button
                          size='sm'
                          variant='ghost'
                          className='text-destructive hover:text-destructive'
                          onClick={() => setPendingDelete(item)}
                        >
                          <Trash2 className='size-3.5' />
                          {t('Delete')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className='border-border/60 flex items-center justify-between border-t px-4 py-2.5 text-xs'>
          <span className='text-muted-foreground'>
            {t('Total {{total}} records', { total })}
          </span>
          <div className='flex items-center gap-2'>
            <Button
              size='sm'
              variant='outline'
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              <ChevronLeft className='size-3.5' />
            </Button>
            <span className='text-muted-foreground'>
              {page} / {totalPages}
            </span>
            <Button
              size='sm'
              variant='outline'
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              <ChevronRight className='size-3.5' />
            </Button>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title={t('Delete this key?')}
        desc={t(
          'The record will be deleted, the key removed from the shared pool, and the owner quota reclaimed.'
        )}
        confirmText={t('Delete')}
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
