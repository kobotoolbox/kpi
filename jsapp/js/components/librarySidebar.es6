import $ from 'jquery';
import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import {dataInterface} from '../dataInterface';
import stores from '../stores';
import bem from '../bem';
import searches from '../searches';
import mixins from '../mixins';
import {MODAL_TYPES} from '../constants';
import {
  t,
  assign,
  getAnonymousUserPermission
} from '../utils';

class LibrarySidebar extends Reflux.Component {
  constructor(props){
    super(props);
    this.state = assign({}, stores.pageState.state);
    this.stores = [
      stores.session,
      stores.pageState
    ];
    autoBind(this);
  }

  queryCollections() {
    dataInterface.listCollections().then((collections) => {
      this.setState({
        sidebarCollections: collections.results.filter((value) => {
          return value.access_type !== 'public';
        }),
        sidebarPublicCollections: collections.results.filter((value) => {
          return value.access_type === 'public' ||
            value.access_type === 'subscribed';
        })
      });
    });
  }

  componentDidMount() {
    this.listenTo(this.searchStore, this.searchChanged);
    this.searchDefault();
    this.queryCollections();
  }

  componentWillMount() {
    this.setStates();
  }

  searchChanged(state) {
    this.setState(state);
  }

  setStates() {
    this.setState({
      headerFilters: 'library',
      shadedWithMeVisible: false,
      sidebarSharedWithMe: [],
      publicCollectionsVisible: false,
      searchContext: searches.getSearchContext('library', {
        filterParams: {
          assetType: 'asset_type:question OR asset_type:block OR asset_type:template',
        },
        filterTags: 'asset_type:question OR asset_type:block OR asset_type:template',
      })
    });
  }

  clickFilterByCollection(evt) {
    var target = $(evt.target);
    if (target.hasClass('collection-toggle')) {
      return false;
    }
    var data = $(evt.currentTarget).data();
    var collectionUid = false;
    var collectionName = false;
    var publicCollection = false;
    if (data.collectionUid) {
      collectionUid = data.collectionUid;
    }
    if (data.collectionName) {
      collectionName = data.collectionName;
    }
    if (data.publicCollection) {
      publicCollection = true;
    }
    this.quietUpdateStore({
      parentUid: collectionUid,
      parentName: collectionName,
      allPublic: publicCollection
    });
    this.searchValue();
    this.setState({
      filteredCollectionUid: collectionUid,
      filteredByPublicCollection: publicCollection,
    });
  }

  clickShowPublicCollections() {
    this.setState({
      publicCollectionsVisible: !this.state.publicCollectionsVisible,
    });
    //TODO: show the collections in the main pane?
  }

  clickShowSharedWithMe() {
    this.setState({
      sharedWithMeVisible: !this.state.sharedWithMeVisible,
    });
  }

  isCollectionPublic(collection) {
    return typeof getAnonymousUserPermission(collection.permissions) !== 'undefined';
  }

  showLibraryNewModal(evt) {
    evt.preventDefault();
    stores.pageState.showModal({
      type: MODAL_TYPES.LIBRARY_NEW_ITEM
    });
  }

  renderSidebarItem(collection) {
    var iconClass = 'k-icon-folder';
    if (collection.discoverable_when_public || this.isCollectionPublic(collection)) {
      iconClass = 'k-icon-folder-public';
    }
    if (collection.access_type === 'shared') {
      iconClass = 'k-icon-folder-shared';
    }

    const modifiers = ['collection'];
    if (
      this.state.filteredCollectionUid === collection.uid &&
      !this.state.filteredByPublicCollection
    ) {
      modifiers.push('selected');
    }

    return (
      <bem.FormSidebar__item
        key={collection.uid}
        m={modifiers}
        href={`#/library/collection/${collection.uid}`}
        data-collection-uid={collection.uid}
        data-collection-name={collection.name}
      >
        <i className={iconClass}/>
        <bem.FormSidebar__itemText>{collection.name}</bem.FormSidebar__itemText>
      </bem.FormSidebar__item>
    );
  }

  render() {
    return (
      <React.Fragment>
        <button onClick={this.showLibraryNewModal} className='mdl-button mdl-button--raised mdl-button--colored'>
          {t('new')}
        </button>

        { this.state.sidebarCollections &&
          <bem.FormSidebar>
            <bem.FormSidebar__label
              m={{selected: !this.state.publicCollectionsVisible}}
              href='#/library/owned'
            >
              <i className='k-icon-library'/>
              {t('My Library')}
              <bem.FormSidebar__labelCount>
                {this.state.defaultQueryCount}
              </bem.FormSidebar__labelCount>
            </bem.FormSidebar__label>

            {this.state.sidebarCollections.length > 0 &&
              <bem.FormSidebar__grouping>
                {this.state.sidebarCollections.map(this.renderSidebarItem)}
              </bem.FormSidebar__grouping>
            }

            <bem.FormSidebar__label
              m={{selected: this.state.sharedWithMeVisible}}
              href='#/library/shared'
            >
              <i className='k-icon-library-shared'/>
              {t('Shared with me')}
              <bem.FormSidebar__labelCount>
                {this.state.sidebarSharedWithMe.length}
              </bem.FormSidebar__labelCount>
            </bem.FormSidebar__label>

            <bem.FormSidebar__label
              m={{selected: this.state.publicCollectionsVisible}}
              href='#/library/public-collections'
            >
              <i className='k-icon-library-public' />
              {t('Public Collections')}
              <bem.FormSidebar__labelCount>
                {this.state.sidebarPublicCollections.length}
              </bem.FormSidebar__labelCount>
            </bem.FormSidebar__label>

            <bem.FormSidebar__grouping m={[this.state.publicCollectionsVisible ? 'visible' : 'collapsed']}>
              {this.state.sidebarPublicCollections.map(this.renderSidebarItem)}
            </bem.FormSidebar__grouping>
          </bem.FormSidebar>
        }
      </React.Fragment>
      );
  }
  componentWillReceiveProps() {
    this.setStates();
  }
}

reactMixin(LibrarySidebar.prototype, searches.common);
reactMixin(LibrarySidebar.prototype, Reflux.ListenerMixin);
reactMixin(LibrarySidebar.prototype, mixins.droppable);

LibrarySidebar.contextTypes = {
  router: PropTypes.object
};

export default LibrarySidebar;
