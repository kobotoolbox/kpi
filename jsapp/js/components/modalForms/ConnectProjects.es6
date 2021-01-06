import React from 'react';
import autoBind from 'react-autobind';
import alertify from 'alertifyjs';
import Dropzone from 'react-dropzone';
import TextBox from '../textBox';
import {actions} from '../../actions';
import {bem} from 'js/bem';

/*
 * Modal for uploading form media
 */
class ConnectProjects extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isVirgin: true,
      isLoading: false,
    };

    autoBind(this);
  }

  /*
   * setup
   */

  componentDidMount() {
    // TODO actions
  }

  /*
   * action listeners
   */

  /*
   * Utilities
   */

  /*
   * rendering
   */

  renderLoading(message = t('loading…')) {
    return (
      <bem.Loading>
        <bem.Loading__inner>
          <i />
          {message}
        </bem.Loading__inner>
      </bem.Loading>
    );
  }

  render() {
    return (
      <bem.FormModal__form className='project-settings project-settings--upload-file media-settings--upload-file' onSubmit={this.onSubmitURL}>
	    <div className='form-media__upload'>
        <p>dynamic data attachments</p>
      </div>
      </bem.FormModal__form>
    );
  }
}

export default ConnectProjects;
