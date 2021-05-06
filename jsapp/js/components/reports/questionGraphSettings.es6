import React from 'react';
import autoBind from 'react-autobind';
import {actions} from 'js/actions';
import {bem} from 'js/bem';
import ui from 'js/ui';
import ChartTypePicker from './chartTypePicker';
import ChartColorsPicker from './chartColorsPicker';

export default class QuestionGraphSettings extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);

    this.state = {
      activeModalTab: 0,
      rStyle: {
        report_type: false,
        report_colors: false,
        width: false,
      },
    };
  }

  toggleTab(evt) {
    var i = evt.target.getAttribute('data-index');
    this.setState({activeModalTab: parseInt(i)});
  }

  componentDidMount() {
    let _qn = this.props.question;
    let specificSettings = null;

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
      if (report_custom[customReport.crid].specified === undefined) {
        report_custom[customReport.crid].specified = {};
      }

      report_custom[customReport.crid].specified[_qn] = reset ? {} : this.state.rStyle;
      actions.reports.setCustom(assetUid, report_custom);
    }
  }

  questionStyleChange(params, value) {
    var styles = this.state.rStyle;

    if (value && value.report_type) {
      styles.report_type = value.report_type;
    }
    if (value && value.report_colors) {
      styles.report_colors = value.report_colors;
    }
    if (params && params.id === 'width') {
      styles.width = params.value;
    }

    this.setState({rStyle: styles});
  }

  render() {
    let reportStyle = this.state.rStyle;

    var tabs = [t('Chart Type'), t('Colors')];
    var modalTabs = tabs.map(function(tab, i) {
      return (
        <button
          className={`mdl-button mdl-button--tab ${this.state.activeModalTab === i ? 'active' : ''}`}
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
}
