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
import { AlertCircle, CheckCircle2, Clock, Ban } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import type { ContributedKeyStatus } from '../types'

const STATUS_STYLES: Record<ContributedKeyStatus, string> = {
  0: 'border-warning/40 bg-warning/10 text-warning',
  1: 'border-success/40 bg-success/10 text-success',
  2: 'border-destructive/40 bg-destructive/10 text-destructive',
}

const STATUS_LABELS: Record<ContributedKeyStatus, string> = {
  0: 'Pending verification',
  1: 'Available',
  2: 'Unavailable',
}

type Props = {
  status: ContributedKeyStatus
  enabled?: boolean
  className?: string
}

/** 贡献 Key 的状态徽章：待验证 / 可用 / 不可用（停用会额外标注） */
export function ContributedKeyStatusBadge(props: Props) {
  const { t } = useTranslation()

  if (props.enabled === false) {
    return (
      <Badge
        variant='outline'
        className={cn(
          'border-muted-foreground/30 bg-muted text-muted-foreground gap-1',
          props.className
        )}
      >
        <Ban className='size-3' />
        {t('Disabled')}
      </Badge>
    )
  }

  const icon =
    props.status === 1 ? (
      <CheckCircle2 className='size-3' />
    ) : props.status === 2 ? (
      <AlertCircle className='size-3' />
    ) : (
      <Clock className='size-3' />
    )

  return (
    <Badge
      variant='outline'
      className={cn(STATUS_STYLES[props.status], 'gap-1', props.className)}
    >
      {icon}
      {t(STATUS_LABELS[props.status])}
    </Badge>
  )
}
