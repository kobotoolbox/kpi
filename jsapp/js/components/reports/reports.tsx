import './reports.scss'

import React, { useEffect, useState } from 'react'

import clonedeep from 'lodash.clonedeep'
import DocumentTitle from 'react-document-title'
import { actions } from '#/actions'
import bem from '#/bem'
import Button from '#/components/common/button'
import CenteredMessage from '#/components/common/centeredMessage.component'
import InlineMessage from '#/components/common/inlineMessage'
import KoboSelect from '#/components/common/koboSelect'
import LoadingSpinner from '#/components/common/loadingSpinner'
import Modal from '#/components/common/modal'
import { userCan } from '#/components/permissions/utils'
import { dataInterface } from '#/dataInterface'
import type { AssetResponse, FailResponse, SurveyRow } from '#/dataInterface'
import type { WithRouterProps } from '#/router/legacy'
import { stores } from '#/stores'
import { launchPrinting, notify, txtid } from '#/utils'
import CustomReportEditor from './customReportEditor.component'
import ReportContents from './reportContents.component'
import ReportStyleSettings from './reportStyleSettings.component'
import ReportStyleSettingsSingleQuestion from './reportStyleSettingsSingleQuestion.component'
import { getDataWithResponses } from './reports.utils'
import {
  type AssetResponseReportStyles,
  type CustomReportSettings,
  DEFAULT_MINIMAL_REPORT_STYLE,
  type ReportsPaginatedResponse,
  type ReportsResponse,
} from './reportsConstants'

interface ReportsProps extends WithRouterProps {
  uid?: string
  assetid?: string
}

// TODO FIXME: Instead of passing this whole state to child components as
// `parentState`, please build some kind of store, or resolve this in other
// sensible way.
export interface ReportsState {
  asset?: AssetResponse
  currentCustomReport?: CustomReportSettings
  /** This is question name. */
  currentQuestionGraph?: string
  error?: FailResponse
  groupBy?: string
  isFullscreen: boolean
  reportCustom?: {
    [crid: string]: CustomReportSettings
  }
  reportData?: ReportsResponse[]
  reportLimit?: number
  reportStyles?: AssetResponseReportStyles
  rowsByKuid?: { [kuid: string]: SurveyRow }
  rowsByIdentifier?: { [identifier: string]: SurveyRow }
  showCustomReportModal: boolean
  showReportGraphSettings: boolean
  graphWidth: string
  graphHeight: string
  activeModalTab: number
}

export default function Reports(props: ReportsProps) {
  const [state, setState] = useState<ReportsState>({
    graphWidth: '700',
    graphHeight: '250',
    activeModalTab: 0,
    isFullscreen: false,
    reportLimit: 200,
    showReportGraphSettings: false,
    showCustomReportModal: false,
    currentCustomReport: undefined,
    currentQuestionGraph: undefined,
    groupBy: '',
  })

  useEffect(() => {
    loadReportData()

    const unlisteners = [
      actions.reports.setStyle.completed.listen(onSetStyleCompleted),
      actions.reports.setCustom.completed.listen(onSetCustomCompleted),
    ]

    return () => {
      unlisteners.forEach((clb) => clb())
    }
  }, [])

  useEffect(() => {
    refreshReportData()
  }, [state.currentCustomReport, state.groupBy])

  // This is needed for "reset default report groupBy if it fails" case
  useEffect(() => {
    loadReportData()
  }, [state.reportStyles?.default.groupDataBy])

  function loadReportData() {
    const uid = props.params.assetid || props.params.uid

    stores.allAssets.whenLoaded(uid, (asset: AssetResponse) => {
      const rowsByKuid: { [kuid: string]: SurveyRow } = {}
      const rowsByIdentifier: { [identifier: string]: SurveyRow } = {}
      let groupBy = ''
      // The code below is overriding the `ReportStyles` we got from endpoint in
      // `AssetResponse`, we clone it here to avoid mutation.
      const reportStyles: AssetResponseReportStyles = state.reportStyles || clonedeep(asset.report_styles)
      const reportCustom = asset.report_custom

      if (state.currentCustomReport?.reportStyle?.groupDataBy) {
        groupBy = state.currentCustomReport.reportStyle.groupDataBy
      } else if (reportStyles.default?.groupDataBy !== undefined) {
        groupBy = reportStyles.default.groupDataBy
      }

      // Here we override the `ReportStyles` in case the default values are
      // not present.
      if (reportStyles.default === undefined) {
        reportStyles.default = DEFAULT_MINIMAL_REPORT_STYLE
      }
      if (reportStyles.default?.report_type === undefined) {
        reportStyles.default.report_type = DEFAULT_MINIMAL_REPORT_STYLE.report_type
      }
      if (reportStyles.default?.translationIndex === undefined) {
        reportStyles.default.translationIndex = 0
      }
      if (reportStyles.default?.groupDataBy === undefined) {
        reportStyles.default.groupDataBy = ''
      }

      if (asset.content?.survey) {
        asset.content.survey.forEach((r) => {
          if (r.$kuid) {
            rowsByKuid[r.$kuid] = r
          }

          const $identifier: string | undefined = r.$autoname || r.name
          if ($identifier) {
            rowsByIdentifier[$identifier] = r
          }
        })

        dataInterface
          .getReportData({ uid: uid, identifiers: [], group_by: groupBy })
          .done((data: ReportsPaginatedResponse) => {
            const dataWithResponses = getDataWithResponses(rowsByIdentifier, data)

            setState((currentState) => ({
              ...currentState,
              asset: asset,
              rowsByKuid: rowsByKuid,
              rowsByIdentifier: rowsByIdentifier,
              reportStyles: reportStyles,
              reportData: dataWithResponses,
              reportCustom: reportCustom,
              groupBy: groupBy,
              error: undefined,
            }))
          })
          .fail((err: FailResponse) => {
            if (
              groupBy &&
              groupBy.length > 0 &&
              !state.currentCustomReport &&
              reportStyles.default?.groupDataBy !== undefined
            ) {
              notify.error(
                t('Could not load grouped results via "##". Will attempt to load the ungrouped report.').replace(
                  '##',
                  groupBy,
                ),
              )

              // reset default report groupBy if it fails
              reportStyles.default.groupDataBy = undefined
              setState((currentState) => ({
                ...currentState,
                reportStyles: reportStyles,
              }))
            } else {
              setState((currentState) => ({
                ...currentState,
                error: err,
                asset: asset,
              }))
            }
          })
      } else {
        // Redundant?
        console.error('Survey not defined.')
      }
    })
  }

  function refreshReportData() {
    const uid = props.params.assetid || props.params.uid
    const rowsByIdentifier = state.rowsByIdentifier
    const customReport = state.currentCustomReport

    let groupBy: string | undefined = ''

    if (!customReport && state.reportStyles?.default?.groupDataBy !== undefined) {
      groupBy = state.reportStyles.default.groupDataBy
    }

    if (customReport?.reportStyle?.groupDataBy) {
      groupBy = state.currentCustomReport?.reportStyle.groupDataBy
    }

    dataInterface
      .getReportData({ uid: uid, identifiers: [], group_by: groupBy })
      .done((data: ReportsPaginatedResponse) => {
        const dataWithResponses = getDataWithResponses(rowsByIdentifier || {}, data)
        setState((currentState) => ({
          ...currentState,
          reportData: dataWithResponses,
          error: undefined,
        }))
      })
      .fail((err: FailResponse) => {
        notify.error(t('Could not refresh report.'))
        setState((currentState) => ({
          ...currentState,
          error: err,
        }))
      })
  }

  function reportStyleListener(_assetUid: string, reportStyles: AssetResponseReportStyles) {
    setState((currentState) => ({
      ...currentState,
      reportStyles: reportStyles,
      showReportGraphSettings: false,
      currentQuestionGraph: undefined,
      groupBy: reportStyles.default?.groupDataBy || '',
    }))
  }

  function onSetStyleCompleted(asset: AssetResponse) {
    setState((currentState) => ({
      ...currentState,
      asset: asset,
      reportStyles: asset.report_styles,
      showReportGraphSettings: false,
      currentQuestionGraph: undefined,
      groupBy: asset.report_styles.default?.groupDataBy || '',
    }))
  }

  function reportCustomListener(_assetUid: string, reportCustom: { [crid: string]: CustomReportSettings }) {
    const crid = state.currentCustomReport?.crid
    let newGroupBy: string

    if (crid && reportCustom[crid]) {
      if (reportCustom[crid].reportStyle?.groupDataBy) {
        newGroupBy = reportCustom[crid].reportStyle.groupDataBy
      }

      setState((currentState) => ({
        ...currentState,
        reportCustom: reportCustom,
        showCustomReportModal: false,
        showReportGraphSettings: false,
        currentQuestionGraph: undefined,
        groupBy: newGroupBy,
      }))
    } else {
      setState((currentState) => ({
        ...currentState,
        reportCustom: reportCustom,
        showCustomReportModal: false,
        showReportGraphSettings: false,
        currentQuestionGraph: undefined,
        currentCustomReport: undefined,
        groupBy: newGroupBy,
      }))
    }
  }

  function onSetCustomCompleted(asset: AssetResponse, crid: string) {
    const newCustomReports = asset.report_custom

    setState((currentState) => ({
      ...currentState,
      asset: asset,
      reportCustom: newCustomReports,
      showCustomReportModal: false,
      showReportGraphSettings: false,
      currentQuestionGraph: undefined,
      currentCustomReport: newCustomReports[crid],
      groupBy: newCustomReports[crid]?.reportStyle.groupDataBy,
    }))
  }

  function onSelectedReportChange(crid: string) {
    if (crid === '') {
      setDefaultReport()
    } else {
      setCustomReport(crid)
    }
  }

  function openReportGraphSettings() {
    setState((currentState) => ({
      ...currentState,
      showReportGraphSettings: true,
    }))
  }

  function closeReportGraphSettings() {
    setState((currentState) => ({
      ...currentState,
      showReportGraphSettings: false,
    }))
  }

  function hasAnyProvidedData(reportData: ReportsResponse[]) {
    let hasAny = false
    reportData.map((rowContent) => {
      if (rowContent.data.provided) {
        hasAny = true
      }
    })
    return hasAny
  }

  /**
   * If you don't pass `crid`, new report would be created.
   */
  function setCustomReport(crid?: string) {
    if (!state.showCustomReportModal) {
      let currentCustomReport: CustomReportSettings | undefined
      if (crid) {
        // existing report
        currentCustomReport = state.reportCustom?.[crid]
      } else {
        // new custom report
        currentCustomReport = {
          crid: txtid(),
          name: '',
          questions: [],
          reportStyle: DEFAULT_MINIMAL_REPORT_STYLE,
        }
      }
      setState((currentState) => ({
        ...currentState,
        currentCustomReport: currentCustomReport,
      }))
    }
  }

  function editCustomReport() {
    if (state.currentCustomReport) {
      setState((currentState) => ({
        ...currentState,
        showCustomReportModal: true,
      }))
    }
  }

  function openCustomReportModal() {
    if (!state.showCustomReportModal) {
      setCustomReport()
    } else if (state.currentCustomReport) {
      var crid = state.currentCustomReport.crid
      if (state.reportCustom?.[crid] == undefined) {
        setDefaultReport()
      }
    }

    setState((currentState) => ({
      ...currentState,
      showCustomReportModal: true,
    }))
  }

  function closeCustomReportModal() {
    setState((currentState) => ({
      ...currentState,
      showCustomReportModal: false,
    }))
  }

  function setDefaultReport() {
    setState((currentState) => ({
      ...currentState,
      currentCustomReport: undefined,
    }))
  }

  function toggleFullscreen() {
    setState((currentState) => ({
      ...currentState,
      isFullscreen: !state.isFullscreen,
    }))
  }

  function renderReportButtons() {
    var customReports = state.reportCustom || {}
    var customReportsList = []
    for (var key in customReports) {
      if (customReports[key] && customReports[key].crid) {
        customReportsList.push(customReports[key])
      }
    }

    customReportsList.sort((a, b) => a.name.localeCompare(b.name))

    const reportsSelectorOptions = customReportsList.map((item) => {
      return {
        value: item.crid,
        label: item.name || t('Untitled report'),
      }
    })
    reportsSelectorOptions.unshift({
      value: '',
      label: t('Default Report'),
    })

    return (
      <bem.FormView__reportButtons>
        <div className='form-view__report-buttons-left'>
          <KoboSelect
            className='custom-reports-selector'
            name='custom-reports'
            type='outline'
            size='m'
            isClearable={false}
            options={reportsSelectorOptions}
            selectedOption={state.currentCustomReport?.crid || ''}
            onChange={(newVal) => {
              if (newVal !== null) {
                onSelectedReportChange(newVal)
              }
            }}
          />

          <Button
            type='primary'
            size='m'
            startIcon='plus'
            onClick={openCustomReportModal}
            tooltip={t('Create New Report')}
          />

          <Button
            type='text'
            size='m'
            startIcon='edit'
            onClick={editCustomReport}
            tooltip={t('Edit Report Questions')}
            isDisabled={!state.currentCustomReport}
          />

          <Button
            type='text'
            size='m'
            startIcon='settings'
            onClick={openReportGraphSettings}
            tooltip={t('Configure Report Style')}
            isDisabled={!userCan('change_asset', state.asset)}
          />
        </div>

        <div className='form-view__report-buttons-right'>
          <Button
            type='text'
            size='m'
            startIcon='print'
            onClick={launchPrinting}
            tooltip={t('Print')}
            tooltipPosition='right'
          />

          <Button
            type='text'
            size='m'
            startIcon='expand'
            onClick={toggleFullscreen}
            tooltip={t('Toggle fullscreen')}
            tooltipPosition='right'
          />
        </div>
      </bem.FormView__reportButtons>
    )
  }

  function resetReportLimit() {
    setState((currentState) => ({
      ...currentState,
      reportLimit: undefined,
    }))
  }

  function triggerQuestionSettings(questionName: string) {
    if (questionName) {
      setState((currentState) => ({
        ...currentState,
        currentQuestionGraph: questionName,
      }))
    }
  }

  function renderQuestionSettings() {
    return (
      <bem.GraphSettings>
        <Modal.Body />
      </bem.GraphSettings>
    )
  }

  function closeQuestionSettings() {
    setState((currentState) => ({
      ...currentState,
      currentQuestionGraph: undefined,
    }))
  }

  function renderLoadingOrError() {
    if (state.error) {
      return (
        <CenteredMessage
          message={
            <>
              {t('This report cannot be loaded.')}
              <br />
              <code>
                {state.error.statusText}
                {': ' + state.error.responseText || t('An error occurred')}
              </code>
            </>
          }
        />
      )
    } else {
      return <LoadingSpinner />
    }
  }

  if (!state.asset) {
    return renderLoadingOrError()
  }

  if (state.reportData === undefined) {
    return renderLoadingOrError()
  }

  const asset = state.asset
  const currentCustomReport = state.currentCustomReport
  let docTitle

  if (asset?.content) {
    docTitle = asset.name || t('Untitled')
  }

  const fullReportData = state.reportData || []
  /**
   * Report data that will be displayed (after filtering out questions, etc.)
   * to the user.
   */
  let reportData = state.reportData || []

  if (reportData.length) {
    if (currentCustomReport?.questions.length) {
      const currentQuestions = currentCustomReport.questions
      reportData = fullReportData?.filter((q) => currentQuestions.includes(q.name))
    }

    if (state.reportLimit && reportData.length > state.reportLimit) {
      reportData = reportData.slice(0, state.reportLimit)
    }
  }

  const formViewModifiers = []
  if (state.isFullscreen) {
    formViewModifiers.push('fullscreen')
  }

  const hasGroupBy = Boolean(state.groupBy)

  let noDataMessage = t('This report has no data.')
  if (hasGroupBy) {
    noDataMessage += ' '
    noDataMessage += t('Try changing Report Style to "No grouping".')
  }

  return (
    <DocumentTitle title={`${docTitle} | KoboToolbox`}>
      <bem.FormView m={formViewModifiers}>
        <bem.ReportView>
          <h1>{t('Reports')}</h1>

          {renderReportButtons()}

          {!hasAnyProvidedData(reportData) && (
            <bem.ReportView__wrap>
              <InlineMessage type='warning' message={noDataMessage} />
            </bem.ReportView__wrap>
          )}

          {hasAnyProvidedData(reportData) && (
            <bem.ReportView__wrap>
              <bem.PrintOnly>
                <h3>{asset.name}</h3>
              </bem.PrintOnly>

              {!state.currentCustomReport &&
                state.reportLimit &&
                reportData.length &&
                state.reportData.length > state.reportLimit && (
                  <InlineMessage
                    type='warning'
                    message={
                      <div className='report-view__limit-message'>
                        <p>
                          {t('For performance reasons, this report only includes the first ## questions.').replace(
                            '##',
                            String(state.reportLimit || '-'),
                          )}
                        </p>

                        <Button
                          type='secondary'
                          size='s'
                          onClick={resetReportLimit}
                          label={t('Show all (##)').replace('##', String(state.reportData.length))}
                        />
                      </div>
                    }
                  />
                )}

              <InlineMessage
                type='warning'
                icon='alert'
                message={t(
                  'This is an automated report based on raw data submitted to this project. Please conduct proper data cleaning prior to using the graphs and figures used on this page.',
                )}
              />

              <ReportContents
                parentState={state}
                reportData={reportData}
                asset={state.asset}
                triggerQuestionSettings={triggerQuestionSettings}
              />
            </bem.ReportView__wrap>
          )}

          {state.showReportGraphSettings && (
            <Modal open onClose={closeReportGraphSettings} title={t('Edit Report Style')}>
              <ReportStyleSettings parentState={state} />
            </Modal>
          )}

          {state.showCustomReportModal && (
            <Modal open onClose={closeCustomReportModal} title={t('Custom Report')}>
              {state.currentCustomReport && (
                <CustomReportEditor
                  reportData={state.reportData}
                  customReport={state.currentCustomReport}
                  asset={state.asset}
                />
              )}
            </Modal>
          )}

          {state.currentQuestionGraph && (
            <Modal open onClose={closeQuestionSettings} title={t('Question Style')}>
              <ReportStyleSettingsSingleQuestion question={state.currentQuestionGraph} parentState={state} />
            </Modal>
          )}
        </bem.ReportView>
      </bem.FormView>
    </DocumentTitle>
  )
}
