import React from 'react/addons';
import bem from '../bem';
import dkobo_xlform from '../../xlform/src/_xlform.init';
import _ from 'underscore';

var CascadePopup = bem.create('cascade-popup'),
    CascadePopup__message = bem.create('cascade-popup__message'),
    CascadePopup__button = bem.create('cascade-popup__button', '<button>');

var choiceListHelpUrl = 'http://support.kobotoolbox.org';

import {
  surveyToValidJson,
  notify,
  assign,
  t,
} from '../utils';

export default {
  toggleCascade () {
    var lastSelectedRow = _.last(this.app.selectedRows()),
        lastSelectedRowIndex = lastSelectedRow ? this.app.survey.rows.indexOf(lastSelectedRow) : -1;
    this.setState({
      showCascadePopup: !this.state.showCascadePopup,
      cascadeTextareaValue: '',
      cascadeLastSelectedRowIndex: lastSelectedRowIndex,
    });
  },
  cancelCascade () {
    this.setState({
      cascadeError: false,
      cascadeReady: false,
      cascadeReadySurvey: false,
      addCascadePopup: false,
      cascadeTextareaValue: '',
      cascadeStr: '',
      showCascadePopup: false,
    });
  },
  cascadePopopChange (evt) {
    var s = {
      cascadeTextareaValue: this.refs.cascade.getDOMNode().value,
    }
    // if (s.cascadeTextareaValue.length === 0) {
    //   return this.cancelCascade();
    // }
    try {
      var inp = dkobo_xlform.model.utils.split_paste(s.cascadeTextareaValue);
      var tmpSurvey = new dkobo_xlform.model.Survey({
        survey: [],
        choices: inp
      });
      if (tmpSurvey.choices.length === 0) {
        throw new Error(t('paste a properly formatted cascading select list'));
      }
      tmpSurvey.choices.at(0).create_corresponding_rows();
      tmpSurvey._addGroup({
        __rows: tmpSurvey.rows.models,
        label: '',
      });
      var rowCount = tmpSurvey.rows.length;
      if (rowCount === 0) {
        throw new Error(t('paste a properly formatted cascading select list'));
      }
      s.cascadeReady = true;
      s.cascadeReadySurvey = tmpSurvey;
      s.cascadeMessage = {
        msgType: 'ready',
        addCascadeMessage: t('add cascade with # questions').replace('#', rowCount),
      };
    } catch (err) {
      s.cascadeMessage = {
        msgType: 'warning',
        message: err.message,
      }
    }
    this.setState(s);
  },
  renderCascadePopup () {
    return (
          <CascadePopup>
            <CascadePopup__button m="close" onClick={this.cancelCascade}>
              {t('x')}
            </CascadePopup__button>

            {this.state.cascadeMessage ?
              <CascadePopup__message m={this.state.cascadeMessage.msgType}>
                {this.state.cascadeMessage.message}
              </CascadePopup__message>
            :
              <CascadePopup__message m="instructions">
                {t('Paste choice list')}
              </CascadePopup__message>
            }
            {choiceListHelpUrl ?
                <a href={choiceListHelpUrl} target="_blank">
                  {t('(help creating a choice list)')}
                </a>
            : null}
            {this.state.cascadeReady ? 
              <CascadePopup__message>
                {t('OK')}
              </CascadePopup__message>
            :null}
            <textarea ref="cascade" onChange={this.cascadePopopChange}
              value={this.state.cascadeTextareaValue} />
            <CascadePopup__button disabled={!this.state.cascadeReady}
              onClick={()=>{
                var survey = this.app.survey;
                survey.insertSurvey(this.state.cascadeReadySurvey,
                  this.state.cascadeLastSelectedRowIndex);
                this.cancelCascade();
              }}>
              {t('add')}
            </CascadePopup__button>
          </CascadePopup>
      );
  }
};