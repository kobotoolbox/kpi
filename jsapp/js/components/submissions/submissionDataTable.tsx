import './submissionDataTable.scss'

import React from 'react'

import { Group } from '@mantine/core'
import autoBind from 'react-autobind'
import { findRow, renderQuestionTypeIcon } from '#/assetUtils'
import AttachmentActionsDropdown from '#/attachments/AttachmentActionsDropdown'
import DeletedAttachment from '#/attachments/deletedAttachment.component'
import bem, { makeBem } from '#/bem'
import SimpleTable from '#/components/common/SimpleTable'
import Button from '#/components/common/button'
import { goToProcessing } from '#/components/processing/routes.utils'
import {
  DISPLAY_GROUP_TYPES,
  DisplayGroup,
  getMediaAttachment,
  getSubmissionDisplayData,
  shouldProcessingBeAccessible,
} from '#/components/submissions/submissionUtils'
import type { DisplayResponse } from '#/components/submissions/submissionUtils'
import { META_QUESTION_TYPES, QUESTION_TYPES, RANK_LEVEL_TYPE, SCORE_ROW_TYPE } from '#/constants'
import type { AnyRowTypeName, MetaQuestionTypeName } from '#/constants'
import type { AssetResponse, SubmissionResponse } from '#/dataInterface'
import { formatDate, formatTimeDate } from '#/utils'
import AudioPlayer from '../common/audioPlayer'

bem.SubmissionDataTable = makeBem(null, 'submission-data-table')
bem.SubmissionDataTable__row = makeBem(bem.SubmissionDataTable, 'row')
bem.SubmissionDataTable__column = makeBem(bem.SubmissionDataTable, 'column')
bem.SubmissionDataTable__XMLName = makeBem(bem.SubmissionDataTable, 'xml-name')
bem.SubmissionDataTable__value = makeBem(bem.SubmissionDataTable, 'value')

interface SubmissionDataTableProps {
  asset: AssetResponse
  submissionData: SubmissionResponse
  translationIndex: number
  showXMLNames?: boolean
  onAttachmentDeleted: (attachmentUid: string) => void
}

/**
 * This is a table that displays all data for single submission. It is currently
 * being used int Single Submission Modal.
 */
class SubmissionDataTable extends React.Component<SubmissionDataTableProps> {
  constructor(props: SubmissionDataTableProps) {
    super(props)
    autoBind(this)
  }

  openProcessing(name: string) {
    if (this.props.asset?.content) {
      const foundRow = findRow(this.props.asset?.content, name)
      if (foundRow && foundRow.$xpath !== undefined) {
        goToProcessing(this.props.asset.uid, foundRow.$xpath, this.props.submissionData._uuid)
      }
    }
  }

  renderGroup(item: DisplayGroup, itemIndex?: number) {
    return (
      <bem.SubmissionDataTable__row m={['group', `type-${item.type}`]} key={`${item.name}__${itemIndex}`} dir='auto'>
        {item.name !== null && (
          <bem.SubmissionDataTable__row m='group-label'>
            {item.label}
            {this.props.showXMLNames && (
              <bem.SubmissionDataTable__XMLName>{item.name}</bem.SubmissionDataTable__XMLName>
            )}
          </bem.SubmissionDataTable__row>
        )}

        {item.type === DISPLAY_GROUP_TYPES.group_root && (
          <bem.SubmissionDataTable__row m={['columns', 'column-names']}>
            <bem.SubmissionDataTable__column m='type'>{t('Type')}</bem.SubmissionDataTable__column>

            <bem.SubmissionDataTable__column m='label'>{t('Question')}</bem.SubmissionDataTable__column>

            <bem.SubmissionDataTable__column m='data'>{t('Response')}</bem.SubmissionDataTable__column>
          </bem.SubmissionDataTable__row>
        )}

        <bem.SubmissionDataTable__row m='group-children'>
          {item.children?.map((child, index) => {
            if (child instanceof DisplayGroup) {
              return this.renderGroup(child, index)
            } else {
              return this.renderResponse(child, index)
            }
          })}
        </bem.SubmissionDataTable__row>
      </bem.SubmissionDataTable__row>
    )
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
          {this.props.showXMLNames && <bem.SubmissionDataTable__XMLName>{item.name}</bem.SubmissionDataTable__XMLName>}
        </bem.SubmissionDataTable__column>

        <bem.SubmissionDataTable__column m={['data', `type-${item.type}`]}>
          {this.renderResponseData(item)}
        </bem.SubmissionDataTable__column>
      </bem.SubmissionDataTable__row>
    )
  }

  renderResponseData(item: DisplayResponse) {
    if (item.data === null || item.data === undefined) {
      return null
    }

    if (typeof item.data !== 'string') {
      // We are only expecting strings at this point in the code, if we get
      // anything else, we fall back to displaying raw data as a string (better
      // than displaying nothing)
      return String(item.data)
    }

    let choice

    switch (item.type) {
      case QUESTION_TYPES.select_one.id:
      case SCORE_ROW_TYPE:
      case RANK_LEVEL_TYPE:
        choice = this.findChoice(item.listName, item.data)
        if (choice) {
          return (
            <bem.SubmissionDataTable__value>
              {choice.label?.[this.props.translationIndex] || choice.name}
            </bem.SubmissionDataTable__value>
          )
        } else {
          console.error(`Choice not found for "${item.listName}" and "${item.data}".`)
          // fallback to raw data to display anything meaningful
          return item.data
        }
      case QUESTION_TYPES.select_multiple.id:
        return (
          <ul>
            {item.data.split(' ').map((answer, answerIndex) => {
              choice = this.findChoice(item.listName, answer)
              if (choice) {
                return (
                  <li key={answerIndex}>
                    <bem.SubmissionDataTable__value>
                      {choice.label?.[this.props.translationIndex] || choice.name}
                    </bem.SubmissionDataTable__value>
                  </li>
                )
              } else {
                console.error(`Choice not found for "${item.listName}" and "${answer}".`)
                // fallback to raw data to display anything meaningful
                return answer
              }
            })}
          </ul>
        )
      case QUESTION_TYPES.date.id:
        return <bem.SubmissionDataTable__value>{formatDate(item.data)}</bem.SubmissionDataTable__value>
      case QUESTION_TYPES.datetime.id:
        return <bem.SubmissionDataTable__value>{formatTimeDate(item.data)}</bem.SubmissionDataTable__value>
      case QUESTION_TYPES.image.id:
      case QUESTION_TYPES.audio.id:
      case QUESTION_TYPES.video.id:
      case QUESTION_TYPES.file.id:
        return this.renderAttachment(item.type, item.data, item.name, item.xpath)
      case QUESTION_TYPES.geopoint.id:
      case QUESTION_TYPES.geotrace.id:
      case QUESTION_TYPES.geoshape.id:
      case QUESTION_TYPES['background-geopoint'].id:
        return this.renderPointsData(item.data)
      default:
        // all types not specified above just returns raw data
        return <bem.SubmissionDataTable__value>{item.data}</bem.SubmissionDataTable__value>
    }
  }

  findChoice(listName: string | undefined, choiceName: string) {
    return this.props.asset.content?.choices?.find(
      (choice) => choice.name === choiceName && choice.list_name === listName,
    )
  }

  renderPointsData(data: string) {
    const pointsArray: string[][] = data.split(';').map((pointString) => pointString.split(' '))

    return (
      <SimpleTable
        head={[t('Point'), t('latitude (x.y °):'), t('longitude (x.y °):'), t('altitude (m):'), t('accuracy (m):')]}
        body={pointsArray.map((pointArray, pointIndex) => [
          <>
            P<sub>{pointIndex + 1}</sub>
          </>,
          ...pointArray,
        ])}
      />
    )
  }

  renderAttachment(type: AnyRowTypeName | null, filename: string, name: string, xpath: string) {
    const attachment = getMediaAttachment(this.props.submissionData, filename, xpath)

    // In the case that an attachment is missing, don't crash the page
    if (typeof attachment !== 'object') return attachment

    if (!attachment || typeof attachment.download_url !== 'string') return null

    if (attachment.is_deleted) {
      return (
        <Group>
          <DeletedAttachment />
        </Group>
      )
    }

    const attachmentShortFilename = attachment.filename.split('/').pop()

    return (
      <>
        {type === QUESTION_TYPES.audio.id && (
          <Group>
            <AudioPlayer mediaURL={attachment?.download_url} />

            <span className='print-only'>{attachmentShortFilename}</span>

            {shouldProcessingBeAccessible(this.props.submissionData, attachment) && (
              <Button
                className='hide-on-print'
                type='primary'
                size='s'
                endIcon='arrow-up-right'
                label={t('Open')}
                onClick={this.openProcessing.bind(this, name)}
              />
            )}
          </Group>
        )}

        {type === QUESTION_TYPES.image.id && (
          <>
            <a href={attachment.download_url} target='_blank'>
              <img src={attachment.download_medium_url} />
            </a>
            <span className='print-only'>{attachmentShortFilename}</span>
          </>
        )}

        {type === QUESTION_TYPES.video.id && (
          <>
            <video src={attachment.download_url} controls />
            <span className='print-only'>{attachmentShortFilename}</span>
          </>
        )}

        {type === QUESTION_TYPES.file.id && (
          <a href={attachment.download_url} target='_blank'>
            {filename}
          </a>
        )}

        {type !== null && (
          <AttachmentActionsDropdown
            asset={this.props.asset}
            submissionData={this.props.submissionData}
            attachmentUid={attachment.uid}
            onDeleted={() => {
              this.props.onAttachmentDeleted(attachment.uid)
            }}
          />
        )}
      </>
    )
  }

  renderMetaResponse(dataName: MetaQuestionTypeName | string, label: string) {
    return (
      <bem.SubmissionDataTable__row m={['columns', 'response', 'metadata']} dir='auto'>
        <bem.SubmissionDataTable__column m='type'>
          {typeof dataName !== 'string' && renderQuestionTypeIcon(dataName)}
        </bem.SubmissionDataTable__column>

        <bem.SubmissionDataTable__column m='label'>
          {label}
          {this.props.showXMLNames && <bem.SubmissionDataTable__XMLName>{dataName}</bem.SubmissionDataTable__XMLName>}
        </bem.SubmissionDataTable__column>

        <bem.SubmissionDataTable__column m='data'>
          <bem.SubmissionDataTable__value>{this.props.submissionData[dataName]}</bem.SubmissionDataTable__value>
        </bem.SubmissionDataTable__column>
      </bem.SubmissionDataTable__row>
    )
  }

  render() {
    const displayData = getSubmissionDisplayData(
      this.props.asset,
      this.props.translationIndex,
      this.props.submissionData,
    )

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
    )
  }
}

export default SubmissionDataTable
