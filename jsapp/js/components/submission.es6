import React from 'react';
import ReactDOM from 'react-dom';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import {dataInterface} from '../dataInterface';
import actions from '../actions';
import reactMixin from 'react-mixin';
import mixins from '../mixins';
import bem from '../bem';
import {t, notify, isAValidUrl} from '../utils';
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
      sid: props.sid
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
      this.setState({
        submission: data,
        loading: false
      });
      dataInterface.getEnketoEditLink(assetUid, sid).done((data) => {
        if (data.url)
          this.setState({enketoEditLink: data.url});
      });

      if (this.props.ids && sid) {
        const c = this.props.ids.findIndex(k => k==sid);

        if (c > 0)
          this.setState({previous: this.props.ids[c - 1]});
        else
          this.setState({previous: -1});

        if (c < this.props.ids.length)
          this.setState({next: this.props.ids[c + 1]});
        else
          this.setState({next: -1});
      }

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
      sid: nextProps.sid
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
    const s = this.state.submission;
    var download_url = null;

    s._attachments.forEach(function(a) {
      if (a.download_url.includes(encodeURI(filename))) {
        download_url = a.download_url;
      }
    });

    var kc_server = document.createElement('a');
    kc_server.href = this.props.asset.deployment__identifier;
    var kobocollect_url = kc_server.origin;
    if (type === 'image') {
      if (download_url && isAValidUrl(download_url))
        return <img src={download_url} />
      else if (download_url)
        return <img src={`${kobocollect_url}/${download_url}`} />
      else
        return filename;
    } else {
      if (download_url && isAValidUrl(download_url))
        return <a href={download_url}>{filename}</a>
      else if (download_url)
        return <a href={download_url}>{filename}</a>
      else
        return filename;

    }
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
    const survey = this.props.asset.content.survey;
    const choices = this.props.asset.content.choices;

    return (
      <bem.FormModal>
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
            {survey.map((q)=> {
              const name = q.name || q.$autoname;
              if (q.label == undefined) { return false;}
              var response = s[name];

              if (q.type=="select_one" && s[name]) {
                const choice = choices.find(x => x.list_name == q.select_from_list_name && x.name === s[name]);
                if (choice && choice.label)
                  response = choice.label[0];
              }

              if (q.type === 'select_multiple' && s[name]) {
                var responses = s[name].split(' ');
                var list = responses.map((r)=> {
                  const choice = choices.find(x => x.list_name == q.select_from_list_name && x.name === r);
                  if (choice && choice.label)
                    return <li key={r}>{choice.label[0]}</li>;
                })
                response = <ul>{list}</ul>;
              }

              if (s[name] && (q.type === 'image' || q.type === 'audio' || q.type === 'video')) {
                response = this.renderAttachment(s[name], q.type);
              }

              var icon = icons._byId[q.type];
              var type = q.type;
              if (icon) {
                type = <i className={`fa fa-${icon.attributes.faClass}`}
                          title={q.type}/>
              }

              return (
                <tr key={`row-${name}`}>
                  <td className="submission--question-type">{type}</td>
                  <td className="submission--question">{q.label[0]}</td>
                  <td className="submission--response">{response}</td>
                </tr>      
              );
            })}
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
