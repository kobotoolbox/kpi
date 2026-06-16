import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import Alert from '#/components/common/alert'
import { useSafeUsernameStorageKey } from '#/hooks/useSafeUsernameStorageKey'
import { ROUTES } from '#/router/routerConstants'

interface BulkProcessingBannerProps {
  assetUid: string
  currentUsername: string | undefined
  activeBulkActions: BulkActionResponse[]
  hasActiveBulkActionsCreatedByCurrentUser: boolean
}

const BANNER_DISMISSAL_VALUE = 'dismissed'

/**
 * Displays an informational banner when active bulk processing is running in
 * the table. Shows for all users, with an additional link to activity log
 * for users who created a bulk job themselves.
 */
export default function BulkProcessingBanner(props: BulkProcessingBannerProps) {
  const activeBulkActionsCount = props.activeBulkActions.length
  const storageKey = useSafeUsernameStorageKey(`kpiBulkProcessingBanner-${props.assetUid}`, props.currentUsername || '')
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean | undefined>()
  const [lastSeenBulkActionCount, setLastSeenBulkActionCount] = useState<number>(0)

  // Load dismissal state from session storage on mount.
  // We hash the username before using it as a storage key to avoid leaking PII.
  useEffect(() => {
    if (!storageKey) {
      // Wait for the async username hash before reading dismissal state,
      // otherwise dismissed users can briefly see the banner flash.
      setIsBannerDismissed(undefined)
      return
    }

    const bannerStatus = sessionStorage.getItem(storageKey)
    const lastCountStr = sessionStorage.getItem(`${storageKey}-count`)
    const lastCount = lastCountStr ? Number.parseInt(lastCountStr, 10) : 0

    setLastSeenBulkActionCount(lastCount)
    setIsBannerDismissed(bannerStatus === BANNER_DISMISSAL_VALUE)
  }, [storageKey])

  // When a new bulk action starts, re-show the banner even if it was dismissed before.
  // We track the count in session storage so if the user dismisses "2 jobs running"
  // and then a 3rd job starts, the banner appears again.
  useEffect(() => {
    if (storageKey && activeBulkActionsCount > lastSeenBulkActionCount) {
      setIsBannerDismissed(false)
      sessionStorage.removeItem(storageKey)
      sessionStorage.setItem(`${storageKey}-count`, String(activeBulkActionsCount))
      setLastSeenBulkActionCount(activeBulkActionsCount)
    }
  }, [activeBulkActionsCount, lastSeenBulkActionCount, storageKey])

  function handleCloseBanner() {
    if (!storageKey) {
      return
    }
    sessionStorage.setItem(storageKey, BANNER_DISMISSAL_VALUE)
    sessionStorage.setItem(`${storageKey}-count`, String(activeBulkActionsCount))
    setIsBannerDismissed(true)
    setLastSeenBulkActionCount(activeBulkActionsCount)
  }

  // Guard early so parent can pass values safely without extra conditionals.
  if (!props.currentUsername || activeBulkActionsCount < 1 || isBannerDismissed === undefined || isBannerDismissed) {
    return null
  }

  // Use separate messages for singular vs plural to keep translations simple.
  const message =
    activeBulkActionsCount === 1
      ? t('Changes may occur in the data table due to ongoing bulk job')
      : t('Changes may occur in the data table due to ongoing ##COUNT## bulk jobs').replace(
          '##COUNT##',
          String(activeBulkActionsCount),
        )

  const activityLogPath = ROUTES.FORM_ACTIVITY.replace(':uid', props.assetUid)

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
        {/* Show activity log link only for users who created at least one of the jobs */}
        {props.hasActiveBulkActionsCreatedByCurrentUser && (
          <>
            {' '}
            <Link to={activityLogPath}>{t('Click here')}</Link> {t('to monitor your progress or to cancel this job')}.
          </>
        )}
      </Alert>
    </div>
  )
}
