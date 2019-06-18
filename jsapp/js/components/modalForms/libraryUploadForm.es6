import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import alertify from 'alertifyjs';
import Select from 'react-select';
import Dropzone from 'react-dropzone';
import TextBox from 'js/components/textBox';
import LibraryTemplateForm from './libraryTemplateForm';
import LibraryCollectionForm from './libraryCollectionForm';
import Checkbox from 'js/components/checkbox';
import bem from 'js/bem';
import TextareaAutosize from 'react-autosize-textarea';
import stores from 'js/stores';
import {hashHistory} from 'react-router';
import mixins from 'js/mixins';
import TemplatesList from 'js/components/templatesList';
import actions from 'js/actions';
import {dataInterface} from 'js/dataInterface';
import {
  t,
  validFileTypes,
  isAValidUrl,
  escapeHtml
} from 'js/utils';
import {MODAL_TYPES} from 'js/constants';

class LibraryUploadForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isSessionLoaded: !!stores.session.currentAccount,
      isUploadPending: false
    };

    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(stores.session, () => {
      this.setState({isSessionLoaded: true});
    });
  }

  onFileDrop() {}

  goBack() {
    stores.pageState.switchModal({
      type: MODAL_TYPES.LIBRARY_NEW_ITEM
    });
  }

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
    if (!this.state.isSessionLoaded) {
      return this.renderLoading();
    }

    return (
      <bem.FormModal__form className='project-settings project-settings--upload-file'>
        <bem.Modal__subheader>
          {t('Import an XLSForm from your computer.')}
        </bem.Modal__subheader>

        {!this.state.isUploadPending &&
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
        {this.state.isUploadPending &&
          <div className='dropzone'>
            {this.renderLoading(t('Uploading file…'))}
          </div>
        }

        <bem.Modal__footer>
          <bem.Modal__footerButton
            m='back'
            type='button'
            onClick={this.goBack}
            disabled={this.state.isPending}
          >
            {t('Back')}
          </bem.Modal__footerButton>
        </bem.Modal__footer>
      </bem.FormModal__form>
    );
  }
}

reactMixin(LibraryUploadForm.prototype, Reflux.ListenerMixin);
reactMixin(LibraryUploadForm.prototype, mixins.droppable);
reactMixin(LibraryUploadForm.prototype, mixins.dmix);

LibraryUploadForm.contextTypes = {
  router: PropTypes.object
};

export default LibraryUploadForm;
