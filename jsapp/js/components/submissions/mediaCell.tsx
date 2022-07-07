import autoBind from 'react-autobind';
import React from 'react';
import bem, {makeBem} from 'js/bem';
import {stores} from 'js/stores';
import {
  MODAL_TYPES,
  QUESTION_TYPES,
  META_QUESTION_TYPES,
} from 'js/constants';
import type {
  QuestionTypeName,
  MetaQuestionTypeName,
} from 'js/constants';
import Button from 'js/components/common/button';
import {ROUTES} from 'js/router/routerConstants';
import {truncateString} from 'js/utils';
import {hashHistory} from 'react-router';
import type {SubmissionAttachment} from 'js/dataInterface';
import './mediaCell.scss';

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
 questionType: MetaQuestionTypeName | QuestionTypeName;
 /** It's `null` for text questions. */
 mediaAttachment: SubmissionAttachment;
 /** Backend stored media attachment file name or the content of a text question. */
 mediaName: string;
 /** Index of the submission for text questions. */
 submissionIndex: number;
 /** Total submissions for text questions. */
 submissionTotal: number;
 assetUid: string;
 questionName: string;
 submissionUuid: string;
}

/** Table cell replacement for media submissions */
class MediaCell extends React.Component<MediaCellProps, {}> {
  questionIcon: string;

  constructor(props: MediaCellProps) {
    super(props);
    autoBind(this);

    this.questionIcon = this.getQuestionIcon();
  }

  getQuestionIcon() {
    const iconClassNames = ['k-icon'];

    // Different from renderQuestionTypeIcon as we need custom `title` and
    // event handling
    switch (this.props.questionType) {
      case QUESTION_TYPES.image.id:
        iconClassNames.push('k-icon-qt-photo');
        break;
      case QUESTION_TYPES.audio.id:
        iconClassNames.push('k-icon-qt-audio');
        break;
      case META_QUESTION_TYPES['background-audio']:
        iconClassNames.push('k-icon-background-rec');
        break;
      case QUESTION_TYPES.video.id:
        iconClassNames.push('k-icon-qt-video');
        break;
      case QUESTION_TYPES.text.id:
        iconClassNames.push('k-icon-expand-arrow');
        break;
      default:
        iconClassNames.push('k-icon-media-files');
        break;
    }

    return iconClassNames.join(' ');
  }

  openProcessing() {
    const finalRoute = ROUTES.FORM_PROCESSING
      .replace(':uid', this.props.assetUid)
      .replace(':questionName', this.props.questionName)
      .replace(':submissionUuid', this.props.submissionUuid);
    hashHistory.push(finalRoute);
  }

  launchMediaModal(evt: MouseEvent | TouchEvent) {
    evt.preventDefault();

    stores.pageState.showModal({
      type: MODAL_TYPES.TABLE_MEDIA_PREVIEW,
      questionType: this.props.questionType,
      mediaAttachment: this.props.mediaAttachment,
      mediaName: this.props.mediaName,
      customModalHeader: this.renderMediaModalCustomHeader(
        this.questionIcon,
        this.props.mediaAttachment?.download_url,
        this.props.mediaName,
        this.props.submissionIndex,
        this.props.submissionTotal,
      ),
    });
  }

  renderMediaModalCustomHeader(
    questionIcon: string,
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
          <i className={questionIcon}/>
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
              className='kobo-light-button kobo-light-button--blue'
              // TODO: once we get this button to `save as`, remove this target
              target='_blank'
              href={mediaURL}
            >
              {t('download')}

              <i className='k-icon k-icon-download'/>
            </a>
          }

          {[QUESTION_TYPES.audio.id, META_QUESTION_TYPES['background-audio']].includes(this.props.questionType) &&
            <Button
              type='frame'
              size='s'
              color='storm'
              endIcon='arrow-up-right'
              label={t('process')}
              onClick={this.openProcessing.bind(this)}
            />
          }
        </bem.TableMediaPreviewHeader__options>
      </bem.TableMediaPreviewHeader>
    );
  }

  render() {
    const isTextQuestion = !this.props.mediaAttachment;

    return (
      <bem.MediaCell m={isTextQuestion ? 'text' : ''}>
        {isTextQuestion &&
          // Show text as well if text question
          <bem.MediaCell__text className='trimmed-text'>
            {this.props.mediaName}
          </bem.MediaCell__text>
        }

        <bem.MediaCellIconWrapper>
          <bem.MediaCellIconWrapper__icon
            className={this.questionIcon}
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
