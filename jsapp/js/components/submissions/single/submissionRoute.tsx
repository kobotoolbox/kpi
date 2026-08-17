import './submissionRoute.scss'

import { useQueryClient } from '@tanstack/react-query'
import React, { useEffect } from 'react'
import DocumentTitle from 'react-document-title'
import { useLocation, useNavigate } from 'react-router-dom'
import { getAssetsDataListQueryKey, useAssetsDataList } from '#/api/react-query/survey-data'
import assetStore from '#/assetStore'
import bem from '#/bem'
import Button from '#/components/common/button'
import CenteredMessage from '#/components/common/centeredMessage.component'
import LoadingSpinner from '#/components/common/loadingSpinner'
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

  // The route also accepts a numeric `_id`, for links made before submissions
  // had an address and for callers that only have an `_id` (the REST Service
  // logs). Swap it for the root UUID once we know it, so that the address bar
  // always offers the form of the link that survives edits.
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
      <bem.FormView m='submission'>
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
      // The submission endpoints are typed against the older `SubmissionResponse`
      // while this route uses the generated `DataResponse`. They describe the same
      // payload; the difference is that the former also allows arbitrary question
      // names as keys.
      submission={record as unknown as SubmissionResponse}
      duplicatedFromUuid={routeState?.duplicatedFromUuid}
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
