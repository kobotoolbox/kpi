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
          <img src={this.props?.mediaURL}/>
        );
      case QUESTION_TYPES.audio.id:
      case META_QUESTION_TYPES['background-audio']:
        return (
          <label>{this.props.questionType}</label>
        );
      case QUESTION_TYPES.video.id:
        return (
          <label>{this.props.questionType}</label>
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
    console.log(this.props);
    return (
      <div>
        {this.props.questionType && this.renderPreviewByType()}
      </div>
    );
  }
}

export default TableMediaPreview;
