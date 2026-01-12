import React from 'react'

import DocumentTitle from 'react-document-title'
import { useParams, unstable_usePrompt as usePrompt } from 'react-router-dom'
import type { DataResponse } from '#/api/models/dataResponse'
import {
  getAssetsAdvancedFeaturesListQueryKey,
  getAssetsDataListQueryKey,
  getAssetsDataSupplementRetrieveQueryKey,
  useAssetsAdvancedFeaturesList,
  useAssetsDataList,
  useAssetsDataSupplementRetrieve,
} from '#/api/react-query/survey-data'
import assetStore from '#/assetStore'
import CenteredMessage from '#/components/common/centeredMessage.component'
import LoadingSpinner from '#/components/common/loadingSpinner'
import ProcessingSidebar from '#/components/processing/sidebar/processingSidebar'
import SingleProcessingContent from '#/components/processing/singleProcessingContent'
import SingleProcessingHeader from '#/components/processing/singleProcessingHeader'
import singleProcessingStore from '#/components/processing/singleProcessingStore'
import { UNSAVED_CHANGES_WARNING } from '#/protector/protectorConstants'
import { addDefaultUuidPrefix } from '#/utils'
import styles from './singleProcessingRoute.module.scss'

// TODO: manually enable `POST /api/v2/assets/{uid_asset}/advanced-features/` for questions for now.

const NO_DATA_MESSAGE = t('There is no data for this question for the current submission')

interface RouteParams extends Record<string, string | undefined> {
  uid: string
  xpath: string
  submissionEditId: string
}

const Prompt = () => {
  usePrompt({ message: UNSAVED_CHANGES_WARNING, when: true })
  return <></>
}

/**
 * Provides the base pieces of data for all processing components. Also renders
 * everything with nice spinners.
 */
export default function SingleProcessingRoute() {
  const { uid, xpath, submissionEditId } = useParams<RouteParams>()

  // NOTE: This route component is being loaded with PermProtectedRoute so
  // we know that the call to backend to get asset was already made, and
  // thus we can safely assume asset data is present :happy_face:
  const asset = uid ? assetStore.getAsset(uid) : null
  console.log(asset)

  const queryAF = useAssetsAdvancedFeaturesList(uid!, {
    query: {
      queryKey: getAssetsAdvancedFeaturesListQueryKey(uid!),
      enabled: !!uid,
    },
  })

  const querySupplement = useAssetsDataSupplementRetrieve(uid!, submissionEditId!, {
    query: {
      queryKey: getAssetsDataSupplementRetrieveQueryKey(uid!, submissionEditId!),
      enabled: !!uid,
    },
  })

  const params = {
    query: JSON.stringify({
      $or: [{ 'meta/rootUuid': addDefaultUuidPrefix(submissionEditId!) }, { _uuid: submissionEditId }],
    }),
  } as any
  const querySubmission = useAssetsDataList(uid!, params, {
    query: {
      queryKey: getAssetsDataListQueryKey(uid!, params),
      enabled: !!uid,
    },
  })

  console.log(queryAF.data)
  console.log(querySupplement.data)
  console.log(querySubmission.data)

  /** Whether current submission has a response for current question. */
  function isDataProcessable(): boolean {
    // TODO OpenAPI: DataResponse should be indexable.
    return querySubmission.data?.status === 200 && !!(querySubmission.data.data.results[0] as DataResponse & Record<string, string>)[xpath!]
  }

  function renderBottom() {
    if (queryAF.data?.status !== 200 || querySupplement.data?.status !== 200 || !asset?.content?.survey) {
      return <LoadingSpinner />
    }

    return (
      <React.Fragment>
        <section className={styles.bottomLeft}>
          {isDataProcessable() && <SingleProcessingContent />}
          {!isDataProcessable() && <CenteredMessage message={NO_DATA_MESSAGE} />}
        </section>

        <section className={styles.bottomRight}>
          <ProcessingSidebar asset={asset} />
        </section>
      </React.Fragment>
    )
  }

  const pageTitle = 'Data | KoboToolbox'

  if (queryAF.data?.status !== 200 || querySupplement.data?.status !== 200 || !asset?.content?.survey) {
    return (
      <DocumentTitle title={pageTitle}>
        <section className={styles.root}>
          <LoadingSpinner />
        </section>
      </DocumentTitle>
    )
  }

  return (
    <DocumentTitle title={pageTitle}>
      <section className={styles.root}>
        {(singleProcessingStore.hasAnyUnsavedWork() || singleProcessingStore.data.isPollingForTranscript) && <Prompt />}
        <section className={styles.top}>
          <SingleProcessingHeader submissionEditId={submissionEditId!} assetUid={uid!} asset={asset} xpath={xpath!} />
        </section>

        <section className={styles.bottom}>{renderBottom()}</section>
      </section>
    </DocumentTitle>
  )
}
