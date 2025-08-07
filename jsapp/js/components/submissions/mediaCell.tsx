import './mediaCell.scss'

import React from 'react'

import autoBind from 'react-autobind'
import { actions } from '#/actions'
import AttachmentActionsDropdown from '#/attachments/AttachmentActionsDropdown'
import DeletedAttachment from '#/attachments/deletedAttachment.component'
import bem, { makeBem } from '#/bem'
import Button from '#/components/common/button'
import Icon from '#/components/common/icon'
import { MODAL_TYPES, QUESTION_TYPES } from '#/constants'
import type { AnyRowTypeName } from '#/constants'
import type { AssetResponse, SubmissionAttachment, SubmissionResponse } from '#/dataInterface'
import type { IconName } from '#/k-icons'
import pageState from '#/pageState.store'
import { truncateString } from '#/utils'

bem.TableMediaPreviewHeader = makeBem(null, 'table-media-preview-header')
bem.TableMediaPreviewHeader__title = makeBem(bem.TableMediaPreviewHeader, 'title', 'div')
bem.TableMediaPreviewHeader__label = makeBem(bem.TableMediaPreviewHeader, 'label', 'label')
bem.TableMediaPreviewHeader__options = makeBem(bem.TableMediaPreviewHeader, 'options', 'div')

bem.MediaCell = makeBem(null, 'media-cell')
bem.MediaCell__duration = makeBem(bem.MediaCell, 'duration', 'label')
bem.MediaCell__text = makeBem(bem.MediaCell, 'text', 'div')

bem.MediaCellIconWrapper = makeBem(null, 'icon-wrapper')
bem.MediaCellIconWrapper__icon = makeBem(bem.MediaCellIconWrapper, 'icon', 'i')

interface MediaCellProps {
  questionType: AnyRowTypeName
  /** If string is passed it's an error message. */
  mediaAttachment: SubmissionAttachment | string
  /** Backend stored media attachment file name or the content of a text question. */
  mediaName: string
  /** Index of the submission for text questions. */
  submissionIndex: number
  /** Total submissions for text questions. */
  submissionTotal: number
  submissionData: SubmissionResponse
  asset: AssetResponse
}

/**
 * Table cell replacement for image and video submissions. For audio type
 * questions, please use `AudioCell` component.
 */
class MediaCell extends React.Component<MediaCellProps, {}> {
  constructor(props: MediaCellProps) {
    super(props)
    autoBind(this)
  }

  // Different from renderQuestionTypeIcon as we need custom `title` and
  // event handling
  getQuestionIcon(): IconName {
    switch (this.props.questionType) {
      case QUESTION_TYPES.file.id:
        return 'qt-file'
      case QUESTION_TYPES.image.id:
        return 'qt-photo'
      case QUESTION_TYPES.video.id:
        return 'qt-video'
      default:
        return 'media-files'
    }
  }

  launchMediaModal(evt: MouseEvent | TouchEvent) {
    evt.preventDefault()

    if (typeof this.props.mediaAttachment !== 'string') {
      pageState.showModal({
        type: MODAL_TYPES.TABLE_MEDIA_PREVIEW,
        questionType: this.props.questionType,
        mediaAttachment: this.props.mediaAttachment,
        mediaName: this.props.mediaName,
        customModalHeader: this.renderMediaModalCustomHeader(
          this.getQuestionIcon(),
          this.props.mediaAttachment,
          this.props.mediaName,
          this.props.submissionIndex,
          this.props.submissionTotal,
          this.props.submissionData,
          this.props.asset,
        ),
      })
    }
  }

  renderMediaModalCustomHeader(
    questionIcon: IconName,
    attachment: SubmissionAttachment,
    mediaName: string,
    submissionIndex: number,
    submissionTotal: number,
    submissionData: SubmissionResponse,
    asset: AssetResponse,
  ) {
    let titleText = null

    // `download_url` only exists if there are attachments, otherwise assume only text
    if (attachment.download_url) {
      titleText = truncateString(mediaName, 30)
    } else {
      titleText = t('Submission ##submissionIndex## of ##submissionTotal##')
        .replace('##submissionIndex##', String(submissionIndex))
        .replace('##submissionTotal##', String(submissionTotal))
    }

    return (
      <bem.TableMediaPreviewHeader>
        <bem.TableMediaPreviewHeader__title>
          <Icon name={questionIcon} />
          <bem.TableMediaPreviewHeader__label
            // Give the user a way to see the full file name
            title={mediaName}
          >
            {titleText}
          </bem.TableMediaPreviewHeader__label>
        </bem.TableMediaPreviewHeader__title>

        <bem.TableMediaPreviewHeader__options>
          <AttachmentActionsDropdown
            asset={asset}
            submissionData={submissionData}
            attachmentUid={attachment.uid}
            onDeleted={() => {
              // Trigger refresh on the Data Table and close the modal
              actions.resources.refreshTableSubmissions()
              pageState.hideModal()
            }}
          />
        </bem.TableMediaPreviewHeader__options>
      </bem.TableMediaPreviewHeader>
    )
  }

  render() {
    const hasError = typeof this.props.mediaAttachment === 'string'

    if (hasError) {
      return (
        <bem.MediaCell>
          <bem.MediaCellIconWrapper data-tip={this.props.mediaAttachment}>
            <Icon name='alert' color='mid-red' size='s' />
          </bem.MediaCellIconWrapper>
        </bem.MediaCell>
      )
    }
    if (this.props.mediaAttachment.is_deleted) {
      return <DeletedAttachment title={this.props.mediaAttachment.filename} />
    }

    return (
      <bem.MediaCell m={`question-type-${this.props.questionType}`}>
        <bem.MediaCell__text>{this.props.mediaName}</bem.MediaCell__text>

        <bem.MediaCellIconWrapper>
          <Button type='text' size='s' startIcon={this.getQuestionIcon()} onClick={this.launchMediaModal.bind(this)} />
        </bem.MediaCellIconWrapper>

        {/*
          TODO: backend needs to store metadata to get duration, see kpi#3304
          !(questionType === QUESTION_TYPES.image.id) &&
          <bem.MediaCell__duration>
            {tempTime}
          </bem.MediaCell__duration>
          */}
      </bem.MediaCell>
    )
  }
}

export default MediaCell
