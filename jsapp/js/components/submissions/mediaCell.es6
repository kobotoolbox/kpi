import autoBind from 'react-autobind';
import React from 'react';
import {bem} from 'js/bem';
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

bem.MediaCell = bem('media-cell');
bem.MediaCell__icon = bem.MediaCell.__('icon', '<i>');
bem.MediaCell__duration = bem.MediaCell.__('duration', '<label>');


/**
 * Table cell replacement for media submissions
 *
 * @prop {string} questionType
 * @prop {string} mediaURL - Backend stored media attachment URL
 * @prop {string} mediaName - Backend stored media attachment file name
 * @prop {string} textContent - Content of a text question
 */
class MediaCell extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }

  launchMediaModal(questionType, questionIcon, mediaURL, mediaName) {
    stores.pageState.showModal({
      type: MODAL_TYPES.TABLE_MEDIA_PREVIEW,
      questionType: questionType,
      mediaURL: mediaURL,
      mediaName: mediaName,
      customModalHeader: this.renderMediaModalCustomHeader(
        questionIcon,
        mediaURL,
        mediaName
      ),
    });
  }

  renderMediaModalCustomHeader(questionIcon, mediaURL, mediaName) {
    const truncatedFileName = truncateString(mediaName, 50);
    return (
      <bem.TableMediaPreviewHeader>
        <bem.TableMediaPreviewHeader__title>
          <i className={questionIcon.join(' ')}/>
          <bem.TableMediaPreviewHeader__label
            // Give the user a way to see the full file name
            title={mediaName}
          >
            {mediaURL ? truncatedFileName : t('TODO!!')}
          </bem.TableMediaPreviewHeader__label>
        </bem.TableMediaPreviewHeader__title>

        {this.props.mediaURL &&
          // TODO: this doesn't start a `save as` but instead opens media in tab
          <a
            className='kobo-light-button kobo-light-button--blue'
            href={mediaURL}
            download=''
          >
            {t('download')}
            <i className='k-icon k-icon-download'/>
          </a>
        }

        <a
          className='kobo-light-button kobo-light-button--gray'
          // TODO: point this to submissoin processing modal
          href={'#'}
          download=''
        >
          {t('process')}
          {/*TODO: Change this to arrow top right(?)*/}
          <i className='k-icon k-icon-arrow-up'/>
        </a>
      </bem.TableMediaPreviewHeader>
    );
  }

  render() {
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

    return (
      <bem.MediaCell>
        <bem.MediaCell__icon
          className={iconClassNames}
          title={this.props.mediaName}
          onClick={() =>
            this.launchMediaModal(
              this.props.questionType,
              iconClassNames,
              this.props.mediaURL,
              this.props.mediaName,
            )
          }
        />

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
