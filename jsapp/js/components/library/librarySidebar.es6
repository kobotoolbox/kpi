import React from 'react';
import Reflux from 'reflux';
import reactMixin from 'react-mixin';
import PropTypes from 'prop-types';
import autoBind from 'react-autobind';
import {stores} from 'js/stores';
import sessionStore from 'js/stores/session';
import bem from 'js/bem';
import {MODAL_TYPES} from 'js/constants';
import myLibraryStore from './myLibraryStore';
import { routerIsActive } from '../../router/legacy';
import {NavLink} from 'react-router-dom';

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
    return routerIsActive('library/my-library');
  }

  isPublicCollectionsSelected() {
    return routerIsActive('library/public-collections');
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
          disabled={!sessionStore.isLoggedIn}
          onClick={this.showLibraryNewModal}
        >
          {t('new')}
        </bem.KoboButton>

        <bem.FormSidebar m={sidebarModifier}>
          <NavLink
            className='form-sidebar__navlink'
            to='/library/my-library'
          >
            <bem.FormSidebar__label
              m={{selected: this.isMyLibrarySelected()}}
            >
              <i className='k-icon k-icon-library'/>
              <bem.FormSidebar__labelText>{t('My Library')}</bem.FormSidebar__labelText>
              <bem.FormSidebar__labelCount>{this.state.myLibraryCount}</bem.FormSidebar__labelCount>
            </bem.FormSidebar__label>
          </NavLink>

          <NavLink
            className='form-sidebar__navlink'
            to='/library/public-collections'
          >
            <bem.FormSidebar__label
              m={{selected: this.isPublicCollectionsSelected()}}
            >
              <i className='k-icon k-icon-library-public'/>
              <bem.FormSidebar__labelText>{t('Public Collections')}</bem.FormSidebar__labelText>
            </bem.FormSidebar__label>
          </NavLink>
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
