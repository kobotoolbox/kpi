import React, { useState } from 'react'

import DocumentTitle from 'react-document-title'
import { unstable_usePrompt as usePrompt } from 'react-router-dom'
import {
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
  const { uid: assetId, xpath: questionXpath, submissionEditId: submissionId } = routeParams

  // NOTE: This route component is being loaded with PermProtectedRoute so
  // we know that the call to backend to get asset was already made, and
  // thus we can safely assume asset data is present :happy_face:
  const asset = assetId ? assetStore.getAsset(assetId) : null

  const queryAF = useAssetsAdvancedFeaturesList(assetId)
  const advancedFeatures = queryAF.data?.status === 200 ? queryAF.data.data : undefined

  const querySupplement = useAssetsDataSupplementRetrieve(assetId, submissionId)
  const supplement = querySupplement.data?.status === 200 ? querySupplement.data.data : undefined

  const querySubmission = useAssetsDataList(assetId, {
    query: JSON.stringify({
      $or: [{ 'meta/rootUuid': addDefaultUuidPrefix(submissionId) }, { _uuid: submissionId }],
    }),
  } as any) // TODO OpenAPI: add query prop to the schema. See https://linear.app/kobotoolbox/issue/DEV-1626

  const submission =
    querySubmission.data?.status === 200 && querySubmission.data.data.results.length > 0
      ? querySubmission.data.data.results[0]
      : undefined

  /** Whether current submission has a response for current question. */
  const questionHasAnswer = !!(questionXpath && submission?.[questionXpath])
  const pageTitle = 'Data | KoboToolbox'

  // TODO: Why here was a `asset?.content?.survey` check, can `survey` be empty? Does it matter? If so, a forever spinner won't do.
  if (!asset || !advancedFeatures || !supplement || !submission) {
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
        <section className={styles.top}>
          <SingleProcessingHeader
            asset={asset}
            submission={submission}
            currentSubmissionUid={submissionId}
            questionLabelLanguage={questionLabelLanguage}
            xpath={questionXpath}
            hasUnsavedWork={hasUnsavedWork}
          />
        </section>

        <section className={styles.bottom}>
          <React.Fragment>
            <section className={styles.bottomLeft}>
              {questionHasAnswer ? (
                <SingleProcessingContent
                  asset={asset}
                  questionXpath={questionXpath}
                  submission={submission}
                  hasUnsavedWork={hasUnsavedWork}
                  onUnsavedWorkChange={setHasUnsavedWork}
                  supplement={supplement}
                  advancedFeatures={advancedFeatures}
                />
              ) : (
                <CenteredMessage message={NO_DATA_MESSAGE} />
              )}
            </section>

            <section className={styles.bottomRight}>
              <SingleProcessingSidebar
                asset={asset}
                questionXpath={questionXpath}
                questionLabelLanguage={questionLabelLanguage}
                setQuestionLabelLanguage={setQuestionLabelLanguage}
                submission={submission}
                supplement={supplement}
              />
            </section>
          </React.Fragment>
        </section>
      </section>
    </DocumentTitle>
  )
}
