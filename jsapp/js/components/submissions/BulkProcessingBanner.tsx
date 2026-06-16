import React, { useEffect, useState } from 'react'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import TextWithInternalLink from '#/components/common/TextWithInternalLink'
import Alert from '#/components/common/alert'
import { useSafeUsernameStorageKey } from '#/hooks/useSafeUsernameStorageKey'
import { ROUTES } from '#/router/routerConstants'

interface BulkProcessingBannerProps {
  assetUid: string
  currentUsername: string | undefined
  activeBulkActions: BulkActionResponse[]
  hasActiveBulkActionsCreatedByCurrentUser: boolean
}

/**
 * Displays an informational banner when active bulk processing is running in
 * the table. Shows for all users, with an additional link to activity log
 * for users who created a bulk job themselves.
 *
 * Dismissal is tracked per job UID - when user dismisses, we store all current
 * job UIDs. Banner re-appears when any new job (new UID) starts.
 */
export default function BulkProcessingBanner(props: BulkProcessingBannerProps) {
  const activeBulkActionsCount = props.activeBulkActions.length
  const storageKey = useSafeUsernameStorageKey(`kpiBulkProcessingBanner-${props.assetUid}`, props.currentUsername || '')
  const [dismissedUids, setDismissedUids] = useState<Set<string> | undefined>()

  // Load dismissed job UIDs from session storage on mount.
  // We hash the username before using it as a storage key to avoid leaking PII.
  useEffect(() => {
    if (!storageKey) {
      // Wait for the async username hash before reading dismissal state,
      // otherwise dismissed users can briefly see the banner flash.
      setDismissedUids(undefined)
      return
    }

    const storedUids = sessionStorage.getItem(storageKey)
    if (storedUids) {
      try {
        const parsed = JSON.parse(storedUids) as string[]
        setDismissedUids(new Set(parsed))
      } catch {
        // Invalid JSON, start fresh
        setDismissedUids(new Set())
      }
    } else {
      setDismissedUids(new Set())
    }
  }, [storageKey])

  function handleCloseBanner() {
    if (!storageKey) {
      return
    }
    // Store all current active job UIDs as dismissed
    const currentUids = props.activeBulkActions.map((action) => action.uid)
    const newDismissed = new Set([...(dismissedUids || []), ...currentUids])
    setDismissedUids(newDismissed)
    sessionStorage.setItem(storageKey, JSON.stringify([...newDismissed]))
  }

  // Check if any active job hasn't been dismissed
  const hasUndismissedJobs =
    dismissedUids !== undefined && props.activeBulkActions.some((action) => !dismissedUids.has(action.uid))

  // Guard early so parent can pass values safely without extra conditionals.
  if (!props.currentUsername || activeBulkActionsCount < 1 || dismissedUids === undefined || !hasUndismissedJobs) {
    return null
  }

  // Use separate messages for singular vs plural to keep translations simple.
  const message =
    activeBulkActionsCount === 1
      ? t('Changes may occur in the data table due to ongoing bulk job.')
      : t('Changes may occur in the data table due to ongoing ##COUNT## bulk jobs.').replace(
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
            <TextWithInternalLink
              text={t('[Click here] to monitor your progress or to cancel this job.')}
              path={activityLogPath}
            />
          </>
        )}
      </Alert>
    </div>
  )
}
