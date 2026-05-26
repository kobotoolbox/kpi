import React from 'react'
import Alert from '#/components/common/alert'

interface BulkProcessingBannerProps {
  activeBulkActionsCount: number
  isVisible: boolean
}

/**
 * Displays an informational banner when active bulk processing is running in
 * the table and at least one job was created by another user.
 */
export default function BulkProcessingBanner(props: BulkProcessingBannerProps) {
  // Guard early so parent can pass values safely without extra conditionals.
  if (!props.isVisible || props.activeBulkActionsCount < 1) {
    return null
  }

  // Use separate messages for singular vs plural to keep translations simple.
  const message =
    props.activeBulkActionsCount === 1
      ? t('Changes may occur in the data table due to ongoing bulk job')
      : t('Changes may occur in the data table due to ongoing ##COUNT## bulk jobs').replace(
          '##COUNT##',
          String(props.activeBulkActionsCount),
        )

  return (
    // We wrap it in a div to avoid flexbox squashing the content.
    <div>
      <Alert type='info' iconName='information' mt='md' ml={0} mr={0}>
        {message}
      </Alert>
    </div>
  )
}
