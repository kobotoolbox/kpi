import React from 'react';
import autoBind from 'react-autobind';
import {
  formatTimeDate,
  formatDate,
} from 'utils';
import bem from 'js/bem';
import {renderQuestionTypeIcon} from 'js/assetUtils';
import {
  DISPLAY_GROUP_TYPES,
  getSubmissionDisplayData,
} from 'js/components/submissions/submissionUtils';
import {
  META_QUESTION_TYPES,
  QUESTION_TYPES,
  SCORE_ROW_TYPE,
  RANK_LEVEL_TYPE,
} from 'js/constants';
import './submissionDataTable.scss';

/**
 * @prop {object} asset
 * @prop {object} submissionData
 * @prop {number} translationIndex
 * @prop {boolean} [showXMLNames]
 */
class SubmissionDataTable extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
  }

  /**
   * @prop {DisplayGroup} item
   * @prop {number} itemIndex
   */
  renderGroup(item, itemIndex) {
    return (
      <bem.SubmissionDataTable__row
        m={['group', `type-${item.type}`]}
        key={`${item.name}__${itemIndex}`}
      >
        {item.name !== null &&
          <bem.SubmissionDataTable__row m='group-label'>
            {item.label}
            {this.props.showXMLNames &&
              <bem.SubmissionDataTable__XMLName>
                {item.name}
              </bem.SubmissionDataTable__XMLName>
            }
          </bem.SubmissionDataTable__row>
        }

        {item.type === DISPLAY_GROUP_TYPES.group_root &&
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
            if (DISPLAY_GROUP_TYPES[child.type]) {
              return this.renderGroup(child, index);
            } else {
              return this.renderResponse(child, index);
            }
          })}
        </bem.SubmissionDataTable__row>
      </bem.SubmissionDataTable__row>
    );
  }

  /**
   * @prop {DisplayResponse} item
   * @prop {number} itemIndex
   */
  renderResponse(item, itemIndex) {
    return (
      <bem.SubmissionDataTable__row
        m={['columns', 'response', `type-${item.type}`]}
        key={`${item.name}__${itemIndex}`}
      >
        <bem.SubmissionDataTable__column m='type'>
          {renderQuestionTypeIcon(item.type)}
        </bem.SubmissionDataTable__column>

        <bem.SubmissionDataTable__column m='label'>
          {item.label}
          {this.props.showXMLNames &&
            <bem.SubmissionDataTable__XMLName>
              {item.name}
            </bem.SubmissionDataTable__XMLName>
          }
        </bem.SubmissionDataTable__column>

        <bem.SubmissionDataTable__column m='data'>
          {this.renderResponseData(item.type, item.data, item.listName)}
        </bem.SubmissionDataTable__column>
      </bem.SubmissionDataTable__row>
    );
  }

  /**
   * @prop {string} type
   * @prop {string|null} data
   * @prop {string|undefined} listName
   */
  renderResponseData(type, data, listName) {
    if (data === null) {
      return null;
    }

    let choice;

    switch (type) {
      case QUESTION_TYPES.select_one.id:
      case SCORE_ROW_TYPE:
      case RANK_LEVEL_TYPE:
        choice = this.findChoice(listName, data);
        if (!choice) {
          console.error(`Choice not found for "${listName}" and "${data}".`);
          // fallback to raw data to display anything meaningful
          return data;
        } else {
          return (
            <bem.SubmissionDataTable__value>
              {choice.label[this.props.translationIndex] || choice.name}
            </bem.SubmissionDataTable__value>
          );
        }
      case QUESTION_TYPES.select_multiple.id:
        return (
          <ul>
            {data.split(' ').map((answer, answerIndex) => {
              choice = this.findChoice(listName, answer);
              if (!choice) {
                console.error(`Choice not found for "${listName}" and "${answer}".`);
                // fallback to raw data to display anything meaningful
                return answer;
              } else {
                return (
                  <li key={answerIndex}>
                    <bem.SubmissionDataTable__value>
                      {choice.label[this.props.translationIndex] || choice.name}
                    </bem.SubmissionDataTable__value>
                  </li>
                );
              }
            })}
          </ul>
        );
      case QUESTION_TYPES.date.id:
        return (
          <bem.SubmissionDataTable__value>
            {formatDate(data)}
          </bem.SubmissionDataTable__value>
        );
      case QUESTION_TYPES.datetime.id:
        return (
          <bem.SubmissionDataTable__value>
            {formatTimeDate(data)}
          </bem.SubmissionDataTable__value>
        );
      case QUESTION_TYPES.geopoint.id:
        return this.renderPointData(data);
      case QUESTION_TYPES.image.id:
      case QUESTION_TYPES.audio.id:
      case QUESTION_TYPES.video.id:
      case QUESTION_TYPES.file.id:
        return this.renderAttachment(type, data);
      case QUESTION_TYPES.geotrace.id:
        return this.renderMultiplePointsData(data);
      case QUESTION_TYPES.geoshape.id:
        return this.renderMultiplePointsData(data);
      default:
        // all types not specified above just returns raw data
        return (
          <bem.SubmissionDataTable__value>
            {data}
          </bem.SubmissionDataTable__value>
        );
    }
  }

  /**
   * @prop {string} listName
   * @prop {string} choiceName
   * @returns {object|undefined}
   */
  findChoice(listName, choiceName) {
    return this.props.asset.content.choices.find((choice) => {
      return choice.name === choiceName && choice.list_name === listName;
    });
  }

  /**
   * @prop {string} filename
   * @returns {object|undefined}
   */
  findAttachmentData(targetFilename) {
    // Match filename with full filename in attachment list
    // BUG: this works but is possible to find bad attachment as `includes` can match multiple
    return this.props.submissionData._attachments.find((attachment) => {
      return attachment.filename.endsWith(`/${targetFilename}`);
    });
  }

  /**
   * @prop {string} data
   */
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

  /**
   * @prop {string} data
   */
  renderMultiplePointsData(data) {
    return (data.split(';').map((pointData, pointIndex) => {
      return (
        <bem.SubmissionDataTable__row m={['columns', 'point']} key={pointIndex}>
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

  /**
   * @prop {string} type
   * @prop {string} filename
   */
  renderAttachment(type, filename) {
    const fileNameNoSpaces = filename.replace(/ /g, '_');
    const attachment = this.findAttachmentData(fileNameNoSpaces);

    if (attachment) {
      if (type === QUESTION_TYPES.image.id) {
        return (
          <a href={attachment.download_url} target='_blank'>
            <img src={attachment.download_medium_url}/>
          </a>
        );
      } else {
        return (<a href={attachment.download_url} target='_blank'>{filename}</a>);
      }
    // In the case that an attachment is missing, don't crash the page
    } else {
      return(t('Could not retrieve ##filename##').replace('##filename##', filename));
    }
  }

  /**
   * @prop {string} dataName
   * @prop {string} label
   */
  renderMetaResponse(dataName, label) {
    return (
      <bem.SubmissionDataTable__row m={['columns', 'response', 'metadata']}>
        <bem.SubmissionDataTable__column m='type'>
          {renderQuestionTypeIcon(dataName)}
        </bem.SubmissionDataTable__column>

        <bem.SubmissionDataTable__column m='label'>
          {label}
          {this.props.showXMLNames &&
            <bem.SubmissionDataTable__XMLName>
              {dataName}
            </bem.SubmissionDataTable__XMLName>
          }
        </bem.SubmissionDataTable__column>

        <bem.SubmissionDataTable__column m='data'>
          {this.props.submissionData[dataName]}
        </bem.SubmissionDataTable__column>
      </bem.SubmissionDataTable__row>
    );
  }

  render() {
    const displayData = getSubmissionDisplayData(
      this.props.asset.content.survey,
      this.props.asset.content.choices,
      this.props.translationIndex,
      this.props.submissionData
    );

    return (
      <bem.SubmissionDataTable>
        {this.renderGroup(displayData)}

        {this.renderMetaResponse(META_QUESTION_TYPES.start, t('start'))}
        {this.renderMetaResponse(META_QUESTION_TYPES.end, t('end'))}
        {this.renderMetaResponse(META_QUESTION_TYPES.today, t('today'))}
        {this.renderMetaResponse(META_QUESTION_TYPES.username, t('username'))}
        {this.renderMetaResponse(META_QUESTION_TYPES.simserial, t('sim serial'))}
        {this.renderMetaResponse(META_QUESTION_TYPES.subscriberid, t('subscriber ID'))}
        {this.renderMetaResponse(META_QUESTION_TYPES.deviceid, t('device ID'))}
        {this.renderMetaResponse(META_QUESTION_TYPES.phonenumber, t('phone number'))}
        {this.renderMetaResponse(META_QUESTION_TYPES.audit, t('audit'))}
        {this.renderMetaResponse('__version__', t('__version__'))}
        {this.renderMetaResponse('_id', t('_id'))}
        {this.renderMetaResponse('meta/instanceID', t('instanceID'))}
        {this.renderMetaResponse('_submitted_by', t('Submitted by'))}
      </bem.SubmissionDataTable>
    );
  }
}

export default SubmissionDataTable;
