import React from 'react';
import autoBind from 'react-autobind';
import {t} from 'js/utils';
import {bem} from 'js/bem';
import {DISPLAY_GROUP_TYPES} from 'js/submissionUtils';

/**
 * @prop {DisplayGroup} displayData
 */
class SubmissionDataTable extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
  }

  renderGroup(item, itemIndex) {
    const uniqueKey = `${item.name}__${itemIndex}`;
    return (
      <bem.SubmissionDataTable__row m='group' key={uniqueKey}>
        {item.name !== null &&
          <bem.SubmissionDataTable__row m='group-label'>
            {item.label} ({item.name})
          </bem.SubmissionDataTable__row>
        }

        {item.type === DISPLAY_GROUP_TYPES.get('group_root') &&
          <bem.SubmissionDataTable__row m={['columns', 'column-names']}>
            <bem.SubmissionDataTable__column m='type'>
              {t('Type')}
            </bem.SubmissionDataTable__column>

            <bem.SubmissionDataTable__column m='label'>
              {t('Question')}
            </bem.SubmissionDataTable__column>

            <bem.SubmissionDataTable__column m='data'>
              {t('Response')}
            </bem.SubmissionDataTable__column>
          </bem.SubmissionDataTable__row>
        }

        <bem.SubmissionDataTable__row m='group-children'>
          {item.children.map((child, index) => {
            if (DISPLAY_GROUP_TYPES.has(child.type)) {
              return this.renderGroup(child, index);
            } else {
              return this.renderResponse(child, index);
            }
          })}
        </bem.SubmissionDataTable__row>
      </bem.SubmissionDataTable__row>
    );
  }

  renderResponse(item, itemIndex) {
    const uniqueKey = `${item.name}__${itemIndex}`;
    return (
      <bem.SubmissionDataTable__row m='columns' key={uniqueKey}>
        <bem.SubmissionDataTable__column m='type'>
          {item.type}
        </bem.SubmissionDataTable__column>

        <bem.SubmissionDataTable__column m='label'>
          {item.label}
        </bem.SubmissionDataTable__column>

        <bem.SubmissionDataTable__column m='data'>
          {item.data}
        </bem.SubmissionDataTable__column>
      </bem.SubmissionDataTable__row>
    );
  }

  render() {
    return (
      <bem.SubmissionDataTable>
        {this.renderGroup(this.props.displayData)}
      </bem.SubmissionDataTable>
    );
  }
}

export default SubmissionDataTable;
