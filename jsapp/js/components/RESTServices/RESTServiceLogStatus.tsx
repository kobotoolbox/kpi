import { Group, Text } from '@mantine/core'
import { IconInfoCircle, IconRefresh } from '@tabler/icons-react'
import ActionIcon from '#/components/common/ActionIcon'
import { HOOK_LOG_STATUSES } from '#/constants'
import type { ExternalServiceLogResponse } from '#/dataInterface'

interface RESTServiceLogStatusProps {
  log: ExternalServiceLogResponse
  isHookActive: boolean
  onRetry: (log: ExternalServiceLogResponse) => void
  onShowInfo: (log: ExternalServiceLogResponse) => void
}

export default function RESTServiceLogStatus({ log, isHookActive, onRetry, onShowInfo }: RESTServiceLogStatusProps) {
  let statusColor = 'gray.2'
  let statusLabel = ''
  if (log.status === HOOK_LOG_STATUSES.SUCCESS) {
    statusLabel = t('Success')
  }
  if (log.status === HOOK_LOG_STATUSES.PENDING) {
    statusColor = 'teal.4'
    statusLabel = t('Pending')
    if (log.tries && log.tries > 1) {
      statusLabel = t('Pending (##count##×)').replace('##count##', String(log.tries))
    }
  }
  if (log.status === HOOK_LOG_STATUSES.FAILED) {
    statusColor = 'red.6'
    statusLabel = t('Failed')
  }
  if (log.status === HOOK_LOG_STATUSES.PROCESSING) {
    statusLabel = t('Processing')
  }

  const hasInfoToDisplay = log.status !== HOOK_LOG_STATUSES.SUCCESS && log.message.length > 0

  return (
    <Group gap='xs' wrap='nowrap'>
      <Text c={statusColor} span>
        {statusLabel}
      </Text>

      {log.status === HOOK_LOG_STATUSES.FAILED && (
        <ActionIcon
          variant='transparent'
          size='md'
          icon={IconRefresh}
          disabled={!isHookActive}
          onClick={() => onRetry(log)}
          tooltip={t('Retry submission')}
        />
      )}

      {hasInfoToDisplay && (
        <ActionIcon
          variant='transparent'
          size='md'
          icon={IconInfoCircle}
          onClick={() => onShowInfo(log)}
          tooltip={t('More info')}
        />
      )}
    </Group>
  )
}
