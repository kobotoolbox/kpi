import React from 'react';
import PropTypes from 'prop-types';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import {dataInterface} from '../dataInterface';
import stores from '../stores';
import bem from '../bem';
import {MODAL_TYPES} from '../constants';
import {t} from 'js/utils';
import {getAssetIcon} from 'js/assetUtils';

class LibrarySidebar extends Reflux.Component {
  constructor(props){
    super(props);
    this.state = {
      isLoading: true,
      myCollections: [],
      sharedCollections: [],
      publicCollections: []
    };
    autoBind(this);
  }

  queryCollections() {
    dataInterface.listCollections().then((collections) => {
      this.setState({
        isLoading: false,
        myCollections: collections.results.filter((value) => {
          return value.access_type === 'owned';
        }),
        sharedCollections: collections.results.filter((value) => {
          return value.access_type === 'shared';
        }),
        publicCollections: collections.results.filter((value) => {
          return (
            value.access_type === 'public' || value.access_type === 'subscribed'
          );
        })
      });
    });
  }

  componentDidMount() {
    this.queryCollections();
  }

  showLibraryNewModal(evt) {
    evt.preventDefault();
    stores.pageState.showModal({
      type: MODAL_TYPES.LIBRARY_NEW_ITEM
    });
  }

  renderCollection(collection) {
    const iconClass = getAssetIcon(collection);

    const modifiers = ['collection'];
    if (this.isCollectionSelected(collection.uid)) {
      modifiers.push('selected');
    }

    return (
      <bem.FormSidebar__item
        key={collection.uid}
        m={modifiers}
        href={`#/library/collection/${collection.uid}`}
      >
        <i className={iconClass}/>
        <bem.FormSidebar__itemText>{collection.name}</bem.FormSidebar__itemText>
      </bem.FormSidebar__item>
    );
  }

  isCollectionSelected(uid) {
    return (
      this.context.router &&
      this.context.router.params &&
      this.context.router.params.uid === uid
    );
  }

  isMyCollectionsSelected() {
    return this.context.router.isActive('library/owned');
  }

  isSharedCollectionsSelected() {
    return this.context.router.isActive('library/shared');
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
        <button
          onClick={this.showLibraryNewModal}
          className='mdl-button mdl-button--raised mdl-button--colored'
        >
          {t('new')}
        </button>

        <bem.FormSidebar m={sidebarModifier}>
          <bem.FormSidebar__label
            m={{selected: this.isMyCollectionsSelected()}}
            href='#/library/owned'
          >
            <i className='k-icon-library'/>
            <bem.FormSidebar__labelText>{t('My Library')}</bem.FormSidebar__labelText>
            <bem.FormSidebar__labelCount>{this.state.myCollections.length}</bem.FormSidebar__labelCount>
          </bem.FormSidebar__label>

          {this.state.myCollections.length > 0 &&
            <bem.FormSidebar__grouping>
              {this.state.myCollections.map(this.renderCollection)}
            </bem.FormSidebar__grouping>
          }

          <bem.FormSidebar__label
            m={{selected: this.isSharedCollectionsSelected()}}
            href='#/library/shared'
          >
            <i className='k-icon-library-shared'/>
            <bem.FormSidebar__labelText>{t('Shared with me')}</bem.FormSidebar__labelText>
            <bem.FormSidebar__labelCount>{this.state.sharedCollections.length}</bem.FormSidebar__labelCount>
          </bem.FormSidebar__label>

          {this.state.sharedCollections.length > 0 &&
            <bem.FormSidebar__grouping>
              {this.state.sharedCollections.map(this.renderCollection)}
            </bem.FormSidebar__grouping>
          }

          <bem.FormSidebar__label
            m={{selected: this.isPublicCollectionsSelected()}}
            href='#/library/public-collections'
          >
            <i className='k-icon-library-public'/>
            <bem.FormSidebar__labelText>{t('Public Collections')}</bem.FormSidebar__labelText>
            <bem.FormSidebar__labelCount>{this.state.publicCollections.length}</bem.FormSidebar__labelCount>
          </bem.FormSidebar__label>

          {this.state.publicCollections.length > 0 &&
            <bem.FormSidebar__grouping>
              {this.state.publicCollections.map(this.renderCollection)}
            </bem.FormSidebar__grouping>
          }
        </bem.FormSidebar>
      </React.Fragment>
    );
  }
}

LibrarySidebar.contextTypes = {
  router: PropTypes.object
};

export default LibrarySidebar;
