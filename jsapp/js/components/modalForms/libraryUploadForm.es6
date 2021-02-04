import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import Dropzone from 'react-dropzone';
import {bem} from 'js/bem';
import {stores} from 'js/stores';
import mixins from 'js/mixins';
import {
  renderLoading,
  renderBackButton
} from './modalHelpers';
import {validFileTypes} from 'utils';

class LibraryUploadForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isSessionLoaded: !!stores.session.currentAccount,
      isPending: false
    };

    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(stores.session, () => {
      this.setState({isSessionLoaded: true});
    });
  }

  onFileDrop(files, rejectedFiles, evt) {
    this.setState({isPending: true});
    this.dropFiles(files, rejectedFiles, evt);
  }

  render() {
    if (!this.state.isSessionLoaded) {
      return renderLoading();
    }

    return (
      <bem.FormModal__form className='project-settings project-settings--upload-file'>
        <bem.Modal__subheader>
          {t('Import an XLSForm from your computer.')}
        </bem.Modal__subheader>

        {!this.state.isPending &&
          <Dropzone
            onDrop={this.onFileDrop.bind(this)}
            multiple={false}
            className='dropzone'
            activeClassName='dropzone-active'
            rejectClassName='dropzone-reject'
            accept={validFileTypes()}
          >
            <i className='k-icon-xls-file' />
            {t(' Drag and drop the XLSForm file here or click to browse')}
          </Dropzone>
        }
        {this.state.isPending &&
          <div className='dropzone'>
            {renderLoading(t('Uploading file…'))}
          </div>
        }

        <bem.Modal__footer>
          {renderBackButton(this.state.isPending)}
        </bem.Modal__footer>
      </bem.FormModal__form>
    );
  }
}

reactMixin(LibraryUploadForm.prototype, Reflux.ListenerMixin);
reactMixin(LibraryUploadForm.prototype, mixins.droppable);
LibraryUploadForm.contextTypes = {
  router: PropTypes.object
};

export default LibraryUploadForm;
