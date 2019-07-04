import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import {getQuestionDisplayName} from 'js/formUtils';
import {QUESTION_TYPES} from 'js/constants';
import {t} from 'js/utils';

class AssetContentSummary extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
  }

  componentDidMount() {
    console.debug('AssetContentSummary did mount', this.props);
  }

  renderQuestion(question) {
    if (QUESTION_TYPES.has(question.type)) {
      const typeDef = QUESTION_TYPES.get(question.type);

      return (
        <bem.FormView__cell
          m={['columns', 'padding', 'bordertop']}
          key={question.$kuid}
        >
          <bem.FormView__cell m='column-1'>
            <i className={['fa', 'fa-lg', typeDef.faIcon].join(' ')}/>
            &nbsp;
            {getQuestionDisplayName(question)}
          </bem.FormView__cell>
        </bem.FormView__cell>
      );
    } else {
      return null;
    }
  }

  render() {
    if (!this.props.assetContent) {
      return null;
    }

    return (
      <bem.FormView__cell m='box'>
        {this.props.assetContent.survey.map(this.renderQuestion)}
      </bem.FormView__cell>
    );
  }
}

export default AssetContentSummary;
