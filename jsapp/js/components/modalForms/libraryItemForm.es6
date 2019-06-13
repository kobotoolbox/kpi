import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import alertify from 'alertifyjs';
import Select from 'react-select';
import Dropzone from 'react-dropzone';
import TextBox from 'js/components/textBox';
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
import {LIBRARY_ITEM_CONTEXTS} from 'js/constants';

/**
This is used for multiple different purposes:

1. When creating new library item
2. When editing template settings
3. When editing collection settings

Identifying the purpose is done by checking `context` and `libraryItem` props.
*/
class LibraryItemForm extends React.Component {
  constructor(props) {
    super(props);
    this.unlisteners = [];

    this.STEPS = new Map([
      ['start', 0],
      ['template', 1],
      ['upload', 2],
      ['collection', 3]
    ]);

    this.state = {
      isSessionLoaded: !!stores.session.currentAccount,
      isSubmitPending: false,
      // steps
      currentStep: null,
      previousStep: null,
      // template
      isCreatingTemplate: false,
      // collection
      isCreatingCollection: false,
      // upload
      isUploadFilePending: false
    };

    autoBind(this);
  }

  /*
   * setup
   */

  componentDidMount() {
    this.setInitialStep();
    this.listenTo(stores.session, () => {
      this.setState({isSessionLoaded: true});
    });
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  setInitialStep() {
    switch (this.props.context) {
      case LIBRARY_ITEM_CONTEXTS.NEW:
        return this.displayStep(this.STEPS.get('start'));
      case LIBRARY_ITEM_CONTEXTS.EXISTING_TEMPLATE:
        return this.displayStep(this.STEPS.get('template'));
      case LIBRARY_ITEM_CONTEXTS.EXISTING_COLLECTION:
        return this.displayStep(this.STEPS.get('collection'));
      default:
        throw new Error(`Unknown context: ${this.props.context}!`);
    }
  }

  getModalTitle(step) {
    if (this.props.context === LIBRARY_ITEM_CONTEXTS.NEW) {
      const base = t('Create Library Item');
      switch (step) {
        case this.STEPS.get('start'): return base;
        case this.STEPS.get('template'): return base + ': ' + t('Template details');
        case this.STEPS.get('upload'): return base + ': ' + t('Upload XLSForm');
        case this.STEPS.get('collection'): return base + ': ' + t('Collection details');
      }
    } else if (this.props.context === LIBRARY_ITEM_CONTEXTS.EXISTING_TEMPLATE) {
      return t('Edit template details');
    } else if (this.props.context === LIBRARY_ITEM_CONTEXTS.EXISTING_COLLECTION) {
      return t('Edit collection details');
    }
  }

  /*
   * routes navigation
   */

  goToAssetEditor(assetUid) {
    stores.pageState.hideModal();
    hashHistory.push(`/library/asset/${assetUid}/edit`);
  }

  goToAssetCreator() {
    stores.pageState.hideModal();
    hashHistory.push('/library/new-asset');
  }

  /*
   * modal steps navigation
   */

  displayStep(targetStep) {
    const currentStep = this.state.currentStep;
    const previousStep = this.state.previousStep;

    if (targetStep === currentStep) {
      return;
    } else if (targetStep === previousStep) {
      this.setState({
        currentStep: previousStep,
        previousStep: null
      });
    } else {
      this.setState({
        currentStep: targetStep,
        previousStep: currentStep
      });
    }

    if (this.props.onSetModalTitle) {
      this.props.onSetModalTitle(this.getModalTitle(targetStep));
    }
  }

  displayPreviousStep() {
    this.displayStep(this.state.previousStep);
  }

  /*
   * a
   */

  onFileDrop() {}

  /*
   * rendering
   */

  renderStepStart() {
    return (
      <bem.FormModal__form className='project-settings project-settings--form-source'>
        <bem.FormModal__item m='form-source-buttons'>
          <button onClick={this.goToAssetCreator}>
            <i className='k-icon-question' />
            {t('Question Block')}
          </button>

          <button onClick={this.displayStep.bind(this, this.STEPS.get('template'))}>
            <i className='k-icon-template' />
            {t('Template')}
          </button>

          <button onClick={this.displayStep.bind(this, this.STEPS.get('upload'))}>
            <i className='k-icon-upload' />
            {t('Upload')}
          </button>

          <button onClick={this.displayStep.bind(this, this.STEPS.get('collection'))}>
            <i className='k-icon-folder' />
            {t('Collection')}
          </button>
        </bem.FormModal__item>
      </bem.FormModal__form>
    );
  }

  renderStepTemplate() {
    return (
      <bem.FormModal__form className='project-settings'>
        {t('template')}

        <bem.Modal__footer>
          {this.renderBackButton()}

          <bem.Modal__footerButton
            m='primary'
            type='submit'
            onClick={this.createTemplate}
            disabled={!this.state.isCreatingTemplate}
            className='mdl-js-button'
          >
            {this.state.isCreatingTemplate ? t('Creating…') : t('Create')}
          </bem.Modal__footerButton>
        </bem.Modal__footer>
      </bem.FormModal__form>
    );
  }

  renderStepCollection() {
    return (
      <bem.FormModal__form className='project-settings'>
        {t('collection')}

        <bem.Modal__footer>
          {this.renderBackButton()}

          <bem.Modal__footerButton
            m='primary'
            type='submit'
            onClick={this.createCollection}
            disabled={!this.state.isCreatingCollection}
            className='mdl-js-button'
          >
            {this.state.isCreatingCollection ? t('Creating…') : t('Create')}
          </bem.Modal__footerButton>
        </bem.Modal__footer>
      </bem.FormModal__form>
    );
  }

  renderStepUpload() {
    return (
      <bem.FormModal__form className='project-settings project-settings--upload-file'>
        <bem.Modal__subheader>
          {t('Import an XLSForm from your computer.')}
        </bem.Modal__subheader>

        {!this.state.isUploadFilePending &&
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
        {this.state.isUploadFilePending &&
          <div className='dropzone'>
            {this.renderLoading(t('Uploading file…'))}
          </div>
        }

        <bem.Modal__footer>
          {this.renderBackButton()}
        </bem.Modal__footer>
      </bem.FormModal__form>
    );
  }

  renderBackButton() {
    if (this.state.previousStep !== null) {
      const isBackButtonDisabled = (
        this.state.isSubmitPending ||
        this.state.isCreatingTemplate ||
        this.state.isCreatingCollection ||
        this.state.isUploadFilePending
      );
      return (
        <bem.Modal__footerButton
          m='back'
          type='button'
          onClick={this.displayPreviousStep}
          disabled={isBackButtonDisabled}
        >
          {t('Back')}
        </bem.Modal__footerButton>
      );
    } else {
      return false;
    }
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
    if (!this.state.isSessionLoaded || this.state.currentStep === null) {
      return this.renderLoading();
    }

    switch (this.state.currentStep) {
      case this.STEPS.get('start'): return this.renderStepStart();
      case this.STEPS.get('template'): return this.renderStepTemplate();
      case this.STEPS.get('upload'): return this.renderStepUpload();
      case this.STEPS.get('collection'): return this.renderStepCollection();
      default:
        throw new Error(`Unknown step: ${this.state.currentStep}!`);
    }
  }
}

reactMixin(LibraryItemForm.prototype, Reflux.ListenerMixin);
reactMixin(LibraryItemForm.prototype, mixins.droppable);
reactMixin(LibraryItemForm.prototype, mixins.dmix);

LibraryItemForm.contextTypes = {
  router: PropTypes.object
};

export default LibraryItemForm;
