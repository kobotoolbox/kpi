import './submissionRoute.scss'
import React, { useEffect } from 'react'
import DocumentTitle from 'react-document-title'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { actions } from '#/actions'
import { useEnvironmentQuery } from '#/api/useEnvironmentQuery'
import assetStore from '#/assetStore'
import bem from '#/bem'
import Button from '#/components/common/ButtonNew'
import { getSubmissionRootUuid } from '#/utils'
import SubmissionDetails from './submissionDetails'
import SubmissionModalLayout from './submissionModalLayout'
import SubmissionNeighborNav from './submissionNeighborNav'
import SubmissionRecordPlaceholder from './submissionRecordPlaceholder'
import type { SubmissionRouteState } from './submissionRouting'
import { getDataTablePath, getSubmissionCounterLabel, getSubmissionPath } from './submissionRouting'
import { useSubmissionNeighbors } from './useSubmissionNeighbors'
import { useSubmissionRecord } from './useSubmissionRecord'

/**
 * Displays a single submission record at its own address, so that it can be
 * bookmarked and shared. Owns loading the record, moving between records, and
 * leaving; the record itself is rendered by `SubmissionDetails`.
 *
 * Opened from the data table, it shows in a modal over the table, which stays
 * mounted underneath. Opened any other way - a link, a new tab, "Open full record" -
 * it has the page to itself. Same address either way.
 */
export default function SubmissionRoute() {
  const { uid: assetUid = '', submissionId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  // NOTE: The parent route is loaded with PermProtectedRoute, so we know the
  // call to backend to get asset was already made, and thus we can safely assume
  // asset data is present.
  const asset = assetUid ? assetStore.getAsset(assetUid) : null

  const { isPending, isError, record, refresh } = useSubmissionRecord(assetUid, submissionId)

  const rootUuid = record ? getSubmissionRootUuid(record) : undefined

  const routeState = location.state as SubmissionRouteState | null
  const isModal = Boolean(routeState?.asModal)

  const neighbors = useSubmissionNeighbors(assetUid, record?._id, routeState?.listPosition)

  // Everything that holds a copy of the record goes stale with it: the cached
  // record (which the page reads after "Open full record"), its neighbours (the
  // change may have moved it in the list, or out of it), and the table underneath,
  // which keeps its page and filters through the refresh.
  const onRecordChanged = () => {
    refresh()
    neighbors.refresh()
    actions.resources.refreshTableSubmissions()
  }
  const { data: countLimit } = useEnvironmentQuery({
    select: (response) => (response.status === 200 ? response.data.limited_count_max_rows : undefined),
  })

  // The route also accepts a numeric `_id`, for older links and for callers that
  // only have one (the REST Service logs). Swap it for the root UUID, so the
  // address bar always shows the form of the link that survives edits.
  useEffect(() => {
    if (assetUid && rootUuid && rootUuid !== submissionId) {
      navigate(getSubmissionPath(assetUid, rootUuid), { replace: true, state: location.state })
    }
  }, [assetUid, rootUuid, submissionId, navigate, location.state])

  // A record opened by its address has no screen to return to, so we offer the
  // data table: it is the list this record belongs to, and the one place that can
  // always show it.
  const backTo = routeState?.backTo ?? { path: getDataTablePath(assetUid), label: t('Back to Data Table') }

  const leave = () => {
    if (isModal) {
      // Opening the modal added one history entry and steps only replace it, so the
      // entry before is the table. Navigating there instead would add an entry,
      // and the browser's Back would reopen the modal.
      navigate(-1)
    } else {
      navigate(backTo.path)
    }
  }

  // In the modal, steps replace the address, so one Back closes it however far
  // the user has stepped. The page keeps every step in history.
  const goToRecord = (recordId: string | number, state: SubmissionRouteState) => {
    navigate(getSubmissionPath(assetUid, recordId), { replace: isModal, state: { ...state, asModal: isModal } })
  }

  const counterLabel = getSubmissionCounterLabel(neighbors.index, neighbors.total, countLimit)

  // Reads as "Submission Record (2 of 17)", as the modal did, and drops back to
  // the plain title until we know where the record sits.
  const heading = counterLabel ? `${t('Submission Record')} (${counterLabel})` : t('Submission Record')

  const navigation = (
    <SubmissionNeighborNav
      neighbors={neighbors}
      onGoToSubmission={(neighbor) => {
        const listPosition = routeState?.listPosition

        // Stepping to another record keeps the way back and the list being walked,
        // but not the duplicate banner - that only belongs to the record it was
        // raised for.
        goToRecord(neighbor.rootUuid, {
          backTo: routeState?.backTo,
          listPosition: listPosition && { ...listPosition, index: neighbor.listIndex ?? listPosition.index },
        })
      }}
    />
  )

  // The asset is already loaded by the time this route renders, so a missing one
  // means the store has yet to catch up - something to wait out, not an error.
  const content =
    !asset || !record ? (
      <SubmissionRecordPlaceholder isPending={isPending || !asset} isError={isError} submissionId={submissionId} />
    ) : (
      <SubmissionDetails
        // Remounting on a different record keeps per-record UI state (such as
        // a pending "Refresh submission" prompt) from leaking into the next one.
        key={record._id}
        asset={asset}
        submission={record}
        duplicatedFromUuid={routeState?.duplicatedFromUuid}
        isInModal={isModal}
        onRefreshRequested={onRecordChanged}
        onChanged={onRecordChanged}
        onDeleted={leave}
        onDuplicated={(newSubmissionDbId, duplicatedFromUuid) => {
          // The list position is deliberately dropped: a brand new record does not
          // necessarily match the table's filters (filtering by `_id` is the clearest
          // case), and claiming a place in a list it is not part of would leave the
          // user with a wrong count and wrong Previous/Next. So the duplicate steps
          // through the full list instead.
          goToRecord(newSubmissionDbId, { duplicatedFromUuid, backTo: routeState?.backTo })
        }}
      />
    )

  if (isModal) {
    return (
      <DocumentTitle title={`${t('Submission Record')} | KoboToolbox`}>
        <SubmissionModalLayout
          title={heading}
          onClose={leave}
          navigation={navigation}
          // Same address, without the table: printing, for one, needs the page.
          onOpenFullRecord={record ? () => navigate(location.pathname) : undefined}
        >
          {content}
        </SubmissionModalLayout>
      </DocumentTitle>
    )
  }

  return (
    <DocumentTitle title={`${t('Submission Record')} | KoboToolbox`}>
      <bem.FormView m='submission'>
        <div className='submission-route'>
          <header className='submission-route__header'>
            <div className='submission-route__header-side'>
              <Button variant='transparent' leftIcon='angle-left' tooltip={backTo.label} onClick={leave}>
                {t('Back')}
              </Button>
            </div>

            <h1 className='submission-route__title'>{heading}</h1>

            <div className='submission-route__header-side submission-route__header-side--end'>
              {asset && record && navigation}
            </div>
          </header>

          <div className='submission-route__body'>{content}</div>
        </div>
      </bem.FormView>
    </DocumentTitle>
  )
}
