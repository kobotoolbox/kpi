import React from 'react';
import sessionStore from 'js/stores/session';
import bem from 'js/bem';
import {MODAL_TYPES} from 'js/constants';
import myLibraryStore from './myLibraryStore';
import {routerIsActive} from 'js/router/legacy';
import {ROUTES} from 'js/router/routerConstants';
import {NavLink} from 'react-router-dom';
import Button from 'js/components/common/button';
import pageState from 'js/pageState.store';

interface LibrarySidebarState {
  myLibraryCount: number | null;
  isLoading: boolean;
}

/**
 * Displays "NEW" button (for adding a Library item) and two navigation links
 * pointing to "My Library" and "Public Collections".
 */
export default class LibrarySidebar extends React.Component<
  {},
  LibrarySidebarState
> {
  state = {
    myLibraryCount: 0,
    isLoading: true,
  }

  componentDidMount() {
    myLibraryStore.listen(this.myLibraryStoreChanged.bind(this), this);
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

  showLibraryNewModal(evt: React.TouchEvent<HTMLButtonElement>) {
    evt.preventDefault();
    pageState.showModal({
      type: MODAL_TYPES.LIBRARY_NEW_ITEM
    });
  }

  render() {
    let sidebarModifier = '';
    if (this.state.isLoading) {
      sidebarModifier = 'loading';
    }

    return (
      <>
        <Button
          type='primary'
          size='l'
          isFullWidth
          isUpperCase
          isDisabled={!sessionStore.isLoggedIn}
          onClick={this.showLibraryNewModal.bind(this)}
          label={t('new')}
        />

        <bem.FormSidebar m={sidebarModifier}>
          <NavLink
            className='form-sidebar__navlink'
            to='/library/my-library'
          >
            <bem.FormSidebar__label
              m={{selected: routerIsActive(ROUTES.MY_LIBRARY)}}
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
              m={{selected: routerIsActive(ROUTES.PUBLIC_COLLECTIONS)}}
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
