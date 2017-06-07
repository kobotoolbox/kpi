import React from 'react';
import Reflux from 'reflux';
import _ from 'underscore';
import {dataInterface} from '../dataInterface';

import actions from '../actions';
import bem from '../bem';
import stores from '../stores';
import Select from 'react-select';
import ui from '../ui';
import DocumentTitle from 'react-document-title';

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

var DefaultChartTypePicker = React.createClass({
  defaultReportStyleChange (e) {
    this.props.onChange({
      default: true,
    }, {
      report_type: e.currentTarget.value || 'bar'
    });
  },
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
  },
});

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

var DefaultChartColorsPicker = React.createClass({
  defaultReportColorsChange (e) {
    this.props.onChange({
      default: true,
    }, {
      report_colors: reportColorSets[e.currentTarget.value].colors || reportColorSets[0].colors
    });
  },
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
  },
});


var SizeSliderInput = React.createClass({
  getInitialState: function() {
    return {value: this.props.default};
  },
  handleChange: function(event) {
    this.props.onChange({
      value: event.target.value,
      id: this.props.name
    });

    this.setState({value: event.target.value});
  },
  render: function() {
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
  },
});

var Reports = React.createClass({
  mixins: [
    Reflux.ListenerMixin,
  ],
  componentDidMount () {
    this.loadReportData([]);
  },
  componentWillUpdate (nextProps, nextState) {
    if (this.state.groupBy != nextState.groupBy)
      this.loadReportData(nextState.groupBy);
  },
  loadReportData(groupBy) {
    let uid = this.props.params.assetid;
    // PM note: this below seems to cause child reportViewItem's componentWillUpdate to run twice, causing odd animation issues
    // this.listenTo(actions.reports.setStyle.completed, (asset)=>{
    //   if (asset.uid === uid) {
    //     this.setState({
    //       reportStyles: asset.report_styles,
    //     });
    //   }
    // });
    stores.allAssets.whenLoaded(uid, (asset)=>{
      let rowsByKuid = {};
      let rowsByIdentifier = {};
      let names = [];
      let reportStyles = asset.report_styles;
      let defaultReportStyle = reportStyles.default || {};
      let specifiedReportStyles = reportStyles.specified || {};

      if (asset.content.survey != undefined) {
        asset.content.survey.forEach(function(r){
          let $identifier = r.$autoname || r.name,
            style = specifiedReportStyles[$identifier] || {};
          r._reportStyle = style;
          if (r.$kuid) {
            rowsByKuid[r.$kuid] = r;
          }
          rowsByIdentifier[$identifier] = r;
        });

        dataInterface.getReportData({uid: uid, identifiers: names, group_by: groupBy}).done((data)=>{
          var dataWithResponses = [];

          data.list.forEach(function(row){
            if (row.data.responses !== undefined) {
              if (rowsByIdentifier[row.name] !== undefined) {
                row.row.label = rowsByIdentifier[row.name].label;
              } else {
                row.row.label = t('untitled');
              }
              dataWithResponses.push(row);
            }

            if (row.data.values !== undefined) {
              if (rowsByIdentifier[row.name] !== undefined) {
                row.row.label = rowsByIdentifier[row.name].label;
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
            reportStyles: asset.report_styles,
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
  },
  getInitialState () {
    return {
      graphWidth: "700",
      graphHeight: "250",
      translations: false,
      translationIndex: 0,
      groupBy: [],
      activeModalTab: 0,
      error: false
    };
  },
  groupDataBy(evt) {
    var gb = evt.target.getAttribute('data-name') ? [evt.target.getAttribute('data-name')] : [];
    this.setState({
      groupBy: gb,
    });
  },
  reportStyleChange (params, value) {
    let assetUid = this.state.asset.uid;
    let sett_ = this.state.reportStyles;
    if (params.default) {
      assign(sett_.default, value);
    } else if (params.kuid) {
      let kuid = params.kuid;
      if (!sett_.specified[kuid]) {
        sett_.specified[kuid] = {};
      }
      assign(sett_.specified[kuid], value);
    }
    actions.reports.setStyle(assetUid, sett_);
    this.setState({
      reportStyles: sett_,
    });
  },
  reportSizeChange (params, value) {
    if (params.id == 'width') {
      this.setState({graphWidth: params.value});
    } else {
      this.setState({graphHeight: params.value});
    }
  },
  translationIndexChange (evt) {
    var TI = evt.target.getAttribute('data-index') ? evt.target.getAttribute('data-index') : 0;
    this.setState({translationIndex: TI});
  },
  toggleReportGraphSettings () {
    this.setState({
      showReportGraphSettings: !this.state.showReportGraphSettings,
    });
  },
  toggleExpandedReports () {
    stores.pageState.hideDrawerAndHeader(!this.state.showExpandedReport);
    this.setState({
      showExpandedReport: !this.state.showExpandedReport,
    });
  },
  componentWillUnmount() {
    if (this.state.showExpandedReport)
      stores.pageState.hideDrawerAndHeader(!this.state.showExpandedReport);
  },
  launchPrinting () {
    window.print();
  },
  renderReportButtons () {
    var rows = this.state.rowsByIdentifier || {};
    var groupByList = [];
    for (var key in rows) {
      if (rows.hasOwnProperty(key) 
          && rows[key].hasOwnProperty('type')
          && rows[key].type == 'select_one') {
        groupByList.push(rows[key]);
      }
    }

    return (
      <bem.FormView__reportButtons>
        <button className="mdl-button" onClick={this.toggleReportGraphSettings}>
          {t('Graph Settings')}
        </button>

        {groupByList.length > 1 && 
          <ui.PopoverMenu type='groupby-menu' 
              triggerLabel={t('Group By')}>
              <bem.PopoverMenu__link key='default' data-name='' onClick={this.groupDataBy}>
                  {t("No grouping")}
              </bem.PopoverMenu__link>

              {groupByList.map((row, i)=>{
                  return (
                    <bem.PopoverMenu__link key={i}
                        data-name={row.name || row.$autoname}
                        onClick={this.groupDataBy}>
                         {this.state.translations ? row.label[this.state.translationIndex] : row.label}
                    </bem.PopoverMenu__link>
                  );
                })
              }
          </ui.PopoverMenu> 
        }

        {this.state.translations && 
          <ui.PopoverMenu type='question-language' 
              triggerLabel={t('Translation')}>
              {this.state.asset.content.translations.map((row, i)=>{
                  return (
                    <bem.PopoverMenu__link key={i}
                        data-index={i}
                        onClick={this.translationIndexChange}>
                         {row}
                    </bem.PopoverMenu__link>
                  );
                })
              }
          </ui.PopoverMenu> 
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
 
      </bem.FormView__reportButtons>
    );
  },
  toggleTab(evt) {
    var i = evt.target.getAttribute('data-index');
    this.setState({
      activeModalTab: parseInt(i),
    });
  },
  renderReportGraphSettings () {
    let asset = this.state.asset,
        rowsByKuid = this.state.rowsByKuid,
        explicitStyles,
        explicitStylesList = [],
        defaultStyle;
    if (asset && asset.content) {
      explicitStyles = this.state.reportStyles.specified || {};
      defaultStyle = this.state.reportStyles.default || {};
    }

    let translations = false;
    let reportData = this.state.reportData || [];

    for (var i = reportData.length - 1; i >= 0; i--) {;
      reportData[i].style = defaultStyle;
    }

    var tabs = [t('Chart Type'), t('Colors'), t('Size')];

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
                  onChange={this.reportStyleChange}
                />
              </div>
            }
            {this.state.activeModalTab === 2 &&
              <div className="graph-tab__size" id="graph-labels">
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
  },
  render () {
    let asset = this.state.asset,
        rowsByKuid = this.state.rowsByKuid,
        explicitStyles,
        explicitStylesList = [],
        defaultStyle, 
        docTitle = t('Report');
    if (asset && asset.content) {
      explicitStyles = this.state.reportStyles.specified || {};
      defaultStyle = this.state.reportStyles.default || {};

      defaultStyle.graphWidth = this.state.graphWidth;
      defaultStyle.graphHeight = this.state.graphHeight;

      docTitle = asset.name || t('Untitled');

    }

    let reportData = this.state.reportData || [];

    for (var i = reportData.length - 1; i >= 0; i--) {;
      reportData[i].style = defaultStyle;
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
              <bem.ReportView__warning>
                <h4>{t('Warning')}</h4>
                <p>{t('This is an automated report based on raw data submitted to this project. Please conduct proper data cleaning prior to using the graphs and figures used on this page. ')}</p>
              </bem.ReportView__warning>
              {
                reportData.map((rowContent, i)=>{
                  return (
                      <bem.ReportView__item key={i}>
                        {/* style picker:
                        <IndividualReportStylePicker key={kuid}
                            row={row}
                            onChange={this.reportStyleChange}
                            asset={asset}
                            style={row.chartStyle}
                          />
                        */}
                        <ReportViewItem {...rowContent} translations={this.state.translations} translationIndex={this.state.translationIndex} />
                      </bem.ReportView__item>
                    );
                })
              }
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
            <ui.Modal open onClose={this.toggleReportGraphSettings} title={t('Global Graph Settings')}>
              {this.renderReportGraphSettings()}
            </ui.Modal>
 
          : null}
        </bem.ReportView>
      </DocumentTitle>
      );
  }

})

export default Reports;
