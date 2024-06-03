import React from 'react';
import {stores} from 'js/stores';
import sessionStore from 'js/stores/session';
import bem from 'js/bem';
import {MODAL_TYPES} from 'js/constants';
import myLibraryStore from './myLibraryStore';
import {routerIsActive} from 'js/router/legacy';
import {ROUTES} from 'js/router/routerConstants';
import {NavLink} from 'react-router-dom';

interface LibrarySidebarProps {}

interface LibrarySidebarState {
  myLibraryCount: number;
  isLoading: boolean;
}

/**
 * Displays "NEW" button (for adding a Library item) and two navigation links
 * pointing to "My Library" and "Public Collections".
 */
export default class LibrarySidebar extends React.Component<
  LibrarySidebarProps,
  LibrarySidebarState
> {
  constructor(props: LibrarySidebarProps) {
    super(props);
    this.state = {
      myLibraryCount: 0,
      isLoading: true
    };
  }

  componentDidMount() {
    myLibraryStore.listen(this.myLibraryStoreChanged.bind(this));
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
    return routerIsActive(ROUTES.MY_LIBRARY);
  }

  isPublicCollectionsSelected() {
    return routerIsActive(ROUTES.PUBLIC_COLLECTIONS);
  }

  render() {
    let sidebarModifier = '';
    if (this.state.isLoading) {
      sidebarModifier = 'loading';
    }

    return (
      <>
        <bem.KoboButton
          m={['blue', 'fullwidth']}
          disabled={!sessionStore.isLoggedIn}
          onClick={this.showLibraryNewModal.bind(this)}
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
      </>
    );
  }
}
