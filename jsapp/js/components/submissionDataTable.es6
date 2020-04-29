import React from 'react';
import autoBind from 'react-autobind';
import {
  t,
  formatTimeDate,
  formatDate
} from 'js/utils';
import Checkbox from 'js/components/checkbox';
import {bem} from 'js/bem';
import {renderTypeIcon} from 'js/assetUtils';
import {DISPLAY_GROUP_TYPES} from 'js/submissionUtils';
import {QUESTION_TYPES} from 'js/constants';

/**
 * @prop {DisplayGroup} displayData
 * @prop {Array<object>} choices
 */
class SubmissionDataTable extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
    this.state = {
      showXMLNames: false
    };
  }

  onShowXMLNamesChange(newValue) {
    this.setState({showXMLNames: newValue});
  }

  renderGroup(item, itemIndex) {
    return (
      <bem.SubmissionDataTable__row
        m={['group', `type-${item.type}`]}
        key={`${item.name}__${itemIndex}`}
      >
        {item.name !== null &&
          <bem.SubmissionDataTable__row m='group-label'>
            {item.label}
            {this.state.showXMLNames &&
              <bem.SubmissionDataTable__XMLName>
                {item.name}
              </bem.SubmissionDataTable__XMLName>
            }
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
    return (
      <bem.SubmissionDataTable__row
        m={['columns', 'response', `type-${item.type}`]}
        key={`${item.name}__${itemIndex}`}
      >
        <bem.SubmissionDataTable__column m='type'>
          {renderTypeIcon(item.type)}
        </bem.SubmissionDataTable__column>

        <bem.SubmissionDataTable__column m='label'>
          {item.label}
          {this.state.showXMLNames &&
            <bem.SubmissionDataTable__XMLName>
              {item.name}
            </bem.SubmissionDataTable__XMLName>
          }
        </bem.SubmissionDataTable__column>

        <bem.SubmissionDataTable__column m='data'>
          {this.renderResponseData(item.type, item.data)}
        </bem.SubmissionDataTable__column>
      </bem.SubmissionDataTable__row>
    );
  }

  renderResponseData(type, data) {
    if (data === null) {
      return null;
    }

    let choice;

    switch (type) {
      case QUESTION_TYPES.get('select_one').id:
        choice = this.findChoice(data);
        return (
          <bem.SubmissionDataTable__value>
            {choice.label[this.props.translationIndex]}
          </bem.SubmissionDataTable__value>
        );
      case QUESTION_TYPES.get('select_multiple').id:
        return (
          <ul>
            {data.split(' ').map((answer, answerIndex) => {
              choice = this.findChoice(answer);
              return (
                <li key={answerIndex}>
                  <bem.SubmissionDataTable__value>
                    {choice.label[this.props.translationIndex]}
                  </bem.SubmissionDataTable__value>
                </li>
              );
            })}
          </ul>
        );
      case QUESTION_TYPES.get('date').id:
        return (
          <bem.SubmissionDataTable__value>
            {formatDate(data)}
          </bem.SubmissionDataTable__value>
        );
      case QUESTION_TYPES.get('datetime').id:
        return (
          <bem.SubmissionDataTable__value>
            {formatTimeDate(data)}
          </bem.SubmissionDataTable__value>
        );
      case QUESTION_TYPES.get('geopoint').id:
        return this.renderPointData(data);
      case QUESTION_TYPES.get('image').id:
        break;
      case QUESTION_TYPES.get('audio').id:
        break;
      case QUESTION_TYPES.get('video').id:
        break;
      case QUESTION_TYPES.get('geotrace').id:
        return this.renderMultiplePointsData(data);
      case QUESTION_TYPES.get('barcode').id:
        break;
      case QUESTION_TYPES.get('geoshape').id:
        return this.renderMultiplePointsData(data);
      case QUESTION_TYPES.get('score').id:
        break;
      case QUESTION_TYPES.get('kobomatrix').id:
        break;
      case QUESTION_TYPES.get('rank').id:
        break;
      case QUESTION_TYPES.get('calculate').id:
        break;
      case QUESTION_TYPES.get('file').id:
        break;
      default:
        // all types not specified above just returns raw data
        return (
          <bem.SubmissionDataTable__value>
            {data}
          </bem.SubmissionDataTable__value>
        );
    }
  }

  findChoice(name) {
    return this.props.choices.find((choice) => {
      return choice.name === name;
    });
  }

  renderPointData(data) {
    const parts = data.split(' ');
    return (
      <ul>
        <li>
          {t('latitude (x.y °):') + ' '}
          <bem.SubmissionDataTable__value>{parts[0]}</bem.SubmissionDataTable__value>
        </li>
        <li>
          {t('longitude (x.y °):') + ' '}
          <bem.SubmissionDataTable__value>{parts[1]}</bem.SubmissionDataTable__value>
        </li>
        <li>
          {t('altitude (m):') + ' '}
          <bem.SubmissionDataTable__value>{parts[2]}</bem.SubmissionDataTable__value>
        </li>
        <li>
          {t('accuracy (m):') + ' '}
          <bem.SubmissionDataTable__value>{parts[3]}</bem.SubmissionDataTable__value>
        </li>
      </ul>
    );
  }

  renderMultiplePointsData(data) {
    return (data.split(';').map((pointData, pointIndex) => {
      return (
        <bem.SubmissionDataTable__row m={['columns', 'point']}>
          <bem.SubmissionDataTable__column>
            P<sub>{pointIndex + 1}</sub>
          </bem.SubmissionDataTable__column>
          <bem.SubmissionDataTable__column>
            {this.renderPointData(pointData)}
          </bem.SubmissionDataTable__column>
        </bem.SubmissionDataTable__row>
      );
    }));
  }

  render() {
    return (
      <bem.SubmissionDataTable>
        <Checkbox
          checked={this.state.showXMLNames}
          onChange={this.onShowXMLNamesChange}
          label={t('Display XML names')}
        />

        {this.renderGroup(this.props.displayData)}
      </bem.SubmissionDataTable>
    );
  }
}

export default SubmissionDataTable;
