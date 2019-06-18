import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import bem from 'js/bem';
import stores from 'js/stores';
import {hashHistory} from 'react-router';
import {t} from 'js/utils';
import {MODAL_TYPES} from 'js/constants';

class LibraryNewItemForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isSessionLoaded: !!stores.session.currentAccount
    };

    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(stores.session, () => {
      this.setState({isSessionLoaded: true});
    });
  }

  goToAssetCreator() {
    stores.pageState.hideModal();
    hashHistory.push('/library/new-asset');
  }

  goToCollection() {
    stores.pageState.switchModal({
      type: MODAL_TYPES.LIBRARY_COLLECTION
    });
  }

  goToTemplate() {
    stores.pageState.switchModal({
      type: MODAL_TYPES.LIBRARY_TEMPLATE
    });
  }

  goToUpload() {
    stores.pageState.switchModal({
      type: MODAL_TYPES.LIBRARY_UPLOAD
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
      <bem.FormModal__form className='project-settings project-settings--form-source'>
        <bem.FormModal__item m='form-source-buttons'>
          <button onClick={this.goToAssetCreator}>
            <i className='k-icon-question' />
            {t('Question Block')}
          </button>

          <button onClick={this.goToTemplate}>
            <i className='k-icon-template' />
            {t('Template')}
          </button>

          <button onClick={this.goToUpload}>
            <i className='k-icon-upload' />
            {t('Upload')}
          </button>

          <button onClick={this.goToCollection}>
            <i className='k-icon-folder' />
            {t('Collection')}
          </button>
        </bem.FormModal__item>
      </bem.FormModal__form>
    );
  }
}

reactMixin(LibraryNewItemForm.prototype, Reflux.ListenerMixin);

LibraryNewItemForm.contextTypes = {
  router: PropTypes.object
};

export default LibraryNewItemForm;
