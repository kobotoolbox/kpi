import React from 'react';
import ReactDOM from 'react-dom';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import Select from 'react-select';
import Checkbox from 'js/components/common/checkbox';
import bem from 'js/bem';
import {actions} from '../actions';
import {searches} from '../searches';
import {stores} from '../stores';
import {
  ASSET_TYPES,
  ACCESS_TYPES,
} from 'js/constants';

export class ListSearch extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(this.searchStore, this.searchStoreChanged);
  }

  searchStoreChanged(searchStoreState) {
    if (searchStoreState.cleared) {
      this.setValue('');
    }
    this.setState(searchStoreState);
  }

  /**
   * NOTE: this is used outside the component
   */
  getValue() {
    return ReactDOM.findDOMNode(this.refs['formlist-search']).value;
  }

  setValue(v) {
    ReactDOM.findDOMNode(this.refs['formlist-search']).value = v;
  }

  render() {
    return (
      <bem.Search m={[this.state.searchState]} >
        <bem.Search__icon className='k-icon k-icon-search'/>
        <bem.SearchInput
          type='text'
          ref='formlist-search'
          onChange={this.searchChangeEvent}
          placeholder={this.props.placeholderText}
        />

        {this.state.searchState !== 'none' &&
          <bem.Search__cancel
            className='k-icon k-icon-close'
            onClick={this.searchClear}
          />
        }
      </bem.Search>
    );
  }
}

ListSearch.defaultProps = {
  searchContext: 'default',
  placeholderText: t('Search...'),
};

reactMixin(ListSearch.prototype, searches.common);
reactMixin(ListSearch.prototype, Reflux.ListenerMixin);

export class ListTagFilter extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      availableTags: [],
      tagsLoaded: false,
    };
    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(stores.tags, this.tagsLoaded);
    this.listenTo(this.searchStore, this.searchStoreChanged);
    actions.resources.listTags(this.searchStore.filterTagQueryData);
  }

  searchStoreChanged(searchStoreState) {
    if (searchStoreState.cleared) {
      // re-render to remove tags if the search was cleared
      this.setState(searchStoreState);
    } else if (searchStoreState.searchTags) {
      let tags = null;
      if (searchStoreState.searchTags.length !== 0) {
        tags = searchStoreState.searchTags;
      }
      this.setState({selectedTags: tags});
    }
  }

  tagsLoaded(tags) {
    this.setState({
      tagsLoaded: true,
      availableTags: tags.map((tag) => ({
        label: tag.name,
        value: tag.name.replace(/\s/g, '-'),
      })),
      selectedTags: null,
    });
  }

  onTagsChange(tagsList) {
    this.searchTagsChange(tagsList);
  }

  render() {
    return (
      <bem.tagSelect>
        <Select
          name='tags'
          isMulti
          isLoading={!this.state.tagsLoaded}
          loadingMessage={t('Tags are loading...')}
          placeholder={t('Search Tags')}
          noOptionsMessage={t('No results found')}
          options={this.state.availableTags}
          onChange={this.onTagsChange}
          className={[this.props.hidden ? 'hidden' : null, 'kobo-select'].join(' ')}
          classNamePrefix='kobo-select'
          value={this.state.selectedTags}
          menuPlacement='auto'
        />
      </bem.tagSelect>
    );
  }
}

ListTagFilter.defaultProps = {
  searchContext: 'default',
  hidden: false,
};

reactMixin(ListTagFilter.prototype, searches.common);
reactMixin(ListTagFilter.prototype, Reflux.ListenerMixin);

export class ListCollectionFilter extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      availableCollections: [],
      collectionsLoaded: false,
    };
    this.unlisteners = [];
    autoBind(this);
  }

  componentDidMount() {
    this.unlisteners.push(
      actions.library.getCollections.completed.listen(this.onGetCollectionsCompleted)
    );
    this.queryCollections();
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  onGetCollectionsCompleted(collections) {
    const availableCollections = collections.results.filter((value) => (
      value.access_types &&
      (
        // NOTE: asset can have multiple access types, e.g. "public" and "subscribed",
        // so we need to check for each allowed one here
        value.access_types.includes(ACCESS_TYPES.owned) ||
        value.access_types.includes(ACCESS_TYPES.shared) ||
        value.access_types.includes(ACCESS_TYPES.subscribed) ||
        value.access_types.includes(ACCESS_TYPES.superuser)
      )
    ));

    this.setState({
      collectionsLoaded: true,
      availableCollections: availableCollections.map((collection) => {
        return {
          label: collection.name,
          value: collection.uid,
        };
      }),
      selectedCollection: false,
    });
  }

  queryCollections() {
    actions.library.getCollections();
  }

  onCollectionChange(evt) {
    if (evt) {
      this.searchCollectionChange(evt.value);
      this.setState({selectedCollection: evt});
    } else {
      this.searchClear();
      this.setState({selectedCollection: false});
    }
  }

  render() {
    return (
      <bem.collectionFilter>
        <Select
          name='collections'
          placeholder={t('Select Collection Name')}
          isClearable
          isLoading={!this.state.collectionsLoaded}
          loadingMessage={t('Collections are loading...')}
          options={this.state.availableCollections}
          onChange={this.onCollectionChange}
          value={this.state.selectedCollection}
          className='kobo-select'
          classNamePrefix='kobo-select'
          menuPlacement='auto'
        />
      </bem.collectionFilter>
    );
  }
}

ListCollectionFilter.defaultProps = {
  searchContext: 'default',
};

reactMixin(ListCollectionFilter.prototype, searches.common);
reactMixin(ListCollectionFilter.prototype, Reflux.ListenerMixin);

/**
 * Component used in Form Builder's aside library search.
 */
export class ListExpandToggle extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      assetNavExpanded: stores.pageState.state.assetNavExpanded,
    };
    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(this.searchStore, this.searchStoreChanged);
  }

  searchStoreChanged(searchStoreState) {
    this.setState(searchStoreState);
  }

  onExpandedToggleChange(isChecked) {
    stores.pageState.setState({assetNavExpanded: isChecked});
    this.setState({assetNavExpanded: isChecked});
  }

  render() {
    let list = [];
    const isSearch = this.state.searchResultsDisplayed;

    if (isSearch && Array.isArray(this.state.searchResultsList)) {
      list = this.state.searchResultsList;
    } else if (Array.isArray(this.state.defaultQueryResultsList)) {
      list = this.state.defaultQueryResultsList;
    }

    // Make sure the list contains only actual library items before diplaying the count.
    list = list.filter((item) => (
      item.asset_type === ASSET_TYPES.question.id ||
      item.asset_type === ASSET_TYPES.block.id
    ));

    return (
      <bem.LibNav__expanded className={{hidden: this.props.hidden}}>
        <bem.LibNav__count>
          {list.length} {t('assets found')}
        </bem.LibNav__count>
        <bem.LibNav__expandedToggle>
          <Checkbox
            checked={this.state.assetNavExpanded}
            onChange={this.onExpandedToggleChange}
            label={t('expand details')}
          />
        </bem.LibNav__expandedToggle>
      </bem.LibNav__expanded>
      );
  }
}

ListExpandToggle.defaultProps = {
  searchContext: 'default',
  hidden: false,
};

reactMixin(ListExpandToggle.prototype, searches.common);
reactMixin(ListExpandToggle.prototype, Reflux.ListenerMixin);

export const list = {
  // List: List,
  ListSearch: ListSearch,
  ListTagFilter: ListTagFilter,
  ListCollectionFilter: ListCollectionFilter,
  ListExpandToggle: ListExpandToggle,
};
