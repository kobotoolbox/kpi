import { Stack } from '@mantine/core'
import React from 'react'
import Alert from '#/components/common/alert'
import type { ActiveAlert } from './types'

interface BulkProcessingAlertsProps {
  /** Active alerts to display */
  activeAlerts: ActiveAlert[]
}

/**
 * Bulk Processing Alerts Display Component
 *
 * Pure presentation component that renders active alerts.
 * No validation logic - that's handled by the useBulkProcessingAlerts hook.
 *
 * @example
 * ```tsx
 * const { activeAlerts } = useBulkProcessingAlerts({...});
 * <BulkProcessingAlerts activeAlerts={activeAlerts} />
 * ```
 */
export default function BulkProcessingAlerts(props: BulkProcessingAlertsProps) {
  const { activeAlerts } = props

  // Don't render anything if no alerts
  if (activeAlerts.length === 0) {
    return null
  }

  return (
    <Stack gap='sm'>
      {activeAlerts.map((alert) => (
        <Alert key={alert.id} type={alert.type} iconName={alert.type === 'error' ? 'alert' : 'warning'}>
          {alert.message}
        </Alert>
      ))}
    </Stack>
  )
}
