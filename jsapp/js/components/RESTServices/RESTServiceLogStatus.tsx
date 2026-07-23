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

/**
 * The "Status" cell for a single row in the REST Service logs table. It shows a
 * colored status label (Success, Pending, Failed, …) and, depending on the
 * status, action buttons: a retry button for failed logs and an info button for
 * anything that has a message to show.
 *
 * It's a presentational component: the actual retrying and info-displaying live
 * in the parent, which passes them in as the `onRetry` / `onShowInfo` callbacks.
 */
export default function RESTServiceLogStatus({ log, isHookActive, onRetry, onShowInfo }: RESTServiceLogStatusProps) {
  // Pick the label text and color based on the log's status. Colors use Kobo's
  // theme palette (e.g. `teal.4`, `red.6`) rather than raw hex values.
  let statusColor = 'gray.2'
  let statusLabel = ''
  if (log.status === HOOK_LOG_STATUSES.SUCCESS) {
    statusLabel = t('Success')
  }
  if (log.status === HOOK_LOG_STATUSES.PENDING) {
    statusColor = 'teal.4'
    statusLabel = t('Pending')
    // If we've already tried more than once, show the attempt count.
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

  // Successful logs have nothing worth explaining, and empty messages have
  // nothing to show — so only offer the info button when there's real content.
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
