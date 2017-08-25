import React from 'react';
import ReactDOM from 'react-dom';
import autoBind from 'react-autobind';
import {dataInterface} from '../dataInterface';
import bem from '../bem';
import {t} from '../utils';
import ui from '../ui';

class Submission extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      submission: {},
      loading: true,
      error: false
    };
    autoBind(this);
  }
  componentDidMount () {
    dataInterface.getSubmission(this.props.asset.uid, this.props.sid).done((data) => {
      this.setState({
        submission: data,
        loading: false
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
