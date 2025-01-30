import autoBind from 'react-autobind';
import React from 'react';
import bem, {makeBem} from 'js/bem';
import {
  MODAL_TYPES,
  QUESTION_TYPES,
} from 'js/constants';
import type {AnyRowTypeName} from 'js/constants';
import Button from 'js/components/common/button';
import {truncateString} from 'js/utils';
// import {hashHistory} from 'react-router';
import type {SubmissionAttachment} from 'js/dataInterface';
import './mediaCell.scss';
import Icon from 'js/components/common/icon';
import type {IconName} from 'jsapp/fonts/k-icons';
import pageState from 'js/pageState.store';

bem.TableMediaPreviewHeader = makeBem(null, 'table-media-preview-header');
bem.TableMediaPreviewHeader__title = makeBem(bem.TableMediaPreviewHeader, 'title', 'div');
bem.TableMediaPreviewHeader__label = makeBem(bem.TableMediaPreviewHeader, 'label', 'label');
bem.TableMediaPreviewHeader__options = makeBem(bem.TableMediaPreviewHeader, 'options', 'div');

bem.MediaCell = makeBem(null, 'media-cell');
bem.MediaCell__duration = makeBem(bem.MediaCell, 'duration', 'label');
bem.MediaCell__text = makeBem(bem.MediaCell, 'text', 'div');

bem.MediaCellIconWrapper = makeBem(null, 'icon-wrapper');
bem.MediaCellIconWrapper__icon = makeBem(bem.MediaCellIconWrapper, 'icon', 'i');

interface MediaCellProps {
 questionType: AnyRowTypeName;
 /** If string is passed it's an error message. */
 mediaAttachment: SubmissionAttachment | string;
 /** Backend stored media attachment file name or the content of a text question. */
 mediaName: string;
 /** Index of the submission for text questions. */
 submissionIndex: number;
 /** Total submissions for text questions. */
 submissionTotal: number;
 assetUid: string;
 xpath: string;
 submissionUuid: string;
}

/**
 * Table cell replacement for image and video submissions. For audio type
 * questions, please use `AudioCell` component.
 */
class MediaCell extends React.Component<MediaCellProps, {}> {
  constructor(props: MediaCellProps) {
    super(props);
    autoBind(this);
  }

  // Different from renderQuestionTypeIcon as we need custom `title` and
  // event handling
  getQuestionIcon(): IconName {
    switch (this.props.questionType) {
      case QUESTION_TYPES.image.id:
        return 'qt-photo';
      case QUESTION_TYPES.video.id:
        return 'qt-video';
      default:
        return 'media-files';
    }
  }

  launchMediaModal(evt: MouseEvent | TouchEvent) {
    evt.preventDefault();

    if (typeof this.props.mediaAttachment !== 'string') {
      pageState.showModal({
        type: MODAL_TYPES.TABLE_MEDIA_PREVIEW,
        questionType: this.props.questionType,
        mediaAttachment: this.props.mediaAttachment,
        mediaName: this.props.mediaName,
        customModalHeader: this.renderMediaModalCustomHeader(
          this.getQuestionIcon(),
          this.props.mediaAttachment?.download_url,
          this.props.mediaName,
          this.props.submissionIndex,
          this.props.submissionTotal,
        ),
      });
    }
  }

  renderMediaModalCustomHeader(
    questionIcon: IconName,
    mediaURL: string,
    mediaName: string,
    submissionIndex: number,
    submissionTotal: number,
  ) {
    let titleText = null;

    // mediaURL only exists if there are attachments, otherwise assume only text
    if (mediaURL) {
      titleText = truncateString(mediaName, 30);
    } else {
      titleText = t('Submission ##submissionIndex## of ##submissionTotal##')
        .replace('##submissionIndex##', String(submissionIndex))
        .replace('##submissionTotal##', String(submissionTotal));
    }

    return (
      <bem.TableMediaPreviewHeader>
        <bem.TableMediaPreviewHeader__title>
          <Icon name={questionIcon}/>
          <bem.TableMediaPreviewHeader__label
            // Give the user a way to see the full file name
            title={mediaName}
          >
            {titleText}
          </bem.TableMediaPreviewHeader__label>
        </bem.TableMediaPreviewHeader__title>

        <bem.TableMediaPreviewHeader__options>
          {mediaURL &&
            <a
              // TODO: once we get this button to `save as`, remove this target
              target='_blank'
              href={mediaURL}
            >
              <Button
                type='secondary'
                size='s'
                startIcon='download'
                label={t('download')}
              />
            </a>
          }
        </bem.TableMediaPreviewHeader__options>
      </bem.TableMediaPreviewHeader>
    );
  }

  render() {
    const hasError = typeof this.props.mediaAttachment === 'string';

    if (hasError) {
      return (
        <bem.MediaCell>
          <bem.MediaCellIconWrapper data-tip={this.props.mediaAttachment}>
            <Icon name='alert' color='mid-red' size='s'/>
          </bem.MediaCellIconWrapper>
        </bem.MediaCell>
      );
    }

    return (
      <bem.MediaCell>
        <bem.MediaCellIconWrapper>
          <Button
            type='text'
            size='s'
            startIcon={this.getQuestionIcon()}
            onClick={this.launchMediaModal.bind(this)}
          />
        </bem.MediaCellIconWrapper>

        {/*
          TODO: backend needs to store metadata to get duration, see kpi#3304
          !(questionType === QUESTION_TYPES.image.id) &&
          <bem.MediaCell__duration>
            {tempTime}
          </bem.MediaCell__duration>
          */
        }
      </bem.MediaCell>
    );
  }
}

export default MediaCell;
