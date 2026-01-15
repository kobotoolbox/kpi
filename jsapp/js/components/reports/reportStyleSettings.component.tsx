import React from 'react'

import clonedeep from 'lodash.clonedeep'
import { actions } from '#/actions'
import { handleApiFail } from '#/api'
import bem from '#/bem'
import Button from '#/components/common/button'
import Modal from '#/components/common/modal'
import Radio from '#/components/common/radio'
import ReportsModalTabs, {
  ReportsModalTabNames,
  DEFAULT_REPORTS_MODAL_TAB,
} from '#/components/reports/reportsModalTabs.component'
import type { FailResponse, LabelValuePair } from '#/dataInterface'
import ReportColorsEditor from './reportColorsEditor.component'
import ReportTypeEditor from './reportTypeEditor.component'
import type { ReportsState } from './reports'
import type { ReportStyle, ReportStyleName } from './reportsConstants'

interface ReportStyleSettingsProps {
  parentState: ReportsState
}

interface ReportStyleSettingsState {
  activeModalTab: ReportsModalTabNames
  reportStyle: ReportStyle
  isPending: boolean
}

/**
 * This component is being used to modify existing report style settings.
 *
 * It displays up to 4 available tabs ("type" and "color" are always available,
 * "group by" and "translation" based on the form questions).
 */
export default class ReportStyleSettings extends React.Component<ReportStyleSettingsProps, ReportStyleSettingsState> {
  private unlisteners: Function[] = []

  constructor(props: ReportStyleSettingsProps) {
    super(props)

    let initialReportStyle = props.parentState.reportStyles?.default
    if (props.parentState.currentCustomReport?.reportStyle) {
      initialReportStyle = props.parentState.currentCustomReport.reportStyle
    }

    this.state = {
      activeModalTab: DEFAULT_REPORTS_MODAL_TAB,
      reportStyle: initialReportStyle || {},
      isPending: false,
    }
  }

  componentDidMount() {
    this.unlisteners.push(
      actions.reports.setStyle.completed.listen(this.onSetStyleCompleted.bind(this)),
      actions.reports.setStyle.failed.listen(this.onSetStyleFailed.bind(this)),
      actions.reports.setCustom.completed.listen(this.onSetCustomCompleted.bind(this)),
      actions.reports.setCustom.failed.listen(this.onSetCustomFailed.bind(this)),
    )
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => clb())
  }

  onSetStyleCompleted() {
    this.setState({ isPending: false })
  }

  onSetStyleFailed(response: FailResponse) {
    handleApiFail(response)
    this.setState({ isPending: false })
  }

  onSetCustomCompleted() {
    this.setState({ isPending: false })
  }

  onSetCustomFailed(response: FailResponse) {
    handleApiFail(response)
    this.setState({ isPending: false })
  }

  toggleTab(tabName: ReportsModalTabNames) {
    this.setState({ activeModalTab: tabName })
  }

  onReportColorsChange(newColors: string[]) {
    const newStyle = clonedeep(this.state.reportStyle)
    newStyle.report_colors = newColors
    this.setState({ reportStyle: newStyle })
  }

  onReportTypeChange(newType: ReportStyleName) {
    const newStyles = clonedeep(this.state.reportStyle)
    newStyles.report_type = newType
    this.setState({ reportStyle: newStyles })
  }

  onTranslationIndexChange(newIndex: string) {
    const newStyle = clonedeep(this.state.reportStyle)
    newStyle.translationIndex = Number.parseInt(newIndex)
    this.setState({ reportStyle: newStyle })
  }

  onGroupByChange(newValue: string) {
    const newStyle = clonedeep(this.state.reportStyle)
    newStyle.groupDataBy = newValue
    this.setState({ reportStyle: newStyle })
  }

  saveReportStyles() {
    const currentCustomReport = this.props.parentState.currentCustomReport
    const assetUid = this.props.parentState.asset?.uid

    if (!assetUid) {
      return
    }

    if (currentCustomReport) {
      const reportCustom = clonedeep(this.props.parentState.asset?.report_custom || {})
      if (reportCustom) {
        reportCustom[currentCustomReport.crid].reportStyle = this.state.reportStyle
        actions.reports.setCustom(assetUid, reportCustom, currentCustomReport.crid)
        this.setState({ isPending: true })
      }
    } else {
      const parentReportStyles = this.props.parentState.reportStyles
      if (parentReportStyles?.default) {
        Object.assign(parentReportStyles.default, this.state.reportStyle)
        actions.reports.setStyle(assetUid, parentReportStyles)
        this.setState({ isPending: true })
      }
    }
  }

  render() {
    const rows = this.props.parentState.rowsByIdentifier || {}
    const translations = this.props.parentState.asset?.content?.translations || []
    const reportStyle = this.state.reportStyle

    const groupByOptions = [
      {
        value: '',
        label: t('No grouping'),
      },
      ...Object.values(rows)
        .filter((row) => row.type === 'select_one')
        .map((row) => ({
          value: row.name || row.$autoname || '', // Safeguard for TS reasons, either of names should always exist.
          label: row.label?.[(translations.length > 1 && reportStyle.translationIndex) || 0] ?? row.label?.[0] ?? '',
        })),
    ]

    const tabs: ReportsModalTabNames[] = [
      ReportsModalTabNames['chart-type'],
      ReportsModalTabNames.colors,
      groupByOptions.length > 1 ? ReportsModalTabNames['group-by'] : null,
      translations.length > 1 ? ReportsModalTabNames.translation : null,
    ].filter((v) => !!v)

    const selectedTranslationOptions: LabelValuePair[] = translations?.map((row, i) => ({
      value: String(i),
      label: row || t('Unnamed language'),
    }))

    return (
      <bem.GraphSettings>
        <Modal.Tabs>
          <ReportsModalTabs
            tabs={tabs}
            activeTabName={this.state.activeModalTab}
            onRequestTabChange={this.toggleTab.bind(this)}
          />
        </Modal.Tabs>

        <Modal.Body>
          <div className='tabs-content'>
            {this.state.activeModalTab === ReportsModalTabNames['chart-type'] && (
              <div id='graph-type'>
                <ReportTypeEditor style={reportStyle} onChange={this.onReportTypeChange.bind(this)} />
              </div>
            )}
            {this.state.activeModalTab === ReportsModalTabNames.colors && (
              <div id='graph-colors'>
                <ReportColorsEditor style={reportStyle} onChange={this.onReportColorsChange.bind(this)} />
              </div>
            )}
            {this.state.activeModalTab === ReportsModalTabNames['group-by'] && (
              <div className='graph-tab__groupby' id='graph-labels' dir='auto'>
                <Radio
                  name='reports-groupby'
                  options={groupByOptions}
                  onChange={this.onGroupByChange.bind(this)}
                  selected={reportStyle.groupDataBy || ''}
                />
              </div>
            )}
            {this.state.activeModalTab === ReportsModalTabNames.translation && (
              <div className='graph-tab__translation' id='graph-labels'>
                <Radio
                  name='reports-selected-translation'
                  options={selectedTranslationOptions}
                  onChange={this.onTranslationIndexChange.bind(this)}
                  selected={String(reportStyle.translationIndex)}
                />
              </div>
            )}
          </div>

          <Modal.Footer>
            <Button
              type='primary'
              size='l'
              onClick={this.saveReportStyles.bind(this)}
              label={t('Save')}
              isPending={this.state.isPending}
            />
          </Modal.Footer>
        </Modal.Body>
      </bem.GraphSettings>
    )
  }
}
