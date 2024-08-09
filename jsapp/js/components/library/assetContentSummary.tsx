import React from 'react';
import bem from 'js/bem';
import {
  getFlatQuestionsList,
  renderQuestionTypeIcon,
} from 'js/assetUtils';
import {ANY_ROW_TYPE_NAMES} from 'js/constants';
import type {FlatQuestion} from 'js/assetUtils';
import type {AssetResponse} from 'js/dataInterface';
import Button from 'js/components/common/button';

interface AssetContentSummaryProps {
  asset: AssetResponse;
}

interface AssetContentSummaryState {
  isExpanded: boolean;
}

const DISPLAY_LIMIT = 8;

/**
 * AKA "Quick Look" component, it displays a list of questions from given asset.
 */
export default class AssetContentSummary extends React.Component<
  AssetContentSummaryProps,
  AssetContentSummaryState
> {
  constructor(props: AssetContentSummaryProps) {
    super(props);
    this.state = {
      isExpanded: false,
    };
  }

  renderQuestion(question: FlatQuestion, itemIndex: number) {
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

  filterRealQuestions(questions: FlatQuestion[]) {
    return questions.filter((question) => {
      return Object.values(ANY_ROW_TYPE_NAMES).includes(question.type);
    });
  }

  toggleExpanded() {
    this.setState({isExpanded: !this.state.isExpanded});
  }

  render() {
    if (!this.props.asset?.content?.survey) {
      return null;
    }

    // TODO add a language selection to display localized questions labels
    // See: https://github.com/kobotoolbox/kpi/issues/3916
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
        <bem.FormView__cell m={['box', 'bordered']} dir='auto'>
          {items.map(this.renderQuestion.bind(this))}
        </bem.FormView__cell>

        {isExpandable &&
          <bem.FormView__cell>
            <Button
              type='text'
              size='m'
              onClick={this.toggleExpanded.bind(this)}
              label={this.state.isExpanded ? t('Show less') : t('Show more')}
              startIcon={this.state.isExpanded ? 'angle-up' : 'angle-down'}
            />
          </bem.FormView__cell>
        }
      </React.Fragment>
    );
  }
}
