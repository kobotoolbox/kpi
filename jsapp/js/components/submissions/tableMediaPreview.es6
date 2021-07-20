import autoBind from 'react-autobind';
import React from 'react';

import {bem} from 'js/bem';
import AudioPlayer from 'js/components/common/audioPlayer';
import {
  QUESTION_TYPES,
  META_QUESTION_TYPES,
} from 'js/constants';

bem.TableMediaPreview = bem('table-media-preview');
bem.TableMediaPreview__image = bem.TableMediaPreview.__('image', '<img>');
bem.TableMediaPreview__audio = bem.TableMediaPreview.__('audio', '<div>');
bem.TableMediaPreview__video = bem.TableMediaPreview.__('video', '<video>');


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
            src={this.props?.mediaURL}
          />
        );
      case QUESTION_TYPES.audio.id:
      case META_QUESTION_TYPES['background-audio']:
        return (
          <bem.TableMediaPreview__audio>
            {/*// TODO: Change this icon to file_audio.svg*/}
            <i className='k-icon k-icon-file-audio'/>

            <AudioPlayer
              mediaURL={this.props?.mediaURL}
            />
          </bem.TableMediaPreview__audio>
        );
      case QUESTION_TYPES.video.id:
        return (
          <bem.TableMediaPreview__video
            src={this.props?.mediaURL}
            controls
            autoPlay
          />
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
