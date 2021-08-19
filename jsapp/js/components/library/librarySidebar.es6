import React from 'react';
import Reflux from 'reflux';
import reactMixin from 'react-mixin';
import PropTypes from 'prop-types';
import autoBind from 'react-autobind';
import {stores} from 'js/stores';
import bem from 'js/bem';
import {MODAL_TYPES} from 'js/constants';
import myLibraryStore from './myLibraryStore';

class LibrarySidebar extends Reflux.Component {
  constructor(props){
    super(props);
    this.state = {
      myLibraryCount: 0,
      isLoading: true
    };
    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(myLibraryStore, this.myLibraryStoreChanged);
    this.setState({
      isLoading: false,
      myLibraryCount: myLibraryStore.getCurrentUserTotalAssets()
    });
  }

  myLibraryStoreChanged() {
    this.setState({
      isLoading: false,
      myLibraryCount: myLibraryStore.getCurrentUserTotalAssets()
    });
  }

  showLibraryNewModal(evt) {
    evt.preventDefault();
    stores.pageState.showModal({
      type: MODAL_TYPES.LIBRARY_NEW_ITEM
    });
  }

  isMyLibrarySelected() {
    return this.context.router.isActive('library/my-library');
  }

  isPublicCollectionsSelected() {
    return this.context.router.isActive('library/public-collections');
  }

  render() {
    let sidebarModifier = '';
    if (this.state.isLoading) {
      sidebarModifier = 'loading';
    }

    return (
      <React.Fragment>
        <bem.KoboButton
          m={['blue', 'fullwidth']}
          disabled={!stores.session.isLoggedIn}
          onClick={this.showLibraryNewModal}
        >
          {t('new')}
        </bem.KoboButton>

        <bem.FormSidebar m={sidebarModifier}>
          <bem.FormSidebar__label
            m={{selected: this.isMyLibrarySelected()}}
            href='#/library/my-library'
          >
            <i className='k-icon k-icon-library'/>
            <bem.FormSidebar__labelText>{t('My Library')}</bem.FormSidebar__labelText>
            <bem.FormSidebar__labelCount>{this.state.myLibraryCount}</bem.FormSidebar__labelCount>
          </bem.FormSidebar__label>

          <bem.FormSidebar__label
            m={{selected: this.isPublicCollectionsSelected()}}
            href='#/library/public-collections'
          >
            <i className='k-icon k-icon-library-public'/>
            <bem.FormSidebar__labelText>{t('Public Collections')}</bem.FormSidebar__labelText>
          </bem.FormSidebar__label>
        </bem.FormSidebar>
      </React.Fragment>
    );
  }
}

LibrarySidebar.contextTypes = {
  router: PropTypes.object
};

reactMixin(LibrarySidebar.prototype, Reflux.ListenerMixin);

export default LibrarySidebar;
