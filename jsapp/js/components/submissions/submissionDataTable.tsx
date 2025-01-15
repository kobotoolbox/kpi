import React from 'react';
import autoBind from 'react-autobind';
import bem, {makeBem} from 'js/bem';
import Button from 'js/components/common/button';
import {
  formatTimeDate,
  formatDate,
} from 'js/utils';
import {findRow, renderQuestionTypeIcon} from 'js/assetUtils';
import {
  DISPLAY_GROUP_TYPES,
  getSubmissionDisplayData,
  getMediaAttachment,
  DisplayGroup,
} from 'js/components/submissions/submissionUtils';
import type {DisplayResponse} from 'js/components/submissions/submissionUtils';
import {
  META_QUESTION_TYPES,
  QUESTION_TYPES,
  SCORE_ROW_TYPE,
  RANK_LEVEL_TYPE,
} from 'js/constants';
import type {
  AnyRowTypeName,
  QuestionTypeName,
  MetaQuestionTypeName,
} from 'js/constants';
import './submissionDataTable.scss';
import type {
  AssetResponse,
  SubmissionResponse,
} from 'jsapp/js/dataInterface';
import AudioPlayer from 'js/components/common/audioPlayer';
import {goToProcessing} from 'js/components/processing/routes.utils';
import {PROCESSING_QUESTION_TYPES} from 'js/components/processing/processingUtils';
import SimpleTable from 'js/components/common/SimpleTable';

bem.SubmissionDataTable = makeBem(null, 'submission-data-table');
bem.SubmissionDataTable__row = makeBem(bem.SubmissionDataTable, 'row');
bem.SubmissionDataTable__column = makeBem(bem.SubmissionDataTable, 'column');
bem.SubmissionDataTable__XMLName = makeBem(bem.SubmissionDataTable, 'xml-name');
bem.SubmissionDataTable__value = makeBem(bem.SubmissionDataTable, 'value');

interface SubmissionDataTableProps {
  asset: AssetResponse;
  submissionData: SubmissionResponse;
  translationIndex: number;
  showXMLNames?: boolean;
}

/**
 * This is a table that displays all data for single submission. It is currently
 * being used int Single Submission Modal.
 */
class SubmissionDataTable extends React.Component<SubmissionDataTableProps> {
  constructor(props: SubmissionDataTableProps) {
    super(props);
    autoBind(this);
  }

  openProcessing(name: string) {
    if (this.props.asset?.content) {
      const foundRow = findRow(this.props.asset?.content, name);
      if (foundRow && foundRow.$xpath !== undefined) {
        goToProcessing(
          this.props.asset.uid,
          foundRow.$xpath,
          this.props.submissionData._uuid
        );
      }
    }
  }

  renderGroup(item: DisplayGroup, itemIndex?: number) {
    return (
      <bem.SubmissionDataTable__row
        m={['group', `type-${item.type}`]}
        key={`${item.name}__${itemIndex}`}
        dir='auto'
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
          {item.children?.map((child, index) => {
            if (child instanceof DisplayGroup) {
              return this.renderGroup(child, index);
            } else {
              return this.renderResponse(child, index);
            }
          })}
        </bem.SubmissionDataTable__row>
      </bem.SubmissionDataTable__row>
    );
  }

  renderResponse(item: DisplayResponse, itemIndex: number) {
    return (
      <bem.SubmissionDataTable__row
        m={['columns', 'response', `type-${item.type}`]}
        key={`${item.name}__${itemIndex}`}
        dir='auto'
      >
        <bem.SubmissionDataTable__column m='type'>
          {item.type !== null && renderQuestionTypeIcon(item.type)}
        </bem.SubmissionDataTable__column>

        <bem.SubmissionDataTable__column m='label'>
          {item.label}
          {this.props.showXMLNames &&
            <bem.SubmissionDataTable__XMLName>
              {item.name}
            </bem.SubmissionDataTable__XMLName>
          }
        </bem.SubmissionDataTable__column>

        <bem.SubmissionDataTable__column m={['data', `type-${item.type}`]}>
          {this.renderResponseData(item)}
        </bem.SubmissionDataTable__column>
      </bem.SubmissionDataTable__row>
    );
  }

  renderResponseData(item: DisplayResponse) {
    if (item.data === null || item.data === undefined) {
      return null;
    }

    if (typeof item.data !== 'string') {
      // We are only expecting strings at this point in the code, if we get
      // anything else, we fall back to displaying raw data as a string (better
      // than displaying nothing)
      return String(item.data);
    }

    let choice;

    switch (item.type) {
      case QUESTION_TYPES.select_one.id:
      case SCORE_ROW_TYPE:
      case RANK_LEVEL_TYPE:
        choice = this.findChoice(item.listName, item.data);
        if (!choice) {
          console.error(`Choice not found for "${item.listName}" and "${item.data}".`);
          // fallback to raw data to display anything meaningful
          return item.data;
        } else {
          return (
            <bem.SubmissionDataTable__value>
              {choice.label?.[this.props.translationIndex] || choice.name}
            </bem.SubmissionDataTable__value>
          );
        }
      case QUESTION_TYPES.select_multiple.id:
        return (
          <ul>
            {item.data.split(' ').map((answer, answerIndex) => {
              choice = this.findChoice(item.listName, answer);
              if (!choice) {
                console.error(`Choice not found for "${item.listName}" and "${answer}".`);
                // fallback to raw data to display anything meaningful
                return answer;
              } else {
                return (
                  <li key={answerIndex}>
                    <bem.SubmissionDataTable__value>
                      {choice.label?.[this.props.translationIndex] || choice.name}
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
            {formatDate(item.data)}
          </bem.SubmissionDataTable__value>
        );
      case QUESTION_TYPES.datetime.id:
        return (
          <bem.SubmissionDataTable__value>
            {formatTimeDate(item.data)}
          </bem.SubmissionDataTable__value>
        );
      case QUESTION_TYPES.image.id:
      case QUESTION_TYPES.audio.id:
      case QUESTION_TYPES.video.id:
      case QUESTION_TYPES.file.id:
        return this.renderAttachment(item.type, item.data, item.name, item.xpath);
      case QUESTION_TYPES.geopoint.id:
      case QUESTION_TYPES.geotrace.id:
      case QUESTION_TYPES.geoshape.id:
        return this.renderPointsData(item.data);
      default:
        // all types not specified above just returns raw data
        return (
          <bem.SubmissionDataTable__value>
            {item.data}
          </bem.SubmissionDataTable__value>
        );
    }
  }

  findChoice(listName: string | undefined, choiceName: string) {
    return this.props.asset.content?.choices?.find((choice) =>
      choice.name === choiceName && choice.list_name === listName
    );
  }

  renderPointsData(data: string) {
    const pointsArray: string[][] = data.split(';').map((pointString) => pointString.split(' '));

    return (
      <SimpleTable
        head={[
          t('Point'),
          t('latitude (x.y °):'),
          t('longitude (x.y °):'),
          t('altitude (m):'),
          t('accuracy (m):'),
        ]}
        body={pointsArray.map((pointArray, pointIndex) => (
          [<>P<sub>{pointIndex + 1}</sub></>, ...pointArray]
        ))}
      />
    );
  }

  renderAttachment(
    type: AnyRowTypeName | null,
    filename: string,
    name: string,
    xpath: string
  ) {
    const attachment = getMediaAttachment(this.props.submissionData, filename, xpath);
    if (attachment && attachment instanceof Object) {
      return (
        <>
          {type === QUESTION_TYPES.audio.id &&
            <>
              <AudioPlayer mediaURL={attachment.download_url} />

              <Button
                type='primary'
                size='s'
                endIcon='arrow-up-right'
                label={t('Open')}
                onClick={this.openProcessing.bind(this, name)}
              />
            </>
          }
          {type === QUESTION_TYPES.image.id &&
            <a href={attachment.download_url} target='_blank'>
              <img src={attachment.download_medium_url}/>
            </a>
          }

          {type === QUESTION_TYPES.video.id &&
            <video
              src={attachment.download_url}
              controls
            />
          }

          {type === QUESTION_TYPES.file.id &&
            <a href={attachment.download_url} target='_blank'>
              {filename}
            </a>
          }
        </>
      );
    // In the case that an attachment is missing, don't crash the page
    } else {
      return attachment;
    }
  }

  renderMetaResponse(dataName: MetaQuestionTypeName | string, label: string) {
    return (
      <bem.SubmissionDataTable__row
        m={['columns', 'response', 'metadata']}
        dir='auto'
      >
        <bem.SubmissionDataTable__column m='type'>
          {typeof dataName !== 'string' && renderQuestionTypeIcon(dataName)}
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
          <bem.SubmissionDataTable__value>
            {this.props.submissionData[dataName]}
          </bem.SubmissionDataTable__value>
        </bem.SubmissionDataTable__column>
      </bem.SubmissionDataTable__row>
    );
  }

  render() {
    const displayData = getSubmissionDisplayData(
      this.props.asset,
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
