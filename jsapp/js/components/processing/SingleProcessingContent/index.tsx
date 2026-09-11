import { Tabs } from '@mantine/core'
import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import { findRowByXpath } from '#/assetUtils'
import type { AssetResponse } from '#/dataInterface'
import protectorHelpers from '#/protector/protectorHelpers'
import { PROCESSING_ROUTES } from '#/router/routerConstants'
import { getAvailableTabsForQuestionType } from '../common/utils'
import { ProcessingTab, getTabRoutePath, goToTabRoute, isProcessingRouteActive } from '../routes.utils'
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

  /**
   * Builds the `renderRoot` for each tab. Each tab needs to handle browser middle-click navigation as well as
   * use the `safeExecute` protector when left clicking.
   */
  function renderTabLink(route: string) {
    // Passes mantine props from renderRoot, this is needed for the tab to function as a link.
    // We also spread the renderRoot props first and override it with our own later in order to prevent ugly prop surgery.
    return (props: Record<string, unknown>) => (
      <Link
        {...props}
        to={getTabRoutePath(route)}
        onClick={(event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
          event.preventDefault()
          safeExecute(() => goToTabRoute(route))
        }}
      />
    )
  }

  // Determine active tab based on current route
  let activeTab: string | null = null
  if (isProcessingRouteActive(PROCESSING_ROUTES.TRANSCRIPT)) {
    activeTab = PROCESSING_ROUTES.TRANSCRIPT
  } else if (isProcessingRouteActive(PROCESSING_ROUTES.TRANSLATIONS)) {
    activeTab = PROCESSING_ROUTES.TRANSLATIONS
  } else if (isProcessingRouteActive(PROCESSING_ROUTES.ANALYSIS)) {
    activeTab = PROCESSING_ROUTES.ANALYSIS
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
      <Tabs variant={'folder'} value={activeTab} tt={'uppercase'} h={48}>
        <Tabs.List justify='left'>
          {isTranscriptAvailable && (
            <Tabs.Tab value={PROCESSING_ROUTES.TRANSCRIPT} renderRoot={renderTabLink(PROCESSING_ROUTES.TRANSCRIPT)}>
              {t('Transcript')}
            </Tabs.Tab>
          )}

          <Tabs.Tab value={PROCESSING_ROUTES.TRANSLATIONS} renderRoot={renderTabLink(PROCESSING_ROUTES.TRANSLATIONS)}>
            {t('Translations')}
          </Tabs.Tab>

          <Tabs.Tab value={PROCESSING_ROUTES.ANALYSIS} renderRoot={renderTabLink(PROCESSING_ROUTES.ANALYSIS)}>
            {t('Analysis')}
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <section className={styles.body}>
        {isTranscriptAvailable && activeTab === PROCESSING_ROUTES.TRANSCRIPT && (
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
        {activeTab === PROCESSING_ROUTES.TRANSLATIONS && (
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
        {activeTab === PROCESSING_ROUTES.ANALYSIS && (
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
