import './MediaCell.scss'
import { Group } from '@mantine/core'
import { IconPencilStar } from '@tabler/icons-react'
import React from 'react'
import autoBind from 'react-autobind'
import DeletedAttachment from '#/attachments/deletedAttachment.component'
import bem, { makeBem } from '#/bem'
import ActionIcon from '#/components/common/ActionIcon'
import Button from '#/components/common/button'
import Icon from '#/components/common/icon'
import { goToProcessing } from '#/components/processing/routes.utils'
import { openTableMediaPreviewModal } from '#/components/submissions/DataTableCell/TableMediaPreview'
import { QUESTION_TYPES } from '#/constants'
import type { AnyRowTypeName } from '#/constants'
import type { AssetResponse, SubmissionAttachment, SubmissionResponse } from '#/dataInterface'
import type { IconName } from '#/k-icons'
import { getSubmissionRootUuid } from '#/utils'

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
  displayValue: string
  /** Index of the submission for text questions. */
  submissionIndex: number
  /** Total submissions for text questions. */
  submissionTotal: number
  submission: SubmissionResponse
  asset: AssetResponse
  /** Path of the question to open in Processing. */
  xpath?: string
  /** Shows the "Open" button that jumps into Processing, for question types NLP supports (e.g. image). */
  showProcessingAction?: boolean
}

/**
 * Table cell replacement for image and video submissions. For audio type
 * questions, please use `AudioCell` component. With `showProcessingAction`
 * it also gets an "Open" button that jumps straight into Processing.
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

  launchMediaModal(evt: React.MouseEvent<HTMLButtonElement>) {
    evt.preventDefault()

    if (typeof this.props.mediaAttachment !== 'string') {
      openTableMediaPreviewModal({
        questionType: this.props.questionType,
        questionIcon: this.getQuestionIcon(),
        mediaAttachment: this.props.mediaAttachment,
        displayValue: this.props.displayValue,
        submissionIndex: this.props.submissionIndex,
        submissionTotal: this.props.submissionTotal,
        submission: this.props.submission,
        asset: this.props.asset,
      })
    }
  }

  openProcessing() {
    if (this.props.xpath === undefined) {
      return
    }
    goToProcessing(this.props.asset.uid, this.props.xpath, getSubmissionRootUuid(this.props.submission))
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
        <bem.MediaCell__text>{this.props.displayValue}</bem.MediaCell__text>

        <Group gap={0} wrap='nowrap'>
          <bem.MediaCellIconWrapper>
            <Button
              type='text'
              size='s'
              startIcon={this.getQuestionIcon()}
              onClick={this.launchMediaModal.bind(this)}
            />
          </bem.MediaCellIconWrapper>

          {this.props.showProcessingAction && this.props.xpath !== undefined && (
            <ActionIcon
              variant='transparent'
              tooltip={t('Open')}
              icon={IconPencilStar}
              size='sm'
              onClick={this.openProcessing}
            />
          )}
        </Group>

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
