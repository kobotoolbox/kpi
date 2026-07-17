import React, { useState } from 'react'
import DocumentTitle from 'react-document-title'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import { BulkActionResponseStatusEnum } from '#/api/models/bulkActionResponseStatusEnum'
import type { DataResponse } from '#/api/models/dataResponse'
import {
  getAssetsAdvancedFeaturesBulkActionsListQueryKey,
  useAssetsAdvancedFeaturesBulkActionsList,
  useAssetsAdvancedFeaturesList,
  useAssetsDataList,
  useAssetsDataSupplementRetrieve,
} from '#/api/react-query/survey-data'
import assetStore from '#/assetStore'
import CenteredMessage from '#/components/common/centeredMessage.component'
import LoadingSpinner from '#/components/common/loadingSpinner'
import { addDefaultUuidPrefix } from '#/utils'
import type { LanguageCode } from '../languages/languagesStore'
import SingleProcessingContent from './SingleProcessingContent'
import SingleProcessingHeader from './SingleProcessingHeader'
import SingleProcessingSidebar from './SingleProcessingSidebar'
import { getSubmissionRootUuid } from './common/conflictingOngoingJob'
import styles from './index.module.scss'

interface RouteParams extends Record<string, string | undefined> {
  uid: string
  xpath: string
  submissionEditId: string
}

function getActiveBulkActions(bulkActions: BulkActionResponse[]) {
  return bulkActions.filter(
    (bulkAction) =>
      bulkAction.status === BulkActionResponseStatusEnum.pending ||
      bulkAction.status === BulkActionResponseStatusEnum.in_progress,
  )
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

  // Some routes pass edit `_uuid`, others pass root UUID. We query with both so
  // we can always resolve the same submission record.
  const querySubmission = useAssetsDataList(assetId, {
    query: JSON.stringify({
      $or: [{ 'meta/rootUuid': addDefaultUuidPrefix(submissionId) }, { _uuid: submissionId }],
    }),
  })

  const submission: DataResponse | undefined =
    querySubmission.data?.status === 200 && querySubmission.data.data.results.length > 0
      ? querySubmission.data.data.results[0]
      : undefined

  // Bulk-action rows store submission_root_uuid, so normalize the selected
  // submission to root UUID form before filtering.
  const submissionRootUuid = submission ? getSubmissionRootUuid(submission) : undefined

  const bulkActionsParams = {
    status: `${BulkActionResponseStatusEnum.pending},${BulkActionResponseStatusEnum.in_progress}`,
    submission_uuid: submissionRootUuid,
    question_xpath: questionXpath,
    // High page size keeps this to a single request in normal usage while
    // still relying on backend filtering instead of client-side page scanning.
    limit: 1000,
  }

  const queryBulkActions = useAssetsAdvancedFeaturesBulkActionsList(assetId, bulkActionsParams, {
    query: {
      queryKey: getAssetsAdvancedFeaturesBulkActionsListQueryKey(assetId, bulkActionsParams),
      // Keep polling while the route is open so a job that starts after an
      // empty initial load can still lock the controls without a remount.
      refetchInterval: 10000,
      // If user is on a different tab/window, we skip interval polling.
      refetchIntervalInBackground: false,
      // Wait until we know the root UUID, otherwise backend filtering can miss
      // matching rows and return a misleading empty result.
      enabled: Boolean(assetId && submissionRootUuid),
    },
  })

  const activeBulkActions: BulkActionResponse[] =
    queryBulkActions.data?.status === 200 ? getActiveBulkActions(queryBulkActions.data.data.results) : []

  /** Whether current submission has a response for current question. */
  const questionHasAnswer = !!(questionXpath && submission?.[questionXpath])
  const pageTitle = 'Data | KoboToolbox'

  // We had `assset?.content?.survey` check here. In theory it could be undefined, but I don't think it's possible to
  // access processing UI with an asset that wasn't deployed and have submissions - all that needs `.survey`.
  // We do need it for some parts of processing UI, but we already safeguard ourselves in each place we do use it.
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
                  activeBulkActions={activeBulkActions}
                  hasUnsavedWork={hasUnsavedWork}
                  onUnsavedWorkChange={setHasUnsavedWork}
                  supplement={supplement}
                  advancedFeatures={advancedFeatures}
                />
              ) : (
                <CenteredMessage message={t('There is no data for this question for the current submission')} />
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
