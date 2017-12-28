import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import _ from 'underscore';
import {dataInterface} from '../dataInterface';

import actions from '../actions';
import bem from '../bem';
import stores from '../stores';
import Select from 'react-select';
import ui from '../ui';
import DocumentTitle from 'react-document-title';
import { txtid } from '../../xlform/src/model.utils';

import ReportViewItem from './reportViewItem';

import {
  assign,
  t,
  log,
} from '../utils';

function labelVal(label, value) {
  return {label: t(label), value: (value || label.toLowerCase().replace(/\W+/g, '_'))};
}
let reportStyles = [
  labelVal('Vertical'),
  labelVal('Donut'),
  labelVal('Area'),
  labelVal('Horizontal'),
  labelVal('Pie'),
  labelVal('Line'),
];

class DefaultChartTypePicker extends React.Component {
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
              <input type="radio" name="chart_type" 
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
};

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

class DefaultChartColorsPicker extends React.Component {
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
  render () {
    var radioButtons = reportColorSets.map(function(set, index){
       return (
          <bem.GraphSettings__radio key={index}>
              <input type="radio" name="chart_colors" 
                value={index} 
                checked={this.props.defaultStyle.report_colors === reportColorSets[index].colors} 
                onChange={this.defaultReportColorsChange} 
                id={'type-' + set.label} />
              <label htmlFor={'type-' + set.label}>
               {
                  reportColorSets[index].colors.map(function(color, i){
                       return (
                          <div style={{backgroundColor: color}} key={i}>
                          </div>
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

class SizeSliderInput extends React.Component {
  constructor(props) {
    super(props);
    this.state = {value: this.props.default};
    autoBind(this);
  }
  handleChange (event) {
    this.props.onChange({
      value: event.target.value,
      id: this.props.name
    });

    this.setState({value: event.target.value});
  }
  render () {
    return (
      <div className="slider-item">
        <label> 
          {this.props.label}&nbsp;{this.state.value}
        </label>
        <input 
          className="mdl-slider"
          id={this.props.name}
          type="range" 
          min={this.props.min} 
          max={this.props.max}
          value={this.state.value} 
          onChange={this.handleChange}
          step="5" />
      </div>
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
  customReportQuestionChange(e) {
    var r = this.state.customReport;
    var name = e.target.getAttribute('data-name');

    if (e.target.checked) {
      r.questions.push(name);
    } else {
      r.questions.splice(r.questions.indexOf(name), 1);
    }
    this.setState({customReport: r});
  }
  saveCustomReport() {
    let assetUid = this.props.assetUid;
    let rStyles = this.props.reportStyles;
    const crid = this.state.customReport.crid;

    if (!rStyles.default.custom) {
      rStyles.default.custom = {};
    }

    rStyles.default.custom[crid] = this.state.customReport;
    actions.reports.setStyle(assetUid, rStyles);
  }

  render () {
    var questionList = this.props.reportData.map(function(q, i){
      return (
        <div className='graph-settings__question' key={i}>
            <input type="checkbox" name="chart_question" 
              checked={this.state.customReport.questions.includes(q.name)}
              onChange={this.customReportQuestionChange} 
              data-name={q.name}
              id={'q-' + q.name} />
            <label htmlFor={'q-' + q.name}>
              {q.row.label[0]}
            </label>
        </div>
      );
    }, this);

    return (
      <div className="custom-report-form">
        <div className="custom-report--title">
          <input type="text" name="title" 
                  value={this.state.customReport.name} 
                  placeholder={t('Untitled Report')} 
                  onChange={this.customReportNameChange} />
        </div>
        <strong>{t('Include the following questions:')}</strong>
        {questionList}
        <div className='custom-report--footer'>
          <button className="mdl-button mdl-button--raised mdl-button--colored"
                  onClick={this.saveCustomReport}>
            {t('Save')}
          </button>
        </div>
      </div>
    );    
  }
};

class ReportContents extends React.Component {
  constructor(props) {
    super(props);
  }
  shouldComponentUpdate(nextProps, nextState) {
    // to improve UI performance, don't refresh report while a modal window is visible
    if (nextProps.parentState.showReportGraphSettings || nextProps.parentState.showCustomReportModal) {
      return false;
    } else {
      return true;
    }
  }
  render () {
    return (
      <div>
        {
          this.props.reportData.map((rowContent, i)=>{
            return (
                <bem.ReportView__item key={i}>
                  <ReportViewItem {...rowContent} translations={this.props.parentState.translations} translationIndex={this.props.parentState.translationIndex} />
                </bem.ReportView__item>
              );
          })
        }
      </div>
    );
  }
};
class Reports extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      graphWidth: "700",
      graphHeight: "250",
      translations: false,
      translationIndex: 0,
      groupBy: [],
      activeModalTab: 0,
      error: false,
      showExpandedReport: false,
      reportLimit: 200,
      customReports: false,
      showReportGraphSettings: false, 
      showCustomReportModal: false,
      currentCustomReport: false
    };
    autoBind(this);
  }
  componentDidMount () {
    this.loadReportData([]);
    this.listenTo(actions.reports.setStyle, this.reportStyleListener);
  }
  componentWillUpdate (nextProps, nextState) {
    if (this.state.groupBy != nextState.groupBy)
      this.loadReportData(nextState.groupBy);
  }
  loadReportData(groupBy) {
    let uid = this.props.params.assetid;
    stores.allAssets.whenLoaded(uid, (asset)=>{
      let rowsByKuid = {};
      let rowsByIdentifier = {};
      let names = [],
          reportStyles = asset.report_styles;
      reportStyles.default.report_type = 'vertical';

      let specifiedReportStyles = reportStyles.specified || {};

      if (asset.content.survey != undefined) {
        asset.content.survey.forEach(function(r){
          if (r.$kuid) {
            rowsByKuid[r.$kuid] = r;
          }

          let $identifier = r.$autoname || r.name;
          rowsByIdentifier[$identifier] = r;
        });

        dataInterface.getReportData({uid: uid, identifiers: names, group_by: groupBy}).done((data)=>{
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
            translations: asset.content.translations.length > 1 ? true : false,
            error: false
          });
        }).fail((err)=> {
          this.setState({
            error: err
          });
        });
      } else {
        // Redundant?
        console.error('Survey not defined.');
      }
    });
  }
  groupDataBy(evt) {
    var gb = evt.target.value ? [evt.target.value] : [];
    this.setState({groupBy: gb});
  }
  reportStyleListener(asssetUid, reportStyles) {
    this.setState({reportStyles: reportStyles, showCustomReportModal: false});
  }
  reportStyleChange (params, value) {
    let assetUid = this.state.asset.uid;
    let sett_ = this.state.reportStyles;
    if (params.default) {
      assign(sett_.default, value);
    }

    actions.reports.setStyle(assetUid, sett_);
    this.setState({
      reportStyles: sett_,
    });
  }
  reportSizeChange (params, value) {
    if (params.id == 'width') {
      this.setState({graphWidth: params.value});
    } else {
      this.setState({graphHeight: params.value});
    }
  }
  translationIndexChange (evt) {
    this.setState({translationIndex: evt.target.value});
  }
  toggleReportGraphSettings () {
    this.setState({
      showReportGraphSettings: !this.state.showReportGraphSettings,
    });
  }
  setCustomReport (e) {
    var crid = e ? e.target.getAttribute('data-crid') : false;

    if(!this.state.showCustomReportModal) {
      if (crid) {
        // existing report
        var currentCustomReport = this.state.reportStyles.default.custom[crid];
      } else {
        // new custom report
        var currentCustomReport = {
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
        if (this.state.reportStyles.default.custom[crid] == undefined) {
          this.triggerDefaultReport();
        }
      }
    }

    this.setState({showCustomReportModal: !this.state.showCustomReportModal});
  }
  triggerDefaultReport() {
    this.setState({currentCustomReport: false});
  }
  toggleExpandedReports () {
    stores.pageState.hideDrawerAndHeader(!this.state.showExpandedReport);
    this.setState({
      showExpandedReport: !this.state.showExpandedReport,
    });
  }
  componentWillUnmount() {
    if (this.state.showExpandedReport)
      stores.pageState.hideDrawerAndHeader(!this.state.showExpandedReport);
  }
  launchPrinting () {
    window.print();
  }
  renderReportButtons () {
    // TODO: custom report should be saved elsewhere, change when backend updates
    var customReports = this.state.reportStyles.default.custom || {};

    var customReportsList = [];
    for (var key in customReports) {
      customReportsList.push(customReports[key]);
    }
    customReportsList.sort((a, b) => a.name.localeCompare(b.name));

    var _this = this;

    return (
      <bem.FormView__reportButtons>
        <ui.PopoverMenu type='custom-reports' 
            triggerLabel={this.state.currentCustomReport ? this.state.currentCustomReport.name : t('Custom Reports')}>
            <bem.PopoverMenu__link 
              key='default' 
              data-name='' 
              onClick={this.triggerDefaultReport}
              className={!this.state.currentCustomReport ? 'active' : ''}>
                {t("Default Report")}
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
            <bem.PopoverMenu__link 
              key='new' 
              onClick={this.toggleCustomReportModal}>
                {t("Create New Report")}
            </bem.PopoverMenu__link>
        </ui.PopoverMenu> 

        {this.state.currentCustomReport && 
          <button className="mdl-button mdl-button--icon report-button__edit"
                onClick={this.editCustomReport} 
                data-tip={t('Edit This Report')}>
            <i className="k-icon-edit" />
          </button>
        }

        <button className="mdl-button mdl-button--icon report-button__expand"
                onClick={this.toggleExpandedReports} 
                data-tip={t('Expand')}>
          <i className="k-icon-expand" />
        </button>
 
        <button className="mdl-button mdl-button--icon report-button__print" 
                onClick={this.launchPrinting} 
                data-tip={t('Print')}>
          <i className="k-icon-print" />
        </button>

        <button className="mdl-button mdl-button--icon report-button__settings" 
                onClick={this.toggleReportGraphSettings} 
                data-tip={t('Report Settings')}>
          <i className="k-icon-settings" />
        </button>
 
      </bem.FormView__reportButtons>
    );
  }
  toggleTab(evt) {
    var i = evt.target.getAttribute('data-index');
    this.setState({
      activeModalTab: parseInt(i),
    });
  }
  renderReportGraphSettings () {
    let asset = this.state.asset,
        rowsByKuid = this.state.rowsByKuid,
        defaultStyle;
    if (asset && asset.content) {
      defaultStyle = this.state.reportStyles.default || {};
    }

    let reportData = this.state.reportData || [];

    for (var i = reportData.length - 1; i >= 0; i--) {;
      reportData[i].style = defaultStyle;
    }

    var rows = this.state.rowsByIdentifier || {};
    var groupByList = [];
    for (var key in rows) {
      if (rows.hasOwnProperty(key) 
          && rows[key].hasOwnProperty('type')
          && rows[key].type == 'select_one') {
        groupByList.push(rows[key]);
      }
    }


    var tabs = [t('Chart Type'), t('Colors / Size')];

    if (groupByList.length > 1) {
      tabs.push(t('Group By'));
    }

    if (this.state.translations) {
      tabs.push(t('Translation'));
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
          <div className="tabs-content">
            {this.state.activeModalTab === 0 &&
              <div id="graph-type">
                <DefaultChartTypePicker
                  defaultStyle={defaultStyle}
                  onChange={this.reportStyleChange}
                />
              </div>
            }
            {this.state.activeModalTab === 1 &&
              <div id="graph-colors">
                <DefaultChartColorsPicker
                  defaultStyle={defaultStyle}
                  onChange={this.reportStyleChange}/>
                <SizeSliderInput 
                      name="width" min="300" max="900" default={this.state.graphWidth} 
                      label={t('Width: ')} 
                      onChange={this.reportSizeChange} />
                <div className="is-edge">
                  <SizeSliderInput 
                      name="height" min="200" max="500" default={this.state.graphHeight}
                      label={t('Height: ')} 
                      onChange={this.reportSizeChange} />
                </div>
              </div>
            }
            {this.state.activeModalTab === 2 && groupByList.length > 1 && 
              <div className="graph-tab__groupby" id="graph-labels">
                <label htmlFor={'groupby-00'} key='00'>
                  <input type="radio" name="group_by" 
                    value={''}
                    onChange={this.groupDataBy} 
                    checked={this.state.groupBy.length === 0 ? true : false}
                    id={'groupby-00'} />
                      {t("No grouping")}
                </label>

                {groupByList.map((row, i)=>{
                    var val = row.name || row.$autoname;
                    return (
                      <label htmlFor={'groupby-' + i} key={i}>
                        <input type="radio" name="group_by" 
                          value={val}
                          onChange={this.groupDataBy} 
                          checked={this.state.groupBy[0] === val ? true : false}
                          id={'groupby-' + i} />
                          {this.state.translations ? row.label[this.state.translationIndex] : row.label}
                      </label>
                    );
                  })
                }
              </div>
            }
            {this.state.activeModalTab === 3 && this.state.translations && 
              <div className="graph-tab__translation" id="graph-labels">
                {this.state.asset.content.translations.map((row, i)=>{
                    return (
                      <label htmlFor={'translation-' + i} key={i}>
                        <input type="radio" name="trnsltn"
                          value={i}
                          onChange={this.translationIndexChange}
                          checked={this.state.asset.content.translations[this.state.translationIndex] === row ? true : false}
                          id={'translation-' + i} />
                        {row}
                      </label>
                    );
                  })
                }
              </div>
            }

          </div>
        </ui.Modal.Body>
 
        <ui.Modal.Footer>
          <button className="mdl-button primary"
                  onClick={this.toggleReportGraphSettings}>
            {t('Done')}
          </button>
        </ui.Modal.Footer>
      </bem.GraphSettings>
    );
  }
  renderCustomReportModal () {
    return (
      <bem.GraphSettings>
        <ui.Modal.Body>
          <CustomReportForm reportData={this.state.reportData} 
                            customReport={this.state.currentCustomReport} 
                            assetUid={this.state.asset.uid}
                            reportStyles={this.state.reportStyles}
                            />
        </ui.Modal.Body>
      </bem.GraphSettings>
    );
  }
  resetReportLimit () {
    this.setState({
      reportLimit: false,
    });
  }
  render () {
    let asset = this.state.asset,
        rowsByKuid = this.state.rowsByKuid,
        defaultStyle, 
        docTitle = t('Report');
    if (asset && asset.content) {
      defaultStyle = this.state.reportStyles.default || {};
      defaultStyle.graphWidth = this.state.graphWidth;
      defaultStyle.graphHeight = this.state.graphHeight;

      docTitle = asset.name || t('Untitled');
    }

    var reportData = this.state.reportData || [];

    if (this.state.reportLimit && reportData.length && reportData.length > this.state.reportLimit) {
      reportData = reportData.slice(0, this.state.reportLimit);
    }

    // for (var i = reportData.length - 1; i >= 0; i--) {;
    //   reportData[i].style = defaultStyle;
    // }

    if (this.state.currentCustomReport && this.state.currentCustomReport.questions.length && reportData.length) {
      const currentQuestions = this.state.currentCustomReport.questions;
      var fullReportData = this.state.reportData;
      reportData = fullReportData.filter(q => currentQuestions.includes(q.name));
    }

    if (this.state.reportData === undefined) {
      return (
        <bem.ReportView>
          <bem.Loading>
            {this.state.error === false ?
              <bem.Loading__inner>
                <i />
                {t('loading...')}
              </bem.Loading__inner>
              : 
              <bem.Loading__inner>
                {t('This report cannot be loaded.')}
                <br/>
                <code>
                  {this.state.error.statusText + ': ' + this.state.error.responseText}
                </code>
              </bem.Loading__inner>
            }
          </bem.Loading>
        </bem.ReportView>
      );
    }

    if (this.state.reportData && reportData.length === 0) {
      return (
        <DocumentTitle title={`${docTitle} | KoboToolbox`}>
          <bem.ReportView>
            <bem.Loading>
              <bem.Loading__inner>
                {t('This report has no data.')}
              </bem.Loading__inner>
            </bem.Loading>
          </bem.ReportView>
        </DocumentTitle>
      );
    }

    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <bem.ReportView>
          {this.renderReportButtons()}
          {this.state.asset ?
            <bem.ReportView__wrap>
              <bem.PrintOnly>
                <h3>{asset.name}</h3>
              </bem.PrintOnly>
              {this.state.reportLimit && reportData.length && this.state.reportData.length > this.state.reportLimit &&
                <bem.FormView__cell m={['centered', 'reportLimit']}>
                  <div>
                    {t('For performance reasons, this report only includes the first ## questions.').replace('##', this.state.reportLimit)}
                  </div>
                  <button className="mdl-button mdl-button--colored" onClick={this.resetReportLimit}>
                    {t('Show all (##)').replace('##', this.state.reportData.length)}
                  </button>
                </bem.FormView__cell>
              }

              <bem.ReportView__warning>
                <h4>{t('Warning')}</h4>
                <p>{t('This is an automated report based on raw data submitted to this project. Please conduct proper data cleaning prior to using the graphs and figures used on this page. ')}</p>
              </bem.ReportView__warning>

              <ReportContents parentState={this.state} reportData={reportData} />

            </bem.ReportView__wrap>
          :
            <bem.Loading>
              <bem.Loading__inner>
                <i />
                {t('loading...')}
              </bem.Loading__inner>
            </bem.Loading>
          }
          {this.state.showReportGraphSettings ?
            <ui.Modal open onClose={this.toggleReportGraphSettings} title={t('Report Settings')}>
              {this.renderReportGraphSettings()}
            </ui.Modal>
 
          : null}
 
          {this.state.showCustomReportModal ?
            <ui.Modal open onClose={this.toggleCustomReportModal} title={t('Custom Report')}>
              {this.renderCustomReportModal()}
            </ui.Modal>
 
          : null}

        </bem.ReportView>
      </DocumentTitle>
      );
  }

}

reactMixin(Reports.prototype, Reflux.ListenerMixin);

export default Reports;
