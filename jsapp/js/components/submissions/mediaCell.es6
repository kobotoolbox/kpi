import autoBind from 'react-autobind';
import React from 'react';
import bem from 'js/bem';
import {stores} from 'js/stores';
import {
  MODAL_TYPES,
  QUESTION_TYPES,
  META_QUESTION_TYPES,
} from 'js/constants';
import {truncateString} from 'js/utils';
import './mediaCell.scss';

bem.TableMediaPreviewHeader = bem('table-media-preview-header');
bem.TableMediaPreviewHeader__title = bem.TableMediaPreviewHeader.__('title', '<div>');
bem.TableMediaPreviewHeader__label = bem.TableMediaPreviewHeader.__('label', '<label>');
bem.TableMediaPreviewHeader__options = bem.TableMediaPreviewHeader.__('options', '<div>');

bem.MediaCell = bem('media-cell');
bem.MediaCell__duration = bem.MediaCell.__('duration', '<label>');
bem.MediaCell__text = bem.MediaCell.__('text', '<div>');

bem.MediaCellIconWrapper = bem('icon-wrapper');
bem.MediaCellIconWrapper__icon = bem.MediaCellIconWrapper.__('icon', '<i>');

/**
 * Backend stored media attachment
 *
 * @namespace mediaAttachment
 * @prop {string} download_url - full file size
 * @prop {string} download_small_url - smallest file size
 * @prop {string} download_medium_url
 * @prop {string} download_large_url
 */

/**
 * Table cell replacement for media submissions
 *
 * @prop {string} questionType
 * @prop {mediaAttachment} mediaAttachment - `null` for text questions
 * @prop {string} mediaName - Backend stored media attachment file name or the
                              content of a text question
 * @prop {string} submissionIndex - Index of the submission for text questions
 * @prop {string} submissionTotal - Total submissions for text questions
 */
class MediaCell extends React.Component {
  constructor(props) {
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
      case META_QUESTION_TYPES['background-audio']:
        iconClassNames.push('k-icon-qt-audio');
        break;
      case QUESTION_TYPES.video.id:
        iconClassNames.push('k-icon-qt-video');
        break;
      case QUESTION_TYPES.text.id:
        iconClassNames.push('k-icon-question');
        break;
      default:
        iconClassNames.push('k-icon-media-files');
        break;
    }

    return iconClassNames.join(' ');
  }

  launchMediaModal(evt) {
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
    questionIcon,
    mediaURL,
    mediaName,
    submissionIndex,
    submissionTotal,
  ) {
    let titleText = null;

    // mediaURL only exists if there are attachments, otherwise assume only text
    if (mediaURL) {
      titleText = truncateString(mediaName, 30);
    } else {
      titleText = t('Submission ##submissionIndex## of ##submissionTotal##')
        .replace('##submissionIndex##', submissionIndex)
        .replace('##submissionTotal##', submissionTotal);
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
          {this.props.mediaURL &&
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

          {/*
            TODO: Uncomment this buttton after single processing view is done

            <a
              className='kobo-light-button kobo-light-button--gray'
              href={'#'}
            >
              {t('process')}

              <i className='k-icon k-icon-arrow-up-right'/>
            </a>
          */}
        </bem.TableMediaPreviewHeader__options>
      </bem.TableMediaPreviewHeader>
    );
  }

  render() {
    const isTextQuestion = !this.props.mediaAttachment;

    return (
      <bem.MediaCell m={isTextQuestion ? 'text' : ''}>
        <bem.MediaCellIconWrapper>
          <bem.MediaCellIconWrapper__icon
            className={this.questionIcon}
            onClick={this.launchMediaModal.bind(this)}
          />
        </bem.MediaCellIconWrapper>

        {isTextQuestion &&
          // Show text as well if text question
          <bem.MediaCell__text className='trimmed-text'>
            {this.props.mediaName}
          </bem.MediaCell__text>
        }

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
