import './submissionRoute.scss'

import { useQueryClient } from '@tanstack/react-query'
import React, { useEffect, useState } from 'react'
import DocumentTitle from 'react-document-title'
import { useLocation, useNavigate } from 'react-router-dom'
import { getAssetsDataListQueryKey, useAssetsDataList } from '#/api/react-query/survey-data'
import assetStore from '#/assetStore'
import bem from '#/bem'
import Button from '#/components/common/button'
import CenteredMessage from '#/components/common/centeredMessage.component'
import LoadingSpinner from '#/components/common/loadingSpinner'
import { getTableViewState, setTableViewState } from '#/components/submissions/tableViewState'
import type { SubmissionResponse } from '#/dataInterface'
import { getSubmissionRootUuid } from '#/utils'
import SubmissionDetails from './submissionDetails'
import SubmissionNeighborNav from './submissionNeighborNav'
import type { SubmissionRouteState } from './submissionRouting'
import { getDataTablePath, getSubmissionLookupParams, getSubmissionPath } from './submissionRouting'

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
  const queryClient = useQueryClient()

  // Shared with the data table (see `tableViewState`), so expanding one and moving
  // to the other stays expanded. Also survives stepping between records, as only
  // `SubmissionDetails` remounts.
  const [isFullscreen, setIsFullscreen] = useState(() => getTableViewState(assetUid)?.isFullscreen ?? false)

  const toggleFullscreen = () => {
    const newIsFullscreen = !isFullscreen
    setIsFullscreen(newIsFullscreen)
    setTableViewState(assetUid, { isFullscreen: newIsFullscreen })
  }

  // NOTE: This route component is being loaded with PermProtectedRoute so we
  // know that the call to backend to get asset was already made, and thus we can
  // safely assume asset data is present.
  const asset = assetUid ? assetStore.getAsset(assetUid) : null

  const lookupParams = getSubmissionLookupParams(submissionId)
  const lookupQueryKey = getAssetsDataListQueryKey(assetUid, lookupParams)
  const query = useAssetsDataList(assetUid, lookupParams, {
    query: { queryKey: lookupQueryKey, enabled: Boolean(assetUid && submissionId) },
  })

  const record =
    query.data?.status === 200 && query.data.data.results.length > 0 ? query.data.data.results[0] : undefined

  const rootUuid = record ? getSubmissionRootUuid(record) : undefined

  // The route also accepts a numeric `_id`, for older links and for callers that
  // only have one (the REST Service logs). Swap it for the root UUID, so the
  // address bar always shows the form of the link that survives edits.
  useEffect(() => {
    if (assetUid && rootUuid && rootUuid !== submissionId) {
      navigate(getSubmissionPath(assetUid, rootUuid), { replace: true, state: location.state })
    }
  }, [assetUid, rootUuid, submissionId, navigate, location.state])

  const goToDataTable = () => {
    navigate(getDataTablePath(assetUid))
  }

  const pageTitle = `${t('Submission Record')} | KoboToolbox`

  const renderInLayout = (content: React.ReactNode, header?: React.ReactNode) => (
    <DocumentTitle title={pageTitle}>
      <bem.FormView m={isFullscreen ? ['submission', 'fullscreen'] : ['submission']}>
        <div className='submission-route'>
          <header className='submission-route__header'>
            <Button
              type='text'
              size='m'
              startIcon='angle-left'
              label={t('Back to data table')}
              onClick={goToDataTable}
            />

            <h1 className='submission-route__title'>{t('Submission Record')}</h1>

            {header}
          </header>

          <div className='submission-route__body'>{content}</div>
        </div>
      </bem.FormView>
    </DocumentTitle>
  )

  if (!asset || query.isPending) {
    return renderInLayout(<LoadingSpinner />)
  }

  if (query.isError) {
    return renderInLayout(<CenteredMessage message={t('Error: could not load data.')} />)
  }

  if (!record) {
    return renderInLayout(
      <CenteredMessage
        message={t('The submission could not be found. It may have been deleted. Submission ID: ##id##').replace(
          '##id##',
          submissionId,
        )}
      />,
    )
  }

  const routeState = location.state as SubmissionRouteState | null

  return renderInLayout(
    <SubmissionDetails
      // Remounting on a different record keeps per-record UI state (such as
      // a pending "Refresh submission" prompt) from leaking into the next one.
      key={record._id}
      asset={asset}
      // `DataResponse` and `SubmissionResponse` describe the same payload, but the
      // submission endpoints are typed against the latter, which also allows
      // arbitrary question names as keys.
      submission={record as unknown as SubmissionResponse}
      duplicatedFromUuid={routeState?.duplicatedFromUuid}
      isFullscreen={isFullscreen}
      onToggleFullscreen={toggleFullscreen}
      onRefreshRequested={() => {
        queryClient.invalidateQueries({ queryKey: lookupQueryKey })
      }}
      onDeleted={goToDataTable}
      onDuplicated={(newSubmissionDbId, duplicatedFromUuid) => {
        navigate(getSubmissionPath(assetUid, newSubmissionDbId), { state: { duplicatedFromUuid } })
      }}
    />,
    <SubmissionNeighborNav
      assetUid={assetUid}
      submissionDbId={record._id}
      onGoToSubmission={(neighborRootUuid) => {
        navigate(getSubmissionPath(assetUid, neighborRootUuid))
      }}
    />,
  )
}
