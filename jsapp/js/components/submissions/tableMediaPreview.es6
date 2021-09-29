import autoBind from 'react-autobind';
import React from 'react';

import bem from 'js/bem';
import AudioPlayer from 'js/components/common/audioPlayer';
import {
  QUESTION_TYPES,
  META_QUESTION_TYPES,
} from 'js/constants';

bem.TableMediaPreview = bem('table-media-preview');
bem.TableMediaPreview__image = bem.TableMediaPreview.__('image', '<img>');
bem.TableMediaPreview__audio = bem.TableMediaPreview.__('audio', '<div>');
bem.TableMediaPreview__video = bem.TableMediaPreview.__('video', '<video>');
bem.TableMediaPreview__text = bem.TableMediaPreview.__('text', '<div>');

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
 */
class TableMediaPreview extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isLoading: false,
    };

    autoBind(this);
  }

  renderPreviewByType() {
    switch (this.props.questionType) {
      case QUESTION_TYPES.image.id:
        return (
          <bem.TableMediaPreview__image
            src={this.props?.mediaAttachment?.download_medium_url}
          />
        );
      case QUESTION_TYPES.audio.id:
      case META_QUESTION_TYPES['background-audio']:
        return (
          <bem.TableMediaPreview__audio>
            <i className='k-icon k-icon-file-audio' />

            <AudioPlayer mediaURL={this.props?.mediaAttachment?.download_url} />
          </bem.TableMediaPreview__audio>
        );
      case QUESTION_TYPES.video.id:
        return (
          <bem.TableMediaPreview__video
            src={this.props?.mediaAttachment?.download_url}
            controls
            autoPlay
          />
        );
      case QUESTION_TYPES.text.id:
        return (
          <bem.TableMediaPreview__text>
            {this.props.mediaName}
          </bem.TableMediaPreview__text>
        );
      default:
        return (
          <label>
            {t('Unsupported media type: ##QUESTION_TYPE##').replace(
              '##QUESTION_TYPE##',
              this.props.questionType
            )}
          </label>
        );
    }
  }

  render() {
    return (
      <bem.TableMediaPreview>
        {this.props.questionType && this.renderPreviewByType()}
      </bem.TableMediaPreview>
    );
  }
}

export default TableMediaPreview;
