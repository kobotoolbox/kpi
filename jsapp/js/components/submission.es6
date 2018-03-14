import React from 'react';
import ReactDOM from 'react-dom';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import {dataInterface} from '../dataInterface';
import actions from '../actions';
import reactMixin from 'react-mixin';
import mixins from '../mixins';
import bem from '../bem';
import {t, notify} from '../utils';
import stores from '../stores';
import ui from '../ui';
import alertify from 'alertifyjs';
import icons from '../../xlform/src/view.icons';
import Select from 'react-select';
import {
  VALIDATION_STATUSES
} from '../constants';


class Submission extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      submission: {},
      loading: true,
      error: false,
      enketoEditLink: false,
      previous: -1, 
      next: -1,
      sid: props.sid,
      showBetaFieldsWarning: false,
      promptRefresh: false
    };
    autoBind(this);
  }
  componentDidMount() {
    this.getSubmission(this.props.asset.uid, this.state.sid);
    this.listenTo(actions.resources.updateSubmissionValidationStatus.completed, this.refreshSubmission);
  }

  refreshSubmission(result, sid) {
    if (result.uid) {
      this.state.submission._validation_status = result;
      this.setState({submission: this.state.submission});
    }
  }

  getSubmission(assetUid, sid) {
    dataInterface.getSubmission(assetUid, sid).done((data) => {
      var prev = -1, next = -1;

      if (this.props.asset.deployment__active) {
        dataInterface.getEnketoEditLink(assetUid, sid).done((editData) => {
          if (editData.url)
            this.setState({enketoEditLink: editData.url});
        });
      }

      if (this.props.ids && sid) {
        const c = this.props.ids.findIndex(k => k==sid);
        if (c > 0)
          prev = this.props.ids[c - 1];
        if (c < this.props.ids.length)
          next = this.props.ids[c + 1];
      }

      const survey = this.props.asset.content.survey;
      const betaQuestions = ['begin_kobomatrix'];
      const hasBetaQuestion = survey.find(q => betaQuestions.includes(q.type)) || false;

      this.setState({
        submission: data,
        loading: false,
        next: next,
        previous: prev,
        hasBetaQuestion: hasBetaQuestion
      });
    }).fail((error)=>{
      if (error.responseText)
        this.setState({error: error.responseText, loading: false});
      else if (error.statusText)
        this.setState({error: error.statusText, loading: false});
      else
        this.setState({error: t('Error: could not load data.'), loading: false});
    });    
  }

  componentWillReceiveProps(nextProps) {
    this.setState({
      sid: nextProps.sid,
      promptRefresh: false
    });

    this.getSubmission(nextProps.asset.uid, nextProps.sid);
  }

  deleteSubmission() {
    let dialog = alertify.dialog('confirm');
    let opts = {
      title: t('Delete submission?'),
      message: `${t('Are you sure you want to delete this submission?')} ${t('This action cannot be undone')}.`,
      labels: {ok: t('Delete'), cancel: t('Cancel')},
      onok: (evt, val) => {
        dataInterface.deleteSubmission(this.props.asset.uid, this.props.sid).done((data) => {
          stores.pageState.hideModal();
          notify(t('submission deleted'));
        });
      },
      oncancel: () => {
        dialog.destroy();
      }
    };
    dialog.set(opts).show();
  }

  renderAttachment(filename, type) {
    const s = this.state.submission, originalFilename = filename;
    var attachmentUrl = null;

    // Match filename with full filename in attachment list
    // TODO: find a better way to do this, this works but seems inefficient
    s._attachments.some(function(a) {
      if (a.filename.includes(filename)) {
        filename = a.filename;
      }
    });

    var kc_server = document.createElement('a');
    kc_server.href = this.props.asset.deployment__identifier;
    var kc_base = kc_server.origin;

    // build media attachment URL using the KC endpoint
    attachmentUrl = `${kc_base}/attachment/original?media_file=${encodeURI(filename)}`;

    if (type === 'image') {
      return <img src={attachmentUrl} />
    } else {
      return <a href={attachmentUrl} target="_blank">{originalFilename}</a>
    }
  }

  promptRefresh() {
    this.setState({
      promptRefresh: true
    });
  }

  triggerRefresh() {
    this.getSubmission(this.props.asset.uid, this.props.sid);
    this.setState({
      promptRefresh: false
    });    
  }

  switchSubmission(evt) {
    const sid = evt.target.getAttribute('data-sid');
    stores.pageState.showModal({
      type: 'submission',
      sid: sid,
      asset: this.props.asset,
      ids: this.props.ids
    });
  }

  validationStatusChange(e) {
    const data = {"validation_status.uid": e.value};
    actions.resources.updateSubmissionValidationStatus(this.props.asset.uid, this.state.sid, data);
  }

  responseDisplayHelper(q, s, overrideValue = false, name) {
    if (!q) return false;
    const choices = this.props.asset.content.choices;

    var submissionValue = s[name];

    if (overrideValue)
      submissionValue = overrideValue;

    switch(q.type) {
      case 'select_one':
        const choice = choices.find(x => x.list_name == q.select_from_list_name && x.name === submissionValue);
        if (choice && choice.label && choice.label[0])
          return choice.label[0];
        break;
      case 'select_multiple':
        var responses = submissionValue.split(' ');
        var list = responses.map((r)=> {
          const choice = choices.find(x => x.list_name == q.select_from_list_name && x.name === r);
          if (choice && choice.label && choice.label[0])
            return <li key={r}>{choice.label[0]}</li>;
        })
        return <ul>{list}</ul>;
        break;
      case 'image':
      case 'audio':
      case 'video':
        return this.renderAttachment(submissionValue, q.type);
        break;
      default:
        return submissionValue;
        break;
    }
  }
  renderRows() {
    const s = this.state.submission,
          survey = this.props.asset.content.survey,
          _this = this;
    var parentGroup = false;
    const groupTypes = ['begin_score', 'begin_rank', 'begin_group'];
    const groupTypesEnd = ['end_score', 'end_rank', 'end_group'];

    return survey.map((q)=> {
      var name = q.name || q.$autoname || q.$kuid;
      if (q.type === 'begin_repeat') { 
        return (
          <tr key={`row-${name}`}>
            <td colSpan="3" className="submission--repeat-group">
              <h4>
                {t('Repeat group: ')}
                {q.label && q.label[0] ? q.label[0] : t('Unlabelled')}
              </h4>
              {s[name] && s[name].map((repQ, i)=> {
                var response = [];
                for (var pN in repQ) {
                  var qName = pN.split('/').pop(-1);
                  const subQ = survey.find(x => x.name == qName || x.$autoname == qName);

                  const icon = icons._byId[subQ.type];
                  var type = q.type;
                  if (icon)
                    type = <i className={`fa fa-${icon.attributes.faClass}`} title={q.type}/>

                  response.push(
                    <tr key={`row-${pN}`}>
                      <td className="submission--question-type">{type}</td>
                      <td className="submission--question">
                        {subQ.label && subQ.label[0]}
                      </td>
                      <td className="submission--response">
                        {_this.responseDisplayHelper(subQ, s, repQ[pN], pN)}
                      </td>
                    </tr>      
                  );
                }
                return (
                  <table key={`repeat-${i}`}>
                    <tbody>
                      {response}
                    </tbody>
                  </table>
                );
              })}
            </td>
          </tr>
        );
      }

      if (q.type === 'end_repeat')
        return false;

      if (groupTypes.includes(q.type)) {
        parentGroup = name;
        return (
          <tr key={`row-${name}`}>
            <td colSpan="3" className="submission--group">
              <h4>
                {q.label && q.label[0] ? q.label[0] : t('Unlabelled')}
              </h4>
            </td>
          </tr>
        );
      }

      if (groupTypesEnd.includes(q.type)) {
        parentGroup = false;
        return (
          <tr key={`row-${name}-end`}>
            <td colSpan="3" className="submission--end-group"></td>
          </tr>
        );
      }

      if (parentGroup)
        name = `${parentGroup}/${name}`;

      if (q.label == undefined || s[name] == undefined) { return false;}

      const response = this.responseDisplayHelper(q, s, false, name);
      const icon = icons._byId[q.type];
      var type = q.type;
      if (icon)
        type = <i className={`fa fa-${icon.attributes.faClass}`} title={q.type}/>

      return (
        <tr key={`row-${name}`}>
          <td className="submission--question-type">{type}</td>
          <td className="submission--question">{q.label[0] || t('Unlabelled')}</td>
          <td className="submission--response">{response}</td>
        </tr>      
      );
    });
  }
  render () {
    if (this.state.loading) {
      return (
        <bem.Loading>
          <bem.Loading__inner>
            <i />
            {t('loading...')}
          </bem.Loading__inner>
        </bem.Loading>
      );
    }

    if (this.state.error) {
      return (
        <ui.Panel>
          <bem.Loading>
            <bem.Loading__inner>
              {this.state.error}
            </bem.Loading__inner>
          </bem.Loading>
        </ui.Panel>
        )
    }

    const s = this.state.submission;
    return (
      <bem.FormModal>
        {this.state.hasBetaQuestion &&
          <div className='submission--warning'>
            <i className="k-icon-alert" />
            <span>{t('Responses from a Question Matrix are not displayed in this screen.')}</span>
          </div>
        }

        {this.state.promptRefresh &&
          <div className='submission--warning'>
            <p>{t('Click on the button below to load the most recent data for this submission. ')}</p>
            <a onClick={this.triggerRefresh} className="mdl-button mdl-button--raised mdl-button--colored">
              {t('Refresh submission')}
            </a>
          </div>
        }

        {this.props.asset.deployment__active &&
          <bem.FormModal__group m='validation-status'>
            <label>{t('Validation status')}</label>
            <Select 
              disabled={!this.userCan('validate_submissions', this.props.asset)}
              clearable={false}
              value={s._validation_status ? s._validation_status.uid : ''}
              options={VALIDATION_STATUSES}
              onChange={this.validationStatusChange}>
            </Select>
          </bem.FormModal__group>
        }
        <bem.FormModal__group>
          <div className="submission-pager">
            {this.state.previous > -1 &&
              <a onClick={this.switchSubmission}
                    className="mdl-button mdl-button--colored"
                    data-sid={this.state.previous}>
                <i className="k-icon-prev" />
                {t('Previous')}
              </a>
            }

            {this.state.next > -1 &&
              <a onClick={this.switchSubmission}
                    className="mdl-button mdl-button--colored"
                    data-sid={this.state.next}>
                {t('Next')}
                <i className="k-icon-next" />
              </a>
            }
          </div>

          <div className="submission-actions">
            {this.userCan('change_submissions', this.props.asset) && this.state.enketoEditLink &&
              <a href={this.state.enketoEditLink}
                   onClick={this.promptRefresh}
                 target="_blank"
                 className="mdl-button mdl-button--raised mdl-button--colored">
                {t('Edit')}
              </a>
            }
            {this.userCan('change_submissions', this.props.asset) &&
              <a onClick={this.deleteSubmission}
                    className="mdl-button mdl-button--icon mdl-button--colored mdl-button--danger right-tooltip"
                    data-tip={t('Delete submission')}>
                <i className="k-icon-trash" />
              </a>
            }
          </div>
        </bem.FormModal__group>
        <table>
          <thead>
          <tr>
            <th className="submission--question-type">{t('Type')}</th>
            <th className="submission--question">{t('Question')}</th>
            <th className="submission--response">{t('Response')}</th>
          </tr>
          </thead>
          <tbody>
            {this.renderRows()}
            <tr key={`row-meta`}>
              <td colSpan="3" className="submission--end-group"></td>
            </tr>

            {s.start &&
              <tr>
                <td></td>
                <td>{t('start')}</td>
                <td>{s.start}</td>
              </tr>
            }
            {s.end &&
              <tr>
                <td></td>
                <td>{t('end')}</td>
                <td>{s.end}</td>
              </tr>
            }
            {s.__version__ &&
              <tr>
                <td></td>
                <td>{t('__version__')}</td>
                <td>{s.__version__}</td>
              </tr>
            }
            {s['meta/instanceID'] &&
              <tr>
                <td></td>
                <td>{t('instanceID')}</td>
                <td>{s['meta/instanceID']}</td>
              </tr>
            }

          </tbody>
        </table>
      </bem.FormModal>
    );
  }
};

reactMixin(Submission.prototype, Reflux.ListenerMixin);
reactMixin(Submission.prototype, mixins.permissions);

export default Submission;
