import autoBind from 'react-autobind';
import React from 'react';

import {bem} from 'js/bem';
import {
  QUESTION_TYPES,
  META_QUESTION_TYPES,
} from 'js/constants';


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
          <img
            className='table-media-preview__image'
            src={this.props?.mediaURL}
          />
        );
      case QUESTION_TYPES.audio.id:
      case META_QUESTION_TYPES['background-audio']:
        return (
          <audio
            className='table-media-preview__audio'
            src={this.props?.mediaURL}
            controls
          />
        );
      case QUESTION_TYPES.video.id:
        return (
          <video
            className='table-media-preview__video'
            src={this.props?.mediaURL}
            controls
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
      <div className='table-media-preview'>
        {this.props.questionType && this.renderPreviewByType()}
      </div>
    );
  }
}

export default TableMediaPreview;
