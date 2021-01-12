import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import _ from 'underscore';
import {dataInterface} from '../dataInterface';
import Checkbox from './checkbox';
import Radio from './radio';
import {actions} from '../actions';
import {bem} from '../bem';
import {stores} from '../stores';
import ui from '../ui';
import mixins from '../mixins';
import DocumentTitle from 'react-document-title';
import { txtid } from '../../xlform/src/model.utils';
import alertify from 'alertifyjs';

import ReportViewItem from './reportViewItem';

import {
  assign,
  launchPrinting
} from 'utils';
import {REPORT_STYLES} from 'js/constants';

let reportStyles = [
  REPORT_STYLES.vertical,
  REPORT_STYLES.donut,
  REPORT_STYLES.area,
  REPORT_STYLES.horizontal,
  REPORT_STYLES.pie,
  REPORT_STYLES.line,
];

class ChartTypePicker extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }
  defaultReportStyleChange (e) {
    this.props.onChange({
      default: true,
    }, {
      report_type: e.currentTarget.value || 'bar'
    });
  }
  render () {
    var radioButtons = reportStyles.map(function(style, i){
      return (
          <bem.GraphSettings__radio m={style.value} key={i}>
              <input type='radio' name='chart_type'
                value={style.value}
                checked={this.props.defaultStyle.report_type === style.value}
                onChange={this.defaultReportStyleChange}
                id={'type-' + style.value} />
              <label htmlFor={'type-' + style.value}>
                {style.label}
              </label>
          </bem.GraphSettings__radio>
      );
    }, this);

    return (
        <bem.GraphSettings__charttype>
          {radioButtons}
        </bem.GraphSettings__charttype>
      );
  }
}

let reportColorSets = [
  {
    label: 'set1',
    colors: [
      'rgba(52, 106, 200, 0.8)',
      'rgba(252, 74, 124, 0.8)',
      'rgba(250, 213, 99, 0.8)',
      'rgba(113, 230, 33, 0.8)',
      'rgba(78, 203, 255, 0.8)',
      'rgba(253, 190, 76, 0.8)',
      'rgba(77, 124, 244, 0.8)',
      'rgba(33, 231, 184, 0.8)'
    ]
  },
  {
    label: 'set2',
    colors: [
      'rgba(40, 106, 163, 0.8)',
      'rgba(69, 137, 197, 0.8)',
      'rgba(0, 123, 234, 0.8)',
      'rgba(0, 134, 255, 0.8)',
      'rgba(50, 159, 255, 0.8)',
      'rgba(100, 182, 255, 0.8)',
      'rgba(141, 200, 255, 0.8)',
      'rgba(192, 224, 255, 0.8)'
    ]
  },
  {
    label: 'set3',
    colors: [
      'rgba(39, 69, 255, 0.8)',
      'rgba(34, 122, 233, 0.8)',
      'rgba(46, 145, 243, 0.8)',
      'rgba(92, 173, 255, 0.8)',
      'rgba(148, 200, 255, 0.8)',
      'rgba(31, 174, 228, 0.8)',
      'rgba(25, 214, 209, 0.8)',
      'rgba(28, 234, 225, 0.8)'
    ]
  },
  {
    label: 'set4',
    colors: [
      'rgba(253, 35, 4, 0.8)',
      'rgba(253, 104, 97, 0.8)',
      'rgba(232, 65, 14, 0.8)',
      'rgba(253, 146, 72, 0.8)',
      'rgba(233, 139, 3, 0.8)',
      'rgba(253, 215, 114, 0.8)',
      'rgba(254, 227, 159, 0.8)',
      'rgba(253, 146, 72, 0.8)'
    ]
  },
  {
    label: 'set5',
    colors: [
      'rgba(63, 63, 63, 1)',
      'rgba(90, 90, 90, 1)',
      'rgba(107, 107, 107, 1)',
      'rgba(128, 128, 128, 1)',
      'rgba(151, 151, 151, 1)',
      'rgba(169, 169, 169, 1)',
      'rgba(196, 196, 196, 1)',
      'rgba(178, 179, 190, 1)'
    ]
  }
];

class ChartColorsPicker extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }
  defaultReportColorsChange (e) {
    this.props.onChange({
      default: true,
    }, {
      report_colors: reportColorSets[e.currentTarget.value].colors || reportColorSets[0].colors
    });
  }
  defaultValue (set, index) {
    if (this.props.defaultStyle.report_colors === undefined && index === 0)
      return true;

    return JSON.stringify(this.props.defaultStyle.report_colors) === JSON.stringify(set.colors);
  }
  render () {
    var radioButtons = reportColorSets.map(function(set, index){
      return (
        <bem.GraphSettings__radio key={index}>
          <input type='radio' name='chart_colors'
            value={index}
            checked={this.defaultValue(set, index)}
            onChange={this.defaultReportColorsChange}
            id={'type-' + set.label} />
          <label htmlFor={'type-' + set.label}>
          {
            reportColorSets[index].colors.map(function(color, i){
              return (
                <div style={{backgroundColor: color}} key={i} />
              );
            }, this)
          }
          </label>
        </bem.GraphSettings__radio>
      );
    }, this);

    return (
        <bem.GraphSettings__colors>
          {radioButtons}
        </bem.GraphSettings__colors>
      );
  }
};

class CustomReportForm extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);

    this.state = {
      customReport: props.customReport
    };
  }
  customReportNameChange(e) {
    var r = this.state.customReport;
    r.name = e.target.value;
    this.setState({customReport: r});
  }
  customReportQuestionChange(name, isChecked) {
    var r = this.state.customReport;

    if (isChecked) {
      r.questions.push(name);
    } else {
      r.questions.splice(r.questions.indexOf(name), 1);
    }
    this.setState({customReport: r});
  }
  saveCustomReport() {
    let report_custom = this.props.asset.report_custom;
    const crid = this.state.customReport.crid;

    report_custom[crid] = this.state.customReport;
    actions.reports.setCustom(this.props.asset.uid, report_custom);
  }
  deleteCustomReport() {
    let report_custom = this.props.asset.report_custom;
    const crid = this.state.customReport.crid;

    delete report_custom[crid];
    actions.reports.setCustom(this.props.asset.uid, report_custom);
  }
  render () {
    const crid = this.state.customReport.crid;
    var questionList = this.props.reportData.map(function(q, i){
      return (
        <div className='graph-settings__question' key={i}>
            <Checkbox
              checked={this.state.customReport.questions.includes(q.name)}
              onChange={this.customReportQuestionChange.bind(this, q.name)}
              label={q.row.label ? q.row.label[0] : t('Unlabeled') }
            />
        </div>
      );
    }, this);

    return (
      <div className='custom-report-form'>
        <div className='custom-report--title'>
          <input type='text' name='title'
                  value={this.state.customReport.name}
                  placeholder={t('Untitled Report')}
                  onChange={this.customReportNameChange} />
        </div>
        <strong>{t('Include the following questions:')}</strong>
        <div className='custom-report--questions'>
          {questionList}
        </div>
        <bem.Modal__footer>
          {this.props.asset.report_custom[crid] &&
            <bem.KoboButton
              m='red'
              onClick={this.deleteCustomReport}
            >
              {t('Delete')}
            </bem.KoboButton>
          }
          <bem.KoboButton
            m='blue'
            onClick={this.saveCustomReport}
          >
            {t('Save')}
          </bem.KoboButton>
        </bem.Modal__footer>
      </div>
    );
  }
};

class QuestionGraphSettings extends React.Component {
  constructor(props) {
    super();

    this.state = {
      activeModalTab: 0,
      rStyle: {
        report_type: false,
        report_colors: false,
        width: false
      }
    };

    autoBind(this);
  }
  toggleTab(evt) {
    var i = evt.target.getAttribute('data-index');
    this.setState({activeModalTab: parseInt(i)});
  }
  componentDidMount() {
    let _qn = this.props.question,
        specificSettings = undefined;

    if (!this.props.parentState.currentCustomReport) {
      specificSettings = this.props.parentState.reportStyles.specified;
    } else {
      specificSettings = this.props.parentState.currentCustomReport.specified;
    }

    if (specificSettings && specificSettings[_qn] && Object.keys(specificSettings[_qn]).length) {
      const rStyle = Object.assign({}, specificSettings[_qn]);
      this.setState({rStyle: rStyle});
    }
  }
  saveQS(reset) {
    let assetUid = this.props.parentState.asset.uid,
        customReport = this.props.parentState.currentCustomReport,
        _qn = this.props.question;

    if (!customReport) {
      var sett_ = this.props.parentState.reportStyles;
      sett_.specified[_qn] = reset ? {} : this.state.rStyle;
      actions.reports.setStyle(assetUid, sett_);
    } else {
      let report_custom = this.props.parentState.asset.report_custom;
      if (report_custom[customReport.crid].specified === undefined)
        report_custom[customReport.crid].specified = {};

      report_custom[customReport.crid].specified[_qn] = reset ? {} : this.state.rStyle;
      actions.reports.setCustom(assetUid, report_custom);
    }
  }
  questionStyleChange(params, value) {
    var styles = this.state.rStyle;

    if (value && value.report_type)
      styles.report_type = value.report_type;
    if (value && value.report_colors)
      styles.report_colors = value.report_colors;
    if (params && params.id == 'width')
      styles.width = params.value;

    this.setState({rStyle: styles});
  }
  render () {
    let asset = this.props.parentState.asset,
        reportStyle = this.state.rStyle;

    var tabs = [t('Chart Type'), t('Colors')];
    var modalTabs = tabs.map(function(tab, i) {
      return (
        <button className={`mdl-button mdl-button--tab ${this.state.activeModalTab === i ? 'active' : ''}`}
                onClick={this.toggleTab}
                data-index={i}
                key={i}>
          {tab}
        </button>
      );
    }, this);

    return (
      <bem.GraphSettings>
        <ui.Modal.Tabs>
          {modalTabs}
        </ui.Modal.Tabs>
        <ui.Modal.Body>
          <div className='tabs-content'>
            {this.state.activeModalTab === 0 &&
              <div id='graph-type'>
                <ChartTypePicker
                  defaultStyle={reportStyle}
                  onChange={this.questionStyleChange}
                />
              </div>
            }
            {this.state.activeModalTab === 1 &&
              <div id='graph-colors'>
                <ChartColorsPicker
                  defaultStyle={reportStyle}
                  onChange={this.questionStyleChange} />
              </div>
            }
          </div>
        </ui.Modal.Body>

        <ui.Modal.Footer>
          {(reportStyle.report_type || reportStyle.report_colors || reportStyle.width) &&
            <bem.Button className='reset' onClick={this.saveQS.bind(this, true)}>
              {t('Reset')}
            </bem.Button>
          }
          <bem.Button className='primary' onClick={this.saveQS.bind(this, false)}>
            {t('Save')}
          </bem.Button>
        </ui.Modal.Footer>
      </bem.GraphSettings>
    );
  }
};

class ReportContents extends React.Component {
  constructor(props) {
    super(props);
  }
  shouldComponentUpdate(nextProps, nextState) {
    // to improve UI performance, don't refresh report while a modal window is visible
    if (nextProps.parentState.showReportGraphSettings
        || nextProps.parentState.showCustomReportModal
        || nextProps.parentState.currentQuestionGraph) {
      return false;
    } else {
      return true;
    }
  }
  render () {
    var tnslIndex = 0;
    let customReport = this.props.parentState.currentCustomReport,
        defaultRS = this.props.parentState.reportStyles,
        asset = this.props.parentState.asset,
        groupBy = this.props.parentState.groupBy;

    if (customReport) {
      if (customReport.reportStyle && customReport.reportStyle.translationIndex)
        tnslIndex = parseInt(customReport.reportStyle.translationIndex);
    } else {
      tnslIndex = defaultRS.default.translationIndex || 0;
    }

    // reset to first language if trnslt index cannot be found
    if (asset.content.translations && !asset.content.translations[tnslIndex])
      tnslIndex = 0;

    var reportData = this.props.reportData;

    for (var i = reportData.length - 1; i > -1; i--) {
      let _qn = reportData[i].name,
          _type = reportData[i].row.type || null;

      var _defSpec = undefined;

      if (customReport) {
        if (customReport.specified && customReport.specified[_qn])
          _defSpec = customReport.specified[_qn];
      } else {
        _defSpec = defaultRS.specified[_qn];
      }

      if (_defSpec && Object.keys(_defSpec).length) {
        reportData[i].style = _defSpec;
      } else {
        if (customReport && customReport.reportStyle) {
          reportData[i].style = customReport.reportStyle;
        } else {
          reportData[i].style = defaultRS.default;
        }
      }

      if ((_type === 'select_one' || _type === 'select_multiple') && asset.content.choices) {
        let question = asset.content.survey.find(z => z.name === _qn || z.$autoname === _qn);
        let resps = reportData[i].data.responses;
        let choice;
        if (resps) {
          reportData[i].data.responseLabels = [];
          for (var j = resps.length - 1; j >= 0; j--) {
            choice = asset.content.choices.find(o => question && o.list_name === question.select_from_list_name && (o.name === resps[j] || o.$autoname == resps[j]));
            if (choice && choice.label && choice.label[tnslIndex])
              reportData[i].data.responseLabels.unshift(choice.label[tnslIndex]);
            else
              reportData[i].data.responseLabels.unshift(resps[j]);
          }
        } else {
          const vals = reportData[i].data.values;
          if (vals && vals[0] && vals[0][1] && vals[0][1].responses) {
            var respValues = vals[0][1].responses;
            reportData[i].data.responseLabels = [];
            let qGB = asset.content.survey.find(z => z.name === groupBy || z.$autoname === groupBy);
            respValues.forEach(function(r, ind){
              choice = asset.content.choices.find(o => qGB && o.list_name === qGB.select_from_list_name && (o.name === r || o.$autoname == r));
              reportData[i].data.responseLabels[ind] = (choice && choice.label && choice.label[tnslIndex]) ? choice.label[tnslIndex] : r;
            });

            // TODO: use a better way to store translated labels per row
            for (var vD = vals.length - 1; vD >= 0; vD--) {
              choice = asset.content.choices.find(o => question && o.list_name === question.select_from_list_name && (o.name === vals[vD][0] || o.$autoname == vals[vD][0]));
              vals[vD][2] = (choice && choice.label && choice.label[tnslIndex]) ? choice.label[tnslIndex] : vals[vD][0];
            }
          }
        }
      }
    }

    return (
      <div>
        {
          reportData.map((rowContent, i)=>{
            let label = t('Unlabeled');
            if (_.isArray(rowContent.row.label)) {
              label = rowContent.row.label[tnslIndex];
            } else if (_.isString(rowContent.row.label)) {
              label = rowContent.row.label;
            }

            if (!rowContent.data.provided)
              return false;

            return (
                <bem.ReportView__item key={i}>
                  <ReportViewItem
                      {...rowContent}
                      label={label}
                      triggerQuestionSettings={this.props.triggerQuestionSettings} />
                </bem.ReportView__item>
              );
          })
        }
      </div>
    );
  }
};

class ReportStyleSettings extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
    this.state = {
      activeModalTab: 0,
      reportStyle: props.parentState.reportStyles.default
    };

    if (props.parentState.currentCustomReport && props.parentState.currentCustomReport.reportStyle) {
      this.state.reportStyle = props.parentState.currentCustomReport.reportStyle;
    }
  }
  toggleTab(evt) {
    var i = evt.target.getAttribute('data-index');
    this.setState({
      activeModalTab: parseInt(i),
    });
  }
  reportStyleChange (params, value) {
    let styles = this.state.reportStyle;
    assign(styles, value);
    this.setState({reportStyle: styles});
  }
  reportSizeChange (params) {
    if (params.id == 'width') {
      let styles = this.state.reportStyle;
      styles.graphWidth = params.value;
      this.setState({reportStyle: styles});
    }
  }
  translationIndexChange (name, value) {
    let styles = this.state.reportStyle;
    styles.translationIndex = parseInt(value);
    this.setState({reportStyle: styles});
  }
  onGroupByChange (name, value) {
    let styles = this.state.reportStyle;
    styles.groupDataBy = value;
    this.setState({reportStyle: styles});
  }
  saveReportStyles() {
    let currentCustomReport = this.props.parentState.currentCustomReport;
    let assetUid = this.props.parentState.asset.uid;
    if (currentCustomReport) {
      let report_custom = this.props.parentState.asset.report_custom;
      report_custom[currentCustomReport.crid].reportStyle = this.state.reportStyle;
      actions.reports.setCustom(assetUid, report_custom);
    } else {
      let sett_ = this.props.parentState.reportStyles;
      assign(sett_.default, this.state.ReportStyle);
      actions.reports.setStyle(assetUid, sett_);
    }
  }
  render () {
    let asset = this.props.parentState.asset,
        rowsByKuid = this.props.parentState.rowsByKuid,
        rows = this.props.parentState.rowsByIdentifier || {},
        translations = this.props.parentState.translations,
        reportStyle = this.state.reportStyle;

    const groupByOptions = [];
    groupByOptions.push({
      value: '',
      label: t('No grouping')
    });
    for (let key in rows) {
      if (
        rows.hasOwnProperty(key) &&
        rows[key].hasOwnProperty('type') &&
        rows[key].type == 'select_one'
      ) {
        const row = rows[key];
        const val = row.name || row.$autoname;
        const label = translations ? row.label[reportStyle.translationIndex] : row.label;
        groupByOptions.push({
          value: val,
          label: label
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
          label: row || t('Unnamed language')
        });
      })
    }

    var modalTabs = tabs.map(function(tab, i){
      return (
        <button className={`mdl-button mdl-button--tab ${this.state.activeModalTab === i ? 'active' : ''}`}
                onClick={this.toggleTab}
                data-index={i}
                key={i}>
          {tab}
        </button>
      );
    }, this);

    return (
      <bem.GraphSettings>
        <ui.Modal.Tabs>
          {modalTabs}
        </ui.Modal.Tabs>
        <ui.Modal.Body>
          <div className='tabs-content'>
            {tabs[this.state.activeModalTab] === t('Chart Type') &&
              <div id='graph-type'>
                <ChartTypePicker
                  defaultStyle={reportStyle}
                  onChange={this.reportStyleChange}
                />
              </div>
            }
            {tabs[this.state.activeModalTab] === t('Colors') &&
              <div id='graph-colors'>
                <ChartColorsPicker
                  defaultStyle={reportStyle}
                  onChange={this.reportStyleChange} />
              </div>
            }
            {tabs[this.state.activeModalTab] === t('Group By') && groupByOptions.length > 1 &&
              <div className='graph-tab__groupby' id='graph-labels'>
                <Radio
                  name='reports-groupby'
                  options={groupByOptions}
                  onChange={this.onGroupByChange}
                  selected={reportStyle.groupDataBy}
                />
              </div>
            }
            {tabs[this.state.activeModalTab] === t('Translation') && selectedTranslationOptions.length > 1 &&
              <div className='graph-tab__translation' id='graph-labels'>
                <Radio
                  name='reports-selected-translation'
                  options={selectedTranslationOptions}
                  onChange={this.translationIndexChange}
                  selected={reportStyle.translationIndex}
                />
              </div>
            }
          </div>
          <ui.Modal.Footer>
            <bem.KoboButton m='blue' onClick={this.saveReportStyles}>
              {t('Save')}
            </bem.KoboButton>
          </ui.Modal.Footer>
        </ui.Modal.Body>
      </bem.GraphSettings>
    );

  }
};

class Reports extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      graphWidth: '700',
      graphHeight: '250',
      translations: false,
      activeModalTab: 0,
      error: false,
      isFullscreen: false,
      reportLimit: 200,
      customReports: false,
      showReportGraphSettings: false,
      showCustomReportModal: false,
      currentCustomReport: false,
      currentQuestionGraph: false,
      groupBy: ''
    };
    autoBind(this);
  }
  componentDidMount () {
    this.loadReportData();
    this.listenTo(actions.reports.setStyle, this.reportStyleListener);
    this.listenTo(actions.reports.setCustom, this.reportCustomListener);
  }
  componentDidUpdate(prevProps, prevState) {
    if (this.state.currentCustomReport != prevState.currentCustomReport) {
      this.refreshReportData();
    }
    if (this.state.groupBy != prevState.groupBy) {
      this.refreshReportData();
    }
  }
  loadReportData() {
    const uid = this.props.params.assetid || this.props.params.uid;

    stores.allAssets.whenLoaded(uid, (asset)=>{
      let rowsByKuid = {};
      let rowsByIdentifier = {};
      let groupBy = '',
          reportStyles = asset.report_styles,
          reportCustom = asset.report_custom;

      if (
        this.state.currentCustomReport &&
        this.state.currentCustomReport.reportStyle &&
        this.state.currentCustomReport.reportStyle.groupDataBy
      ) {
        groupBy = this.state.currentCustomReport.reportStyle.groupDataBy;
      } else if (reportStyles.default.groupDataBy !== undefined) {
        groupBy = reportStyles.default.groupDataBy;
      }

      // TODO: improve the defaults below
      if (reportStyles.default.report_type === undefined) {
        reportStyles.default.report_type = REPORT_STYLES.vertical.value;
      }
      if (reportStyles.default.translationIndex === undefined) {
        reportStyles.default.translationIndex = 0;
      }
      if (reportStyles.default.groupDataBy === undefined) {
        reportStyles.default.groupDataBy = '';
      }

      if (asset.content.survey != undefined) {
        asset.content.survey.forEach(function(r){
          if (r.$kuid) {
            rowsByKuid[r.$kuid] = r;
          }

          let $identifier = r.$autoname || r.name;
          rowsByIdentifier[$identifier] = r;
        });

        dataInterface.getReportData({uid: uid, identifiers: [], group_by: groupBy}).done((data)=> {
          var dataWithResponses = [];

          data.list.forEach(function(row){
            if (row.data.responses || row.data.values || row.data.mean) {
              if (rowsByIdentifier[row.name] !== undefined) {
                row.row.label = rowsByIdentifier[row.name].label;
              } else if (row.name !== undefined) {
                row.row.label = row.name;
              } else {
                row.row.label = t('untitled');
              }
              dataWithResponses.push(row);
            }
          });

          this.setState({
            asset: asset,
            rowsByKuid: rowsByKuid,
            rowsByIdentifier: rowsByIdentifier,
            reportStyles: reportStyles,
            reportData: dataWithResponses,
            reportCustom: reportCustom,
            translations: asset.content.translations.length > 1 ? true : false,
            groupBy: groupBy,
            error: false
          });
        }).fail((err)=> {
          if (groupBy && groupBy.length > 0 && !this.state.currentCustomReport && reportStyles.default.groupDataBy !== undefined) {
            // reset default report groupBy if it fails and notify user
            reportStyles.default.groupDataBy = '';
            this.setState({
              reportStyles: reportStyles
            });
            alertify.error(t('Could not load grouped results via "##". Will attempt to load the ungrouped report.').replace('##', groupBy));
            this.loadReportData();
          } else {
            this.setState({
              error: err,
              asset: asset
            });
          }
        });
      } else {
        // Redundant?
        console.error('Survey not defined.');
      }
    });
  }
  refreshReportData() {
    let uid = this.props.params.assetid || this.props.params.uid,
        rowsByIdentifier = this.state.rowsByIdentifier,
        customReport = this.state.currentCustomReport;

    var groupBy = '';

    if (!customReport && this.state.reportStyles.default.groupDataBy !== undefined)
      groupBy = this.state.reportStyles.default.groupDataBy;

    if (customReport && customReport.reportStyle && customReport.reportStyle.groupDataBy)
      groupBy = this.state.currentCustomReport.reportStyle.groupDataBy;

    dataInterface.getReportData({uid: uid, identifiers: [], group_by: groupBy}).done((data)=>{
      var dataWithResponses = [];

      data.list.forEach(function(row){
        if (row.data.responses || row.data.values || row.data.mean) {
          if (rowsByIdentifier[row.name] !== undefined) {
            row.row.label = rowsByIdentifier[row.name].label;
          } else if (row.name !== undefined) {
            row.row.label = row.name;
          } else {
            row.row.label = t('untitled');
          }
          dataWithResponses.push(row);
        }
      });

      this.setState({
        reportData: dataWithResponses,
        error: false
      });
    }).fail((err)=> {
      alertify.error(t('Could not refresh report.'));
      this.setState({
        error: err
      });
    });
  }
  reportStyleListener(assetUid, reportStyles) {
    this.setState({
      reportStyles: reportStyles,
      showReportGraphSettings: false,
      currentQuestionGraph: false,
      groupBy: reportStyles.default.groupDataBy
    });
  }
  reportCustomListener(assetUid, reportCustom) {
    var crid = this.state.currentCustomReport.crid;
    if (reportCustom[crid]) {
      this.setState({
        reportCustom: reportCustom,
        showCustomReportModal: false,
        showReportGraphSettings: false,
        currentQuestionGraph: false,
        groupBy: (reportCustom[crid].reportStyle && reportCustom[crid].reportStyle.groupDataBy) ? reportCustom[crid].reportStyle.groupDataBy : false
      });
    } else {
      this.setState({
        reportCustom: reportCustom,
        showCustomReportModal: false,
        showReportGraphSettings: false,
        currentQuestionGraph: false,
        currentCustomReport: false,
        groupBy: (reportStyles.default && reportStyles.default.groupDataBy) ? reportStyles.default.groupDataBy : false
      });
    }
  }
  toggleReportGraphSettings () {
    this.setState({
      showReportGraphSettings: !this.state.showReportGraphSettings,
    });
  }
  hasAnyProvidedData (reportData) {
    let hasAny = false;
    reportData.map((rowContent, i)=>{
      if (rowContent.data.provided) {
        hasAny = true;
      }
    });
    return hasAny;
  }
  setCustomReport (e) {
    var crid = e ? e.target.getAttribute('data-crid') : false;

    if(!this.state.showCustomReportModal) {
      let currentCustomReport;
      if (crid) {
        // existing report
        currentCustomReport = this.state.reportCustom[crid];
      } else {
        // new custom report
        currentCustomReport = {
          crid: txtid(),
          name: '',
          questions: []
        }
      }
      this.setState({currentCustomReport: currentCustomReport});
    }
  }
  editCustomReport () {
    if(this.state.currentCustomReport) {
      this.setState({showCustomReportModal: true});
    }
  }
  toggleCustomReportModal () {
    if(!this.state.showCustomReportModal) {
      this.setCustomReport();
    } else {
      if (this.state.currentCustomReport) {
        var crid = this.state.currentCustomReport.crid;
        if (this.state.reportCustom[crid] == undefined) {
          this.triggerDefaultReport();
        }
      }
    }

    this.setState({showCustomReportModal: !this.state.showCustomReportModal});
  }
  triggerDefaultReport() {
    this.setState({currentCustomReport: false});
  }
  toggleFullscreen () {
    this.setState({isFullscreen: !this.state.isFullscreen});
  }
  renderReportButtons () {
    var customReports = this.state.reportCustom || {};
    var customReportsList = [];
    for (var key in customReports) {
      if (customReports[key] && customReports[key].crid)
        customReportsList.push(customReports[key]);
    }

    customReportsList.sort((a, b) => a.name.localeCompare(b.name));
    var _this = this;

    return (
      <bem.FormView__reportButtons>
        <ui.PopoverMenu type='custom-reports'
            triggerLabel={this.state.currentCustomReport ? (this.state.currentCustomReport.name || t('Untitled Report')) : t('Custom Reports')}>
            <bem.PopoverMenu__link
              key='default'
              data-name=''
              onClick={this.triggerDefaultReport}
              className={!this.state.currentCustomReport ? 'active' : ''}>
                {t('Default Report')}
            </bem.PopoverMenu__link>
            {
              customReportsList.map(function(m) {
                return (
                  <bem.PopoverMenu__link
                    key={m.crid}
                    data-crid={m.crid}
                    onClick={_this.setCustomReport}
                    className={(_this.state.currentCustomReport && _this.state.currentCustomReport.crid == m.crid) ? 'active' : ''}>
                      {m.name || t('Untitled report')}
                  </bem.PopoverMenu__link>
                );
              })
            }
            {this.userCan('change_asset', this.state.asset) &&
              <bem.PopoverMenu__link
                key='new'
                onClick={this.toggleCustomReportModal}>
                  {t('Create New Report')}
              </bem.PopoverMenu__link>
            }
        </ui.PopoverMenu>

        {this.state.currentCustomReport &&
          <bem.Button m='icon' className='report-button__edit'
                onClick={this.editCustomReport}
                data-tip={t('Edit Report Questions')}>
            <i className='k-icon-edit' />
          </bem.Button>
        }

        <bem.Button
          m='icon' className='report-button__expand right-tooltip'
          onClick={this.toggleFullscreen}
          data-tip={t('Toggle fullscreen')}
        >
          <i className='k-icon-expand' />
        </bem.Button>

        <bem.Button m='icon' className='report-button__print'
                onClick={launchPrinting}
                data-tip={t('Print')}>
          <i className='k-icon-print' />
        </bem.Button>

        {this.userCan('change_asset', this.state.asset) &&
          <bem.Button m='icon' className='report-button__settings'
                  onClick={this.toggleReportGraphSettings}
                  data-tip={t('Configure Report Style')}>
            <i className='k-icon-settings' />
          </bem.Button>
        }
      </bem.FormView__reportButtons>
    );
  }
  renderCustomReportModal () {
    return (
      <bem.GraphSettings>
        <ui.Modal.Body>
          <CustomReportForm reportData={this.state.reportData}
                            customReport={this.state.currentCustomReport}
                            asset={this.state.asset}/>
        </ui.Modal.Body>
      </bem.GraphSettings>
    );
  }
  resetReportLimit () {
    this.setState({
      reportLimit: false,
    });
  }
  triggerQuestionSettings(evt) {
    let question = evt.target.getAttribute('data-question');
    if (question) {
      this.setState({currentQuestionGraph: question});
    }
  }
  renderQuestionSettings () {
    return (
      <bem.GraphSettings>
        <ui.Modal.Body/>
      </bem.GraphSettings>
    );
  }
  closeQuestionSettings () {
    this.setState({currentQuestionGraph: false});
  }

  render () {
    if (!this.state.asset) {
      return (
          <bem.Loading>
            {this.state.error ?
              <bem.Loading__inner>
                {t('This report cannot be loaded.')}
                <br/>
                <code>
                  {this.state.error.statusText + ': ' + this.state.error.responseText}
                </code>
              </bem.Loading__inner>
            :
              <bem.Loading__inner>
                <i />
                {t('loading...')}
              </bem.Loading__inner>
            }
          </bem.Loading>
      );
    }

    let asset = this.state.asset,
        currentCustomReport = this.state.currentCustomReport,
        rowsByKuid = this.state.rowsByKuid,
        docTitle;

    if (asset && asset.content)
      docTitle = asset.name || t('Untitled');

    var reportData = this.state.reportData || [];

    if (reportData.length) {
      if (currentCustomReport && currentCustomReport.questions.length) {
        const currentQuestions = currentCustomReport.questions;
        const fullReportData = this.state.reportData;
        reportData = fullReportData.filter(q => currentQuestions.includes(q.name));
      }

      if (this.state.reportLimit && reportData.length > this.state.reportLimit) {
        reportData = reportData.slice(0, this.state.reportLimit);
      }
    }

    if (this.state.reportData === undefined) {
      return (
        <bem.Loading>
          {this.state.error ?
            <bem.Loading__inner>
              {t('This report cannot be loaded.')}
              <br/>
              <code>
                {this.state.error.statusText + ': ' + this.state.error.responseText}
              </code>
            </bem.Loading__inner>
          :
            <bem.Loading__inner>
              <i />
              {t('loading...')}
            </bem.Loading__inner>
          }
        </bem.Loading>
      );
    }

    const formViewModifiers = [];
    if (this.state.isFullscreen) {
      formViewModifiers.push('fullscreen');
    }

    const hasAnyProvidedData = this.hasAnyProvidedData(reportData);
    const hasGroupBy = this.state.groupBy.length !== 0;

    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <bem.FormView m={formViewModifiers}>
          <bem.ReportView>
            {this.renderReportButtons()}

            {!hasAnyProvidedData &&
              <bem.ReportView__wrap>
                <bem.Loading>
                  <bem.Loading__inner>
                    {t('This report has no data.')}

                    {hasGroupBy && ' ' + t('Try changing Report Style to "No grouping".')}
                  </bem.Loading__inner>
                </bem.Loading>
              </bem.ReportView__wrap>
            }

            {hasAnyProvidedData &&
              <bem.ReportView__wrap>
                <bem.PrintOnly>
                  <h3>{asset.name}</h3>
                </bem.PrintOnly>
                {!this.state.currentCustomReport && this.state.reportLimit && reportData.length && this.state.reportData.length > this.state.reportLimit &&
                  <bem.FormView__cell m={['centered', 'reportLimit']}>
                    <div>
                      {t('For performance reasons, this report only includes the first ## questions.').replace('##', this.state.reportLimit)}
                    </div>
                    <bem.Button m='colored' onClick={this.resetReportLimit}>
                      {t('Show all (##)').replace('##', this.state.reportData.length)}
                    </bem.Button>
                  </bem.FormView__cell>
                }

                <bem.FormView__cell m='warning'>
                  <i className='k-icon-alert' />
                  <p>{t('This is an automated report based on raw data submitted to this project. Please conduct proper data cleaning prior to using the graphs and figures used on this page. ')}</p>
                </bem.FormView__cell>

                <ReportContents parentState={this.state} reportData={reportData} triggerQuestionSettings={this.triggerQuestionSettings} />
              </bem.ReportView__wrap>
            }

            {this.state.showReportGraphSettings &&
              <ui.Modal open onClose={this.toggleReportGraphSettings} title={t('Edit Report Style')}>
                <ReportStyleSettings parentState={this.state} />
              </ui.Modal>
            }

            {this.state.showCustomReportModal &&
              <ui.Modal open onClose={this.toggleCustomReportModal} title={t('Custom Report')}>
                {this.renderCustomReportModal()}
              </ui.Modal>
            }

            {this.state.currentQuestionGraph &&
              <ui.Modal open onClose={this.closeQuestionSettings} title={t('Question Style')}>
                <QuestionGraphSettings question={this.state.currentQuestionGraph} parentState={this.state} />
              </ui.Modal>
            }
          </bem.ReportView>
        </bem.FormView>
      </DocumentTitle>
      );
  }

}

reactMixin(Reports.prototype, mixins.permissions);
reactMixin(Reports.prototype, Reflux.ListenerMixin);

export default Reports;
