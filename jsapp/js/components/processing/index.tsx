import React, { useState } from 'react'
import DocumentTitle from 'react-document-title'
import { Navigate } from 'react-router-dom'
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
import CenteredMessage from '#/components/common/centeredMessage.component'
import LoadingSpinner from '#/components/common/loadingSpinner'
import { PROCESSING_BULK_ACTIONS_POLL_INTERVAL } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import { addDefaultUuidPrefix, getSubmissionRootUuid } from '#/utils'
import type { LanguageCode } from '../languages/languagesStore'
import SingleProcessingContent from './SingleProcessingContent'
import SingleProcessingHeader from './SingleProcessingHeader'
import SingleProcessingSidebar from './SingleProcessingSidebar'
import { getProcessingQuestionType } from './common/questionType'
import { getAvailableTabsForQuestionType } from './common/utils'
import styles from './index.module.scss'
import { TAB_ROUTES, getActiveTab, getTabRoutePath } from './routes.utils'

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
export default function SingleProcessingRoute({
  params: routeParams,
  asset,
}: { params: RouteParams; asset?: AssetResponse }) {
  // This is for determining the translation we use for survey questions,
  // so it is separate from processing languages.
  const [questionLabelLanguage, setQuestionLabelLanguage] = useState<LanguageCode | string>('')
  const [hasUnsavedWork, setHasUnsavedWork] = useState(false)
  const { uid: assetId, xpath: questionXpath, submissionEditId: submissionId } = routeParams

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
      refetchInterval: PROCESSING_BULK_ACTIONS_POLL_INTERVAL,
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

  // The one guard against being on a tab the question type doesn't support (e.g. Transcript for text), however we got
  // there: a stale link, switching questions, editing the URL, or Back. It lives here rather than in
  // `SingleProcessingContent`, which isn't mounted when the question has no answer, and it replaces the history entry
  // so Back doesn't land on the unsupported tab again. The submission helps find the type of a question the form no
  // longer has, so the guard may only kick in once it's loaded.
  const questionType = asset ? getProcessingQuestionType(asset, questionXpath, submission) : undefined
  const availableTabs = getAvailableTabsForQuestionType(questionType)
  const activeTab = getActiveTab()
  if (asset && activeTab && !availableTabs.includes(activeTab)) {
    return <Navigate to={getTabRoutePath(TAB_ROUTES[availableTabs[0]])} replace />
  }

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
                  availableTabs={availableTabs}
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
