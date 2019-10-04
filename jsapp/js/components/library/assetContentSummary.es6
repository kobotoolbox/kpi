// TODO: use `getSurveyFlatPaths` from `jsapp/js/assetUtils.es6` after
// commit 4b94fa97370ee1ec4bf82913d2872022ad9bce94 is merged

import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import {getQuestionDisplayName} from 'js/assetUtils';
import {QUESTION_TYPES} from 'js/constants';
import {t} from 'js/utils';

const DISPLAY_LIMIT = 8;

class AssetContentSummary extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      isExpanded: false,
      isExpandable: false
    };
    autoBind(this);
  }

  componentDidMount() {
    this.setState({
      isExpandable: this.props.asset.content.survey.length > DISPLAY_LIMIT
    });
  }

  renderQuestion(question, itemIndex) {
    const typeDef = QUESTION_TYPES.get(question.type);
    const modifiers = ['columns', 'padding-small'];
    if (itemIndex !== 0) {
      modifiers.push('bordertop');
    }
    return (
      <bem.FormView__cell
        m={modifiers}
        key={question.$kuid}
      >
        <bem.FormView__cell m='column-1'>
          <i className={['fa', 'fa-lg', typeDef.faIcon].join(' ')}/>
          &nbsp;
          {getQuestionDisplayName(question)}
        </bem.FormView__cell>
      </bem.FormView__cell>
    );
  }

  filterRealQuestions(questions) {
    return questions.filter((question) => {
      return QUESTION_TYPES.has(question.type);
    });
  }

  toggleExpanded() {
    this.setState({isExpanded: !this.state.isExpanded});
  }

  render() {
    if (!this.props.asset) {
      return null;
    }

    let items = this.filterRealQuestions(this.props.asset.content.survey);
    if (this.state.isExpandable && !this.state.isExpanded) {
      items = items.slice(0, DISPLAY_LIMIT);
    }

    if (items.length === 0) {
      return (
        <bem.FormView__cell m={['box', 'padding-small']}>
          {t('This ##asset_type## is empty.').replace('##asset_type##', this.props.asset.asset_type)}
        </bem.FormView__cell>
      );
    }

    return (
      <bem.FormView__cell m='box'>
        {items.map(this.renderQuestion)}

        {this.state.isExpandable &&
          <bem.FormView__cell m={['bordertop', 'toggle-details']}>
            <button onClick={this.toggleExpanded}>
              {this.state.isExpanded ? <i className='k-icon k-icon-up'/> : <i className='k-icon k-icon-down'/>}
              {this.state.isExpanded ? t('Show less') : t('Show more')}
            </button>
          </bem.FormView__cell>
        }
      </bem.FormView__cell>
    );
  }
}

export default AssetContentSummary;
