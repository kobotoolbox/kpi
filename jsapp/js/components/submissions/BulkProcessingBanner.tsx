import React, { useEffect, useState } from 'react'
import Alert from '#/components/common/alert'
import { useSafeUsernameStorageKey } from '#/hooks/useSafeUsernameStorageKey'

interface BulkProcessingBannerProps {
  assetUid: string
  currentUsername: string | undefined
  activeBulkActionsCount: number
  hasActiveBulkActionsCreatedByAnotherUser: boolean
}

const BANNER_DISMISSAL_VALUE = 'dismissed'

/**
 * Displays an informational banner when active bulk processing is running in
 * the table and at least one job was created by another user.
 */
export default function BulkProcessingBanner(props: BulkProcessingBannerProps) {
  const storageKey = useSafeUsernameStorageKey(`kpiBulkProcessingBanner-${props.assetUid}`, props.currentUsername || '')
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean | undefined>()

  useEffect(() => {
    const bannerStatus = storageKey && sessionStorage.getItem(storageKey)
    setIsBannerDismissed(bannerStatus === BANNER_DISMISSAL_VALUE)
  }, [storageKey])

  function handleCloseBanner() {
    if (!storageKey) {
      return
    }
    sessionStorage.setItem(storageKey, BANNER_DISMISSAL_VALUE)
    setIsBannerDismissed(true)
  }

  // Guard early so parent can pass values safely without extra conditionals.
  if (
    !props.currentUsername ||
    !props.hasActiveBulkActionsCreatedByAnotherUser ||
    props.activeBulkActionsCount < 1 ||
    isBannerDismissed === undefined ||
    isBannerDismissed
  ) {
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
      <Alert
        type='info'
        iconName='information'
        p='md'
        withCloseButton
        closeButtonLabel={t('Dismiss banner')}
        onClose={handleCloseBanner}
      >
        {message}
      </Alert>
    </div>
  )
}
