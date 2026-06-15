import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '#/router/routerConstants'
import Alert from '#/components/common/alert'
import { useSafeUsernameStorageKey } from '#/hooks/useSafeUsernameStorageKey'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'

interface BulkProcessingBannerProps {
  assetUid: string
  currentUsername: string | undefined
  activeBulkActions: BulkActionResponse[]
  hasActiveBulkActionsCreatedByCurrentUser: boolean
}

const BANNER_DISMISSAL_VALUE = 'dismissed'
const BANNER_DELAY_MS = 5000 // 5 seconds
const LARGE_JOB_THRESHOLD = 10 // rows

/**
 * Displays an informational banner when active bulk processing is running in
 * the table. Shows for all users, with an additional link to activity log
 * for users who created a bulk job themselves.
 *
 * The banner appears after 5 seconds, or immediately if a bulk job processes
 * more than 10 rows.
 */
export default function BulkProcessingBanner(props: BulkProcessingBannerProps) {
  const activeBulkActionsCount = props.activeBulkActions.length
  const storageKey = useSafeUsernameStorageKey(`kpiBulkProcessingBanner-${props.assetUid}`, props.currentUsername || '')
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean | undefined>()
  const [lastSeenBulkActionCount, setLastSeenBulkActionCount] = useState<number>(0)
  const [shouldShowBanner, setShouldShowBanner] = useState<boolean>(false)

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

  // If a new bulk action is created after banner was dismissed, show banner again
  useEffect(() => {
    if (storageKey && activeBulkActionsCount > lastSeenBulkActionCount) {
      setIsBannerDismissed(false)
      sessionStorage.removeItem(storageKey)
      sessionStorage.setItem(`${storageKey}-count`, String(activeBulkActionsCount))
      setLastSeenBulkActionCount(activeBulkActionsCount)
    }
  }, [activeBulkActionsCount, lastSeenBulkActionCount, storageKey])

  // Handle delayed banner display: show immediately for large jobs (>10 rows), or after 5 seconds
  useEffect(() => {
    if (activeBulkActionsCount === 0) {
      setShouldShowBanner(false)
      return
    }

    // Check if any bulk action is processing many rows (immediate display)
    const hasLargeJob = props.activeBulkActions.some(
      (action) => action.submission_uuids && action.submission_uuids.length > LARGE_JOB_THRESHOLD
    )

    if (hasLargeJob) {
      setShouldShowBanner(true)
      return
    }

    // Otherwise, show banner after delay
    const timer = setTimeout(() => {
      setShouldShowBanner(true)
    }, BANNER_DELAY_MS)

    return () => clearTimeout(timer)
  }, [props.activeBulkActions, activeBulkActionsCount])

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
  if (
    !props.currentUsername ||
    activeBulkActionsCount < 1 ||
    isBannerDismissed === undefined ||
    isBannerDismissed ||
    !shouldShowBanner
  ) {
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
