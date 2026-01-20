import React, { useState } from 'react'

import DocumentTitle from 'react-document-title'
import { unstable_usePrompt as usePrompt } from 'react-router-dom'
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
import { UNSAVED_CHANGES_WARNING } from '#/protector/protectorConstants'
import { addDefaultUuidPrefix } from '#/utils'
import type { LanguageCode } from '../languages/languagesStore'
import SingleProcessingContent from './SingleProcessingContent'
import SingleProcessingHeader from './SingleProcessingHeader'
import SingleProcessingSidebar from './SingleProcessingSidebar'
import styles from './index.module.scss'
import singleProcessingStore from './singleProcessingStore'

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
export default function SingleProcessingRoute({ params: routeParams }: { params: RouteParams }) {
  // This is for determining the translation we use for survey questions,
  // so it is separate from processing languages.
  const [questionLabelLanguage, setQuestionLabelLanguage] = useState<LanguageCode | string>('')
  const [hasUnsavedWork, setHasUnsavedWork] = useState(false)
  const { uid, xpath, submissionEditId } = routeParams

  if (!uid || !xpath || !submissionEditId) return

  // NOTE: This route component is being loaded with PermProtectedRoute so
  // we know that the call to backend to get asset was already made, and
  // thus we can safely assume asset data is present :happy_face:
  const asset = uid ? assetStore.getAsset(uid) : null

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

  // TODO OpenAPI: DataResponse should be indexable.
  const submission =
    querySubmission.data?.status === 200 && querySubmission.data.data.results.length > 0
      ? (querySubmission.data.data.results[0] as DataResponse & Record<string, string>)
      : undefined

  /** Whether current submission has a response for current question. */
  const questionHasAnswer = !!(xpath && submission?.[xpath])

  function renderBottom() {
    if (
      queryAF.data?.status !== 200 ||
      querySupplement.data?.status !== 200 ||
      !asset?.content?.survey ||
      !submission
    ) {
      return <LoadingSpinner />
    }

    return (
      <React.Fragment>
        <section className={styles.bottomLeft}>
          {questionHasAnswer ? (
            <SingleProcessingContent
              asset={asset}
              questionXpath={xpath}
              submission={submission}
              hasUnsavedWork={hasUnsavedWork}
              onUnsavedWorkChange={setHasUnsavedWork}
              supplementData={querySupplement.data}
              advancedFeaturesData={queryAF.data}
            />
          ) : (
            <CenteredMessage message={NO_DATA_MESSAGE} />
          )}
        </section>

        <section className={styles.bottomRight}>
          <SingleProcessingSidebar
            asset={asset}
            xpath={xpath!}
            questionLabelLanguage={questionLabelLanguage}
            setQuestionLabelLanguage={setQuestionLabelLanguage}
            submission={submission}
          />
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
        {/* TODO: move deeper into editor components and condition over the local variables. */}
        {(singleProcessingStore.hasAnyUnsavedWork() || singleProcessingStore.data.isPollingForTranscript) && <Prompt />}

        <section className={styles.top}>
          <SingleProcessingHeader
            asset={asset}
            submission={submission}
            currentSubmissionUid={submissionEditId}
            questionLabelLanguage={questionLabelLanguage}
            xpath={xpath!}
            hasUnsavedWork={hasUnsavedWork}
          />
        </section>

        <section className={styles.bottom}>{renderBottom()}</section>
      </section>
    </DocumentTitle>
  )
}
