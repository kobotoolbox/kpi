import classNames from 'classnames'
import React, { useEffect } from 'react'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import { findRowByXpath } from '#/assetUtils'
import type { AssetResponse } from '#/dataInterface'
import protectorHelpers from '#/protector/protectorHelpers'
import { PROCESSING_ROUTES } from '#/router/routerConstants'
import { getAvailableTabsForQuestionType } from '../common/utils'
import { ProcessingTab, goToTabRoute, isProcessingRouteActive } from '../routes.utils'
import TabAnalysis from './TabAnalysis'
import TabTranscript from './TabTranscript'
import TabTranslations from './TabTranslations'
import styles from './index.module.scss'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
  activeBulkActions: BulkActionResponse[]
  hasUnsavedWork: boolean
  onUnsavedWorkChange: (hasUnsavedWork: boolean) => void
  supplement: DataSupplementResponse
  advancedFeatures: AdvancedFeatureResponse[]
}

/**
 * Displays main content part of Single Processing route. It consists of tabs
 * navigation and a section for currently selected tab. Content for each of the
 * tabs is built in separate components.
 */
export default function SingleProcessingContent({
  asset,
  questionXpath,
  submission,
  activeBulkActions,
  hasUnsavedWork,
  onUnsavedWorkChange,
  supplement,
  advancedFeatures,
}: Props) {
  const questionType = findRowByXpath(asset.content ?? {}, questionXpath)?.type
  const availableTabs = getAvailableTabsForQuestionType(questionType)
  const isTranscriptAvailable = availableTabs.includes(ProcessingTab.Transcript)

  /** DRY wrapper for protector function. */
  function safeExecute(callback: () => void) {
    protectorHelpers.safeExecute(hasUnsavedWork, callback)
  }

  function handleTranscriptClick() {
    safeExecute(() => goToTabRoute(PROCESSING_ROUTES.TRANSCRIPT))
  }

  function handleTranslationsClick() {
    safeExecute(() => goToTabRoute(PROCESSING_ROUTES.TRANSLATIONS))
  }

  function handleAnalysisClick() {
    safeExecute(() => goToTabRoute(PROCESSING_ROUTES.ANALYSIS))
  }

  // Guards against landing on Transcript for a question type that doesn't
  // support it (e.g. a stale link, or switching questions while on that tab).
  useEffect(() => {
    if (!isTranscriptAvailable && isProcessingRouteActive(PROCESSING_ROUTES.TRANSCRIPT)) {
      goToTabRoute(PROCESSING_ROUTES.TRANSLATIONS)
    }
  }, [isTranscriptAvailable])

  return (
    <section className={styles.root}>
      <ul className={styles.tabs}>
        {isTranscriptAvailable && (
          <li
            className={classNames({
              [styles.tab]: true,
              [styles.activeTab]: isProcessingRouteActive(PROCESSING_ROUTES.TRANSCRIPT),
            })}
            onClick={handleTranscriptClick}
          >
            {t('Transcript')}
          </li>
        )}

        <li
          className={classNames({
            [styles.tab]: true,
            [styles.activeTab]: isProcessingRouteActive(PROCESSING_ROUTES.TRANSLATIONS),
          })}
          onClick={handleTranslationsClick}
        >
          {t('Translations')}
        </li>

        <li
          className={classNames({
            [styles.tab]: true,
            [styles.activeTab]: isProcessingRouteActive(PROCESSING_ROUTES.ANALYSIS),
          })}
          onClick={handleAnalysisClick}
        >
          {t('Analysis')}
        </li>
      </ul>

      <section className={styles.body}>
        {isTranscriptAvailable && isProcessingRouteActive(PROCESSING_ROUTES.TRANSCRIPT) && (
          <TabTranscript
            asset={asset}
            questionXpath={questionXpath}
            submission={submission}
            activeBulkActions={activeBulkActions}
            onUnsavedWorkChange={onUnsavedWorkChange}
            supplement={supplement}
            advancedFeatures={advancedFeatures}
          />
        )}
        {isProcessingRouteActive(PROCESSING_ROUTES.TRANSLATIONS) && (
          <TabTranslations
            asset={asset}
            questionXpath={questionXpath}
            submission={submission}
            activeBulkActions={activeBulkActions}
            onUnsavedWorkChange={onUnsavedWorkChange}
            supplement={supplement}
            advancedFeatures={advancedFeatures}
          />
        )}
        {isProcessingRouteActive(PROCESSING_ROUTES.ANALYSIS) && (
          <TabAnalysis
            asset={asset}
            questionXpath={questionXpath}
            submission={submission}
            onUnsavedWorkChange={onUnsavedWorkChange}
            supplement={supplement}
            advancedFeatures={advancedFeatures}
          />
        )}
      </section>
    </section>
  )
}
