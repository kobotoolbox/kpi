import React from 'react';
import ReactDOM from 'react-dom';
import autoBind from 'react-autobind';
import {dataInterface} from '../dataInterface';
import bem from '../bem';
import {t} from '../utils';


class Submission extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      submission: {},
      loading: true
    };
    autoBind(this);
  }
  componentDidMount () {
    // TEMPORARY hook-up to KC API (NOT FOR PRODUCTION)
    // Only works with --disable-web-security flag in browser
    let sid = this.props.sid;

    dataInterface.getToken().done((t) => {
      if (t && t.token) {
        var kc_server = document.createElement('a');
        kc_server.href = this.props.asset.deployment__identifier;
        let kc_url = kc_server.origin;

        let uid = this.props.asset.uid;
        dataInterface.getKCForm(kc_url, t.token, uid).done((form) => {
          if (form && form.length === 1) {
            dataInterface.getKCSubmission(kc_url, t.token, form[0].formid, sid).done((data) => {

              this.setState({
                submission: data,
                loading: false
              });

            }).fail((failData)=>{
              console.log(failData);
            });
          }
        }).fail((failData)=>{
          console.log(failData);
        });
      }
    }).fail((failData)=>{
      console.log(failData);
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

    const s = this.state.submission;
    const survey = this.props.asset.content.survey;
    const choices = this.props.asset.content.choices;

    return (
      <bem.FormModal>
        <table>
          <thead>
          <tr>
            <td>{t('Question')}</td><td>{t('Response')}</td><td>{t('Type')}</td>
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

              return (
                <tr key={`row-${name}`}>
                  <td>{q.label[0]}</td>
                  <td>{response}</td>
                  <td>{q.type}</td>
                </tr>      
              );
            })}
          </tbody>
        </table>
      </bem.FormModal>
    );
  }
};

export default Submission;
