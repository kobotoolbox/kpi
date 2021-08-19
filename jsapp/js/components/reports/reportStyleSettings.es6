import React from 'react';
import autoBind from 'react-autobind';
import Radio from 'js/components/common/radio';
import {actions} from 'js/actions';
import bem from 'js/bem';
import Modal from 'js/components/common/modal';
import {assign} from 'utils';
import ChartTypePicker from './chartTypePicker';
import ChartColorsPicker from './chartColorsPicker';

export default class ReportStyleSettings extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
    this.state = {
      activeModalTab: 0,
      reportStyle: props.parentState.reportStyles.default,
    };

    if (
      props.parentState.currentCustomReport &&
      props.parentState.currentCustomReport.reportStyle
    ) {
      this.state.reportStyle =
        props.parentState.currentCustomReport.reportStyle;
    }
  }

  toggleTab(evt) {
    var i = evt.target.getAttribute('data-index');
    this.setState({
      activeModalTab: parseInt(i),
    });
  }

  reportStyleChange(params, value) {
    let styles = this.state.reportStyle;
    assign(styles, value);
    this.setState({reportStyle: styles});
  }

  reportSizeChange(params) {
    if (params.id === 'width') {
      let styles = this.state.reportStyle;
      styles.graphWidth = params.value;
      this.setState({reportStyle: styles});
    }
  }

  translationIndexChange(name, value) {
    let styles = this.state.reportStyle;
    styles.translationIndex = parseInt(value);
    this.setState({reportStyle: styles});
  }

  onGroupByChange(name, value) {
    let styles = this.state.reportStyle;
    styles.groupDataBy = value;
    this.setState({reportStyle: styles});
  }

  saveReportStyles() {
    let currentCustomReport = this.props.parentState.currentCustomReport;
    let assetUid = this.props.parentState.asset.uid;
    if (currentCustomReport) {
      let report_custom = this.props.parentState.asset.report_custom;
      report_custom[
        currentCustomReport.crid
      ].reportStyle = this.state.reportStyle;
      actions.reports.setCustom(assetUid, report_custom);
    } else {
      let sett_ = this.props.parentState.reportStyles;
      assign(sett_.default, this.state.ReportStyle);
      actions.reports.setStyle(assetUid, sett_);
    }
  }

  render() {
    let rows = this.props.parentState.rowsByIdentifier || {};
    let translations = this.props.parentState.translations;
    let reportStyle = this.state.reportStyle;

    const groupByOptions = [];
    groupByOptions.push({
      value: '',
      label: t('No grouping'),
    });

    for (let key in rows) {
      if (
        rows.hasOwnProperty(key) &&
        rows[key].hasOwnProperty('type') &&
        rows[key].type === 'select_one'
      ) {
        const row = rows[key];
        const val = row.name || row.$autoname;
        let label = row.label;
        if (translations) {
          label = row.label[reportStyle.translationIndex];
        }
        groupByOptions.push({
          value: val,
          label: label,
        });
      }
    }

    var tabs = [t('Chart Type'), t('Colors')];

    if (groupByOptions.length > 1) {
      tabs.push(t('Group By'));
    }

    const selectedTranslationOptions = [];
    if (translations) {
      tabs.push(t('Translation'));
      this.props.parentState.asset.content.translations.map((row, i) => {
        selectedTranslationOptions.push({
          value: i,
          label: row || t('Unnamed language'),
        });
      });
    }

    var modalTabs = tabs.map(function (tab, i) {
      let tabClassNames = [
        'mdl-button',
        'mdl-button--tab',
      ];
      if (this.state.activeModalTab === i) {
        tabClassNames.push('active');
      }
      return (
        <button
          className={tabClassNames.join(' ')}
          onClick={this.toggleTab}
          data-index={i}
          key={i}
        >
          {tab}
        </button>
      );
    }, this);

    return (
      <bem.GraphSettings>
        <Modal.Tabs>{modalTabs}</Modal.Tabs>
        <Modal.Body>
          <div className='tabs-content'>
            {tabs[this.state.activeModalTab] === t('Chart Type') && (
              <div id='graph-type'>
                <ChartTypePicker
                  defaultStyle={reportStyle}
                  onChange={this.reportStyleChange}
                />
              </div>
            )}
            {tabs[this.state.activeModalTab] === t('Colors') && (
              <div id='graph-colors'>
                <ChartColorsPicker
                  defaultStyle={reportStyle}
                  onChange={this.reportStyleChange}
                />
              </div>
            )}
            {tabs[this.state.activeModalTab] === t('Group By') &&
              groupByOptions.length > 1 && (
                <div className='graph-tab__groupby' id='graph-labels'>
                  <Radio
                    name='reports-groupby'
                    options={groupByOptions}
                    onChange={this.onGroupByChange}
                    selected={reportStyle.groupDataBy}
                  />
                </div>
              )}
            {tabs[this.state.activeModalTab] === t('Translation') &&
              selectedTranslationOptions.length > 1 && (
                <div className='graph-tab__translation' id='graph-labels'>
                  <Radio
                    name='reports-selected-translation'
                    options={selectedTranslationOptions}
                    onChange={this.translationIndexChange}
                    selected={reportStyle.translationIndex}
                  />
                </div>
              )}
          </div>
          <Modal.Footer>
            <bem.KoboButton m='blue' onClick={this.saveReportStyles}>
              {t('Save')}
            </bem.KoboButton>
          </Modal.Footer>
        </Modal.Body>
      </bem.GraphSettings>
    );
  }
}
