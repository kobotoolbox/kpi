// TODO: this shouldn't be a mixin (wtf)

import React from 'react';
import ReactDOM from 'react-dom';
import bem, {makeBem} from 'js/bem';
import dkobo_xlform from '../../xlform/src/_xlform.init';
import _ from 'underscore';
import envStore from 'js/envStore';

bem.CascadePopup = makeBem(null, 'cascade-popup');
bem.CascadePopup__message = makeBem(bem.CascadePopup, 'message');
bem.CascadePopup__buttonWrapper = makeBem(bem.CascadePopup, 'buttonWrapper');
bem.CascadePopup__button = makeBem(bem.CascadePopup, 'button', 'button');

const CHOICE_LIST_SUPPORT_URL = 'cascading_select.html';

export const cascadeMixin = {
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
      cascadeTextareaValue: ReactDOM.findDOMNode(this.refs.cascade).value,
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
        throw new Error(t('Paste your formatted table from excel in the box below.'));
      }
      tmpSurvey.choices.at(0).create_corresponding_rows();
      /*
      tmpSurvey._addGroup({
        __rows: tmpSurvey.rows.models,
        label: '',
      });
      */
      var rowCount = tmpSurvey.rows.length;
      if (rowCount === 0) {
        throw new Error(t('Paste your formatted table from excel in the box below.'));
      }
      s.cascadeReady = true;
      s.cascadeReadySurvey = tmpSurvey;
      s.cascadeMessage = {
        msgType: 'ready',
        addCascadeMessage: t('add cascade with # questions').replace('#', rowCount),
      };
    } catch (err) {
      s.cascadeReady = false;
      s.cascadeMessage = {
        msgType: 'warning',
        message: err.message,
      }
    }
    this.setState(s);
  },
  renderCascadePopup () {
    return (
          <bem.CascadePopup>
            {this.state.cascadeMessage ?
              <bem.CascadePopup__message m={this.state.cascadeMessage.msgType}>
                {this.state.cascadeMessage.message}
              </bem.CascadePopup__message>
            :
              <bem.CascadePopup__message m='instructions'>
                {t('Paste your formatted table from excel in the box below.')}
              </bem.CascadePopup__message>
            }

            {this.state.cascadeReady ?
              <bem.CascadePopup__message m='ready'>
                {t('OK')}
              </bem.CascadePopup__message>
            : null}

            <textarea ref='cascade' onChange={this.cascadePopopChange}
              value={this.state.cascadeTextareaValue} />

            { envStore.isReady &&
              envStore.data.support_url &&
              <div className='cascade-help right-tooltip'>
                <a href={envStore.data.support_url + CHOICE_LIST_SUPPORT_URL}
                  target='_blank'
                  data-tip={t('Learn more about importing cascading lists from Excel')}>
                    <i className='k-icon k-icon-help' />
                </a>
              </div>
            }

            <bem.CascadePopup__buttonWrapper>
              <bem.CascadePopup__button disabled={!this.state.cascadeReady}
                onClick={()=>{
                  var survey = this.app.survey;
                  survey.insertSurvey(this.state.cascadeReadySurvey,
                    this.state.cascadeLastSelectedRowIndex);
                  this.cancelCascade();
                }}>
                {t('DONE')}
              </bem.CascadePopup__button>
            </bem.CascadePopup__buttonWrapper>
          </bem.CascadePopup>
      );
  }
};
