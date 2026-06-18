import React from 'react'
import bem from '#/bem'
import { userCan } from '#/components/permissions/utils'
import { QUESTION_TYPES } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import ReportViewItem from './reportViewItem.component'
import type { ReportsState } from './reports'
import { getEffectiveRowReportStyle, getReportRowTranslatedLabel, populateSelectQuestionLabels } from './reports.utils'
import type { ReportsResponse } from './reportsConstants'

interface ReportContentsProps {
  triggerQuestionSettings: (questionName: string) => void
  parentState: ReportsState
  reportData: ReportsResponse[]
  asset: AssetResponse
}

/**
 * Renders report rows and applies row-level style/label preparation before
 * delegating chart/table presentation to ReportViewItem.
 */
export default class ReportContents extends React.Component<ReportContentsProps> {
  shouldComponentUpdate(nextProps: ReportContentsProps) {
    // to improve UI performance, don't refresh report while a modal window is visible
    return !(
      nextProps.parentState.showReportGraphSettings ||
      nextProps.parentState.showCustomReportModal ||
      nextProps.parentState.currentQuestionGraph
    )
  }

  render() {
    let translationIndex = 0
    const customReport = this.props.parentState.currentCustomReport
    const defaultRS = this.props.parentState.reportStyles
    const asset = this.props.asset
    const groupBy = this.props.parentState.groupBy

    if (customReport) {
      if (customReport.reportStyle?.translationIndex) {
        translationIndex = customReport.reportStyle.translationIndex
      }
    } else {
      translationIndex = defaultRS?.default?.translationIndex || 0
    }

    // reset to first language if translation index cannot be found
    if (asset?.content?.translations && !asset.content?.translations[translationIndex]) {
      translationIndex = 0
    }

    const reportData = this.props.reportData

    // At this point we only orchestrate row preparation; complex transformations
    // (style resolution and select label mapping) are delegated to utilities.
    for (let i = reportData.length - 1; i > -1; i--) {
      const rowName = reportData[i].name
      const rowType = reportData[i].row.type || null

      // Keep global/default values (like report_colors) unless the question
      // override explicitly replaces them.
      const effectiveReportStyle = getEffectiveRowReportStyle(rowName, customReport, defaultRS)
      if (effectiveReportStyle) {
        reportData[i].style = effectiveReportStyle
      }

      if (
        asset?.content?.choices &&
        (rowType === QUESTION_TYPES.select_one.id || rowType === QUESTION_TYPES.select_multiple.id)
      ) {
        // Keep render focused on orchestration: utility handles the complex
        // select-question label mapping logic and fallback behavior.
        populateSelectQuestionLabels(reportData[i], asset, translationIndex, groupBy)
      }
    }

    return (
      <div>
        {reportData.map((rowContent, i) => {
          if (!rowContent.data.provided) {
            return null
          }

          const label = getReportRowTranslatedLabel(rowContent, this.props.asset.content?.survey, translationIndex)

          return (
            <bem.ReportView__item key={i}>
              <ReportViewItem
                {...rowContent}
                label={label}
                triggerQuestionSettings={this.props.triggerQuestionSettings.bind(this)}
                isMenuDisabled={!userCan('change_asset', this.props.asset)}
              />
            </bem.ReportView__item>
          )
        })}
      </div>
    )
  }
}
