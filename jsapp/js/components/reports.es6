import React from 'react/addons';
import Reflux from 'reflux';
import _ from 'underscore';
import {dataInterface} from '../dataInterface';
import {
  Navigation,
} from 'react-router';
import actions from '../actions';
import bem from '../bem';
import stores from '../stores';
import Select from 'react-select';
import ReportViewItem from './reportViewItem';

import {
  assign,
  t,
  log,
} from '../utils';

var ReportWrap = bem.create('report-wrap'),
    ReportDiv = bem.create('report-div');

function labelVal(label, value) {
  // returns {label: "Some Value", value: "some_value"} for react-select
  return {label: t(label), value: (value || label.toLowerCase().replace(/\W+/g, '_'))};
}
let reportStyles = [
  labelVal('Horizontal'),
  labelVal('Vertical'),
  labelVal('Line'),
  labelVal('Area'),
  labelVal('Pie'),
  labelVal('Donut'),
];


var DefaultReportStylePicker = React.createClass({
  defaultReportStyleChange (value) {
    this.props.onChange({
      default: true,
    }, {
      report_type: value || false
    });
  },
  render () {
    return (
        <div style={{margin:'20px'}}>
          <Select
            name='default_report_type'
            value={this.props.defaultStyle.report_type}
            clearable={false}
            searchable={false}
            options={reportStyles}
            onChange={this.defaultReportStyleChange}
          />
        </div>
      );
  },
});

var IndividualReportStylePicker = React.createClass({
  specificReportStyleChange (value) {
    this.props.onChange({
      kuid: this.props.row.$kuid,
    }, {
      report_type: value || false,
    });
  },
  render () {
    let kuid = this.props.row.$kuid;
    return (
        <div>
          <Select
            name={`report_type__${kuid}`}
            value={this.props.style.report_type}
            clearable={true}
            clearValueText={t('none')}
            placeholder={t('report type')}
            options={reportStyles}
            onChange={this.specificReportStyleChange}
          />
        </div>
      );
  },
});

var Reports = React.createClass({
  mixins: [
    Navigation,
    Reflux.ListenerMixin,
  ],
  componentDidMount () {
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
      let kuids = [];
      let reportStyles = asset.report_styles;
      let defaultReportStyle = reportStyles.default;
      let specifiedReportStyles = reportStyles.specified;

      asset.content.survey.forEach(function(r){
        let $kuid = r.$kuid,
          style = specifiedReportStyles[$kuid];
        r._reportStyle = style;
        rowsByKuid[r.$kuid] = r;
      });

      dataInterface.getReportData({uid: uid, kuids: kuids}).done((data)=>{
        this.setState({
          asset: asset,
          rowsByKuid: rowsByKuid,
          reportStyles: asset.report_styles,
          reportData: data.list,
        });
      });
    });
  },
  getInitialState () {
    return {
      translationIndex: 0,
    };
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
  translationIndexChange (val) {
    this.setState({translationIndex: val});
  },
  render () {
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

    // console.log(defaultStyle);
    // console.log(explicitStyles);
    for (var i = reportData.length - 1; i >= 0; i--) {;
      reportData[i].style = defaultStyle;
    }
    return (
        <bem.ReportView>
          {this.state.asset ?
            <div>
              {
                translations ?
                  <Select
                      name={`translation-switcher`}
                      value={this.state.translationIndex}
                      clearable={false}
                      default={0}
                      placeholder={t('Translation')}
                      options={translations}
                      onChange={this.translationIndexChange}
                    />
                : null
              }
              <DefaultReportStylePicker
                  defaultStyle={defaultStyle}
                  onChange={this.reportStyleChange}
                  translationIndex={this.state.translationIndex}
                />
              <bem.ReportView__wrap>
                <bem.ReportView__warning>
                  <h4>{t('Warning')}</h4>
                  <p>{t('This is an automated report based on raw data submitted to this project. Please conduct proper data cleaning prior to using the graphs and figures used on this page. ')}</p>
                </bem.ReportView__warning>
                {
                  reportData.length === 0 ?
                    <p>No report data</p>
                  :
                  reportData.map((rowContent)=>{
                    let kuid = rowContent.$kuid;
                    return (
                        <bem.ReportView__item title={rowContent.$kuid}>
                          {/* style picker:
                          <IndividualReportStylePicker key={kuid}
                              row={row}
                              onChange={this.reportStyleChange}
                              translationIndex={this.state.translationIndex}
                              asset={asset}
                              style={row.chartStyle}
                            />
                          */}
                          <ReportViewItem {...rowContent} />
                        </bem.ReportView__item>
                      );
                  })
                }
              </bem.ReportView__wrap>
            </div>
          :
            <bem.Loading>
              <bem.Loading__inner>
                <i />
                {t('loading...')}
              </bem.Loading__inner>
            </bem.Loading>
          }
        </bem.ReportView>
      );
  }
})

export default Reports;
