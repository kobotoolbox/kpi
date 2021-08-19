import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import {
  getFlatQuestionsList,
  renderQuestionTypeIcon,
} from 'js/assetUtils';
import {QUESTION_TYPES} from 'js/constants';

const DISPLAY_LIMIT = 8;

/**
 * AKA "Quick Look" component
 */

class AssetContentSummary extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      isExpanded: false,
    };
    autoBind(this);
  }

  renderQuestion(question, itemIndex) {
    const modifiers = ['columns', 'padding-small'];
    if (itemIndex !== 0) {
      modifiers.push('bordertop');
    }
    return (
      <bem.FormView__cell m={modifiers} key={itemIndex}>
        <bem.FormView__cell m='column-icon'>
          {renderQuestionTypeIcon(question.type)}
        </bem.FormView__cell>

        <bem.FormView__cell m={['column-1', 'asset-content-summary-name']}>
          {question.parents.length > 0 &&
            <small>{question.parents.join(' / ') + ' /'}</small>
          }

          <div>
            {question.isRequired && <strong>*&nbsp;</strong>}
            {question.label}
          </div>
        </bem.FormView__cell>
      </bem.FormView__cell>
    );
  }

  filterRealQuestions(questions) {
    return questions.filter((question) => {
      return QUESTION_TYPES[question.type];
    });
  }

  toggleExpanded() {
    this.setState({isExpanded: !this.state.isExpanded});
  }

  render() {
    if (!this.props.asset) {
      return null;
    }

    // TODO add a language selection to display localized questions labels
    let items = getFlatQuestionsList(this.props.asset.content.survey);
    const isExpandable = items.length > DISPLAY_LIMIT;

    if (isExpandable && !this.state.isExpanded) {
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
      <React.Fragment>
        <bem.FormView__cell m={['box', 'bordered']}>
          {items.map(this.renderQuestion)}
        </bem.FormView__cell>

        {isExpandable &&
          <bem.FormView__cell m={['toggle-details']}>
            <button onClick={this.toggleExpanded}>
              {this.state.isExpanded ? <i className='k-icon k-icon-up'/> : <i className='k-icon k-icon-down'/>}
              {this.state.isExpanded ? t('Show less') : t('Show more')}
            </button>
          </bem.FormView__cell>
        }
      </React.Fragment>
    );
  }
}

export default AssetContentSummary;
