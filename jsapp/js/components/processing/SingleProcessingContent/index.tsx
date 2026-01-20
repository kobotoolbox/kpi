import React from 'react'

import classNames from 'classnames'
import type { DataResponse } from '#/api/models/dataResponse'
import type { AssetResponse } from '#/dataInterface'
import protectorHelpers from '#/protector/protectorHelpers'
import { PROCESSING_ROUTES } from '#/router/routerConstants'

import { goToTabRoute, isProcessingRouteActive } from '../routes.utils'

import TabAnalysis from './TabAnalysis'
import TabTranscript from './TabTranscript'
import TabTranslations from './TabTranslations'
import styles from './index.module.scss'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse & Record<string, string>
  submissionEditId: string
  hasUnsavedWork: boolean
  onUnsavedWorkChange: (hasUnsavedWork: boolean) => void
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
  submissionEditId,
  hasUnsavedWork,
  onUnsavedWorkChange,
}: Props) {
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

  function renderTabContent() {
    if (isProcessingRouteActive(PROCESSING_ROUTES.TRANSCRIPT)) {
      return (
        <TabTranscript
          asset={asset}
          questionXpath={questionXpath}
          submission={submission}
          submissionEditId={submissionEditId}
          onUnsavedWorkChange={onUnsavedWorkChange}
        />
      )
    }
    if (isProcessingRouteActive(PROCESSING_ROUTES.TRANSLATIONS)) {
      return (
        <TabTranslations
          asset={asset}
          questionXpath={questionXpath}
          submission={submission}
          submissionEditId={submissionEditId}
          onUnsavedWorkChange={onUnsavedWorkChange}
        />
      )
    }
    if (isProcessingRouteActive(PROCESSING_ROUTES.ANALYSIS)) {
      return <TabAnalysis />
    }
    return null
  }

  return (
    <section className={styles.root}>
      <ul className={styles.tabs}>
        <li
          className={classNames({
            [styles.tab]: true,
            [styles.activeTab]: isProcessingRouteActive(PROCESSING_ROUTES.TRANSCRIPT),
          })}
          onClick={handleTranscriptClick}
        >
          {t('Transcript')}
        </li>

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

      <section className={styles.body}>{renderTabContent()}</section>
    </section>
  )
}
