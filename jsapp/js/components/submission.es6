import React from 'react';
import ReactDOM from 'react-dom';
import autoBind from 'react-autobind';
import {dataInterface} from '../dataInterface';
import bem from '../bem';
import {t, notify} from '../utils';
import stores from '../stores';
import ui from '../ui';
import alertify from 'alertifyjs';
import icons from '../../xlform/src/view.icons';

class Submission extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      submission: {},
      loading: true,
      error: false,
      enketoEditLink: false
    };
    autoBind(this);
  }
  componentDidMount() {
    dataInterface.getSubmission(this.props.asset.uid, this.props.sid).done((data) => {
      this.setState({
        submission: data,
        loading: false
      });
      dataInterface.getEnketoEditLink(this.props.asset.uid, this.props.sid).done((data) => {
        if (data.url)
          this.setState({enketoEditLink: data.url});
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

  renderAttachment(filename) {
    const s = this.state.submission;
    var download_url = null;
    var fullImage = s._attachments.forEach(function(a) {
      if (a.download_url.includes(filename)) {
        download_url = a.download_url;
      }
    });

    var kc_server = document.createElement('a');
    kc_server.href = this.props.asset.deployment__identifier;
    var kobocollect_url = kc_server.origin;

    if (download_url)
      return <img src={`${kobocollect_url}/${download_url}`} />
    else
      return filename;
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
        {this.state.enketoEditLink &&
          <a href={this.state.enketoEditLink}
             target="_blank"
             className="mdl-button mdl-button--raised mdl-button--colored">
            {t('Edit')}
          </a>
        }
        <table>
          <thead>
          <tr>
            <th className="submission--question-type">{t('Type')}</th>
            <th className="submission--question">{t('Question')}</th>
            <th className="submission--response">{t('Response')}</th>
          </tr>
          </thead>
          <tbody>
            {survey.map((q)=> {
              const name = q.name || q.$autoname;
              if (q.label == undefined) { return false;}
              var response = s[name];

              if (q.type=="select_one" && s[name]) {
                const choice = choices.find(x => x.name === s[name]);
                if (choice && choice.label)
                  response = choice.label[0];
              }

              if (q.type === 'select_multiple' && s[name]) {
                var responses = s[name].split(' ');
                var list = responses.map((r)=> {
                  const choice = choices.find(x => x.name === r);
                  if (choice && choice.label)
                    return <li key={r}>{choice.label[0]}</li>;
                })
                response = <ul>{list}</ul>;
              }

              if (q.type === 'image' && s[name]) {
                response = this.renderAttachment(s[name]);
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
          </tbody>
        </table>
        <button onClick={this.deleteSubmission}
                className="mdl-button mdl-button--colored mdl-button--danger">
          {t('Delete Submission')}
        </button>

      </bem.FormModal>
    );
  }
};

export default Submission;
