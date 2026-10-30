import './submissionRoute.scss'
import React, { useEffect } from 'react'
import DocumentTitle from 'react-document-title'
import { useLocation, useNavigate } from 'react-router-dom'
import assetStore from '#/assetStore'
import bem from '#/bem'
import Button from '#/components/common/ButtonNew'
import { getSubmissionRootUuid } from '#/utils'
import SubmissionDetails from './submissionDetails'
import SubmissionNeighborNav from './submissionNeighborNav'
import SubmissionRecordPlaceholder from './submissionRecordPlaceholder'
import type { SubmissionRouteState } from './submissionRouting'
import { getDataTablePath, getSubmissionPath } from './submissionRouting'
import { useSubmissionNeighbors } from './useSubmissionNeighbors'
import { useSubmissionRecord } from './useSubmissionRecord'

interface RouteParams extends Record<string, string | undefined> {
  uid: string
  submissionId: string
}

/**
 * Displays a single submission record at its own address, so that it can be
 * bookmarked and shared. Owns loading the record, moving between records, and
 * leaving for the data table; the record itself is rendered by
 * `SubmissionDetails`.
 */
export default function SubmissionRoute({ params }: { params: RouteParams }) {
  const { uid: assetUid, submissionId } = params
  const navigate = useNavigate()
  const location = useLocation()

  // NOTE: This route component is being loaded with PermProtectedRoute so we
  // know that the call to backend to get asset was already made, and thus we can
  // safely assume asset data is present.
  const asset = assetUid ? assetStore.getAsset(assetUid) : null

  const { isPending, isError, record, refresh } = useSubmissionRecord(assetUid, submissionId)

  const rootUuid = record ? getSubmissionRootUuid(record) : undefined

  const routeState = location.state as SubmissionRouteState | null

  const neighbors = useSubmissionNeighbors(assetUid, record?._id, routeState?.filterQuery)

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

  const goBack = () => {
    navigate(backTo.path)
  }

  const pageTitle = `${t('Submission Record')} | KoboToolbox`

  // Reads as "Submission Record (2 of 17)", as the modal did, and drops back to
  // the plain title until we know where the record sits.
  const heading =
    neighbors.index === undefined
      ? t('Submission Record')
      : `${t('Submission Record')} (${neighbors.index} ${t('of')} ${neighbors.total})`

  const renderInLayout = (content: React.ReactNode, header?: React.ReactNode) => (
    <DocumentTitle title={pageTitle}>
      <bem.FormView m='submission'>
        <div className='submission-route'>
          <header className='submission-route__header'>
            <div className='submission-route__header-side'>
              <Button variant='transparent' leftIcon='angle-left' tooltip={backTo.label} onClick={goBack}>
                {t('Back')}
              </Button>
            </div>

            <h1 className='submission-route__title'>{heading}</h1>

            <div className='submission-route__header-side submission-route__header-side--end'>{header}</div>
          </header>

          <div className='submission-route__body'>{content}</div>
        </div>
      </bem.FormView>
    </DocumentTitle>
  )

  // The asset is already loaded by the time this route renders, so a missing one
  // means the store has yet to catch up - something to wait out, not an error.
  if (!asset || !record) {
    return renderInLayout(
      <SubmissionRecordPlaceholder isPending={isPending || !asset} isError={isError} submissionId={submissionId} />,
    )
  }

  return renderInLayout(
    <SubmissionDetails
      // Remounting on a different record keeps per-record UI state (such as
      // a pending "Refresh submission" prompt) from leaking into the next one.
      key={record._id}
      asset={asset}
      submission={record}
      duplicatedFromUuid={routeState?.duplicatedFromUuid}
      onRefreshRequested={refresh}
      onDeleted={goBack}
      onDuplicated={(newSubmissionDbId, duplicatedFromUuid) => {
        // The filters the source was found with are deliberately dropped: a brand
        // new record does not necessarily match them (filtering by `_id` is the
        // clearest case), and claiming a place in a list it is not part of would
        // leave the user with a wrong count and dead Previous/Next buttons. So the
        // duplicate sits in the full list instead.
        navigate(getSubmissionPath(assetUid, newSubmissionDbId), {
          state: { duplicatedFromUuid, backTo: routeState?.backTo },
        })
      }}
    />,
    <SubmissionNeighborNav
      neighbors={neighbors}
      onGoToSubmission={(neighborRootUuid) => {
        // Stepping to another record keeps the way back and the list being walked,
        // but not the duplicate banner - that only belongs to the record it was
        // raised for.
        navigate(getSubmissionPath(assetUid, neighborRootUuid), {
          state: { backTo: routeState?.backTo, filterQuery: routeState?.filterQuery },
        })
      }}
    />,
  )
}
