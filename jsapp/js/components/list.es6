import _ from 'underscore';
import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import Select from 'react-select';
import Checkbox from 'js/components/common/checkbox';
import ui from '../ui';
import {bem} from '../bem';
import {actions} from '../actions';
import {dataInterface} from '../dataInterface';
import {searches} from '../searches';
import {stores} from '../stores';
import {ACCESS_TYPES} from 'js/constants';

export class ListSearch extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    autoBind(this);
  }
  componentDidMount () {
    this.listenTo(this.searchStore, this.searchStoreChanged);
  }
  searchStoreChanged (searchStoreState) {
    if (searchStoreState.cleared) {
      this.refs['formlist-search'].setValue('');
    }
    this.setState(searchStoreState);
  }
  getValue() {
    return this.refs['formlist-search'].getValue();
  }
  render () {
    return (
      <bem.Search m={[this.state.searchState]} >
        <bem.Search__icon className='k-icon k-icon-search'/>
        <ui.SearchBox ref='formlist-search' placeholder={this.props.placeholderText} onChange={this.searchChangeEvent} />

        {this.state.searchState !== 'none' &&
          <bem.Search__cancel
            className='k-icon k-icon-close'
            onClick={this.searchClear}
          />
        }
      </bem.Search>
    );
  }
};

ListSearch.defaultProps = {
  searchContext: 'default',
  placeholderText: t('Search...')
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
  componentDidMount () {
    this.listenTo(stores.tags, this.tagsLoaded);
    this.listenTo(this.searchStore, this.searchStoreChanged);
    actions.resources.listTags(this.searchStore.filterTagQueryData);
  }
  searchStoreChanged (searchStoreState) {
    if (searchStoreState.cleared) {
      // re-render to remove tags if the search was cleared
      this.setState(searchStoreState);
    } else {
      if (searchStoreState.searchTags) {
        let tags = null;
        if (searchStoreState.searchTags.length !== 0) {
          tags = searchStoreState.searchTags;
        }
        this.setState({
          selectedTags: tags
        });
      }
    }

  }
  tagsLoaded (tags) {
    this.setState({
      tagsLoaded: true,
      availableTags: tags.map(function(tag){
        return {
          label: tag.name,
          value: tag.name.replace(/\s/g, '-'),
        };
      }),
      selectedTags: null
    });
  }
  onTagsChange (tagsList) {
    this.searchTagsChange(tagsList);
  }
  render () {
    return (
      <bem.tagSelect>
        <Select
          name='tags'
          isMulti
          isLoading={!this.state.tagsLoaded}
          loadingMessage={() => {return t('Tags are loading...')}}
          placeholder={t('Search Tags')}
          noOptionsMessage={() => {return t('No results found')}}
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
};

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
    autoBind(this);
  }
  componentDidMount () {
    this.queryCollections();
  }
  queryCollections () {
    dataInterface.getCollections().then((collections)=>{
      var availableCollections = collections.results.filter((value) => {
        return (
          value.access_types &&
          !value.access_types.includes(ACCESS_TYPES.public)
        );
      });

      this.setState({
        collectionsLoaded: true,
        availableCollections: availableCollections.map(function(collection){
          return {
            label: collection.name,
            value: collection.uid,
          };
        }),
        selectedCollection: false
      });

    });
  }
  onCollectionChange (evt) {
    if (evt) {
      this.searchCollectionChange(evt.value);
      this.setState({
        selectedCollection: evt
      });
    } else {
      this.searchClear();
      this.setState({
        selectedCollection: false
      });
    }
  }
  render () {
    return (
      <bem.collectionFilter>
        <Select
          name='collections'
          placeholder={t('Select Collection Name')}
          isClearable
          isLoading={!this.state.collectionsLoaded}
          loadingMessage={() => {return t('Collections are loading...');}}
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
};

ListCollectionFilter.defaultProps = {
  searchContext: 'default',
};

reactMixin(ListCollectionFilter.prototype, searches.common);
reactMixin(ListCollectionFilter.prototype, Reflux.ListenerMixin);

export class ListExpandToggle extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      assetNavExpanded: stores.pageState.state.assetNavExpanded
    };
    autoBind(this);
  }
  componentDidMount () {
    this.listenTo(this.searchStore, this.searchStoreChanged);
  }
  searchStoreChanged (searchStoreState) {
    this.setState(searchStoreState);
  }
  onExpandedToggleChange (isChecked) {
    stores.pageState.setState({assetNavExpanded: isChecked});
    this.setState({assetNavExpanded: isChecked});
  }
  render () {
    let count = this.state.defaultQueryCount;
    if (this.state.searchResultsDisplayed) {
      count = this.state.searchResultsCount;
    }

    return (
      <bem.LibNav__expanded className={{hidden: this.props.hidden}}>
        <bem.LibNav__count>
          {count} {t('assets found')}
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
};

ListExpandToggle.defaultProps = {
  searchContext: 'default',
  hidden: false,
};

reactMixin(ListExpandToggle.prototype, searches.common);
reactMixin(ListExpandToggle.prototype, Reflux.ListenerMixin);

export class ListSearchDebug extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    autoBind(this);
  }
  componentDidMount () {
    this.listenTo(this.searchStore, this.searchStoreChanged);
  }
  searchStoreChanged (searchStoreState) {
    this.setState(searchStoreState);
  }
  render () {
    var searchResultsSuccess = this.state.searchResultsSuccess,
        searchDebugQuery = this.state.searchDebugQuery;

    return (
            <bem.CollectionNav__searchcriteria>
              <bem.CollectionNav__searchcriterion m={{
                success: searchResultsSuccess
                  }}>
                {t('success')}
                {this.state.searchResultsSuccess ? t('yes') : t('no')}
              </bem.CollectionNav__searchcriterion>
              <bem.CollectionNav__searchcriterion>
                {t('count')}
                {this.state.searchResultsCount}
              </bem.CollectionNav__searchcriterion>
              { searchDebugQuery ?
                <bem.CollectionNav__searchcriterion m={'code'}>
                  {searchDebugQuery}
                </bem.CollectionNav__searchcriterion>
              : null}
            </bem.CollectionNav__searchcriteria>
        );
  }
};

ListSearchDebug.defaultProps = {
  searchContext: 'default',
};

reactMixin(ListSearchDebug.prototype, searches.common);
reactMixin(ListSearchDebug.prototype, Reflux.ListenerMixin);

export const list = {
  // List: List,
  ListSearch: ListSearch,
  ListSearchDebug: ListSearchDebug,
  ListTagFilter: ListTagFilter,
  ListCollectionFilter: ListCollectionFilter,
  ListExpandToggle: ListExpandToggle,
};
