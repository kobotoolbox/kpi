import React from 'react';
import ReactDOM from 'react-dom';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import actions from '../actions';
import stores from '../stores';
import bem from '../bem';
import searches from '../searches';
import ui from '../ui';
import mixins from '../mixins';

import { t } from '../utils';

import {
  ListSearch,
  ListTagFilter,
  ListCollectionFilter,
  ListExpandToggle
} from '../components/list';

class AssetNavigatorListView extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    autoBind(this);
  }
  componentDidMount () {
    this.searchClear();
    this.listenTo(this.searchStore, this.searchStoreChanged);
  }
  componentWillReceiveProps () {
    this.searchClear();
    this.listenTo(this.searchStore, this.searchStoreChanged);
  }
  searchStoreChanged (searchStoreState) {
    this.setState(searchStoreState);
  }
  activateSortable() {
    if (!this.refs.liblist) {
      return;
    }

    var $el = $(ReactDOM.findDOMNode(this.refs.liblist));
    if ($el.hasClass('ui-sortable')) {
      $el.sortable('destroy');
    }
    $el.sortable({
      helper: 'clone',
      cursor: 'move',
      distance: 5,
      items: '> li',
      connectWith: '.survey-editor__list',
      opacity: 0.9,
      scroll: false,
      deactivate: ()=> {
        $el.sortable('cancel');
      }
    });
  }
  render () {
    var list,
        count,
        status,
        isSearch = this.state.searchResultsDisplayed;

    if (isSearch) {
      status = this.state.searchState;
      list = this.state.searchResultsList;
      count = this.state.searchResultsCount;
    } else {
      status = this.state.defaultQueryState;
      list = this.state.defaultQueryResultsList;
      count = this.state.defaultQueryCount;
    }


    if (status !== 'done') {
      return (
          <bem.LibList m={'empty'}>
            <bem.LibList__item m={'message'}>
              {t('loading')}
            </bem.LibList__item>
          </bem.LibList>
        );
    } else if (count === 0) {
      return (
          <bem.LibList m={'empty'}>
            <bem.LibList__item m={'message'}>
              {t('no search results found')}
            </bem.LibList__item>
          </bem.LibList>
        );
    } else {

      window.setTimeout(()=>{
        this.activateSortable();
      }, 1);

      return (
            <bem.LibList m={['done', isSearch ? 'search' : 'default']} ref="liblist">
              {list.map((item)=> {
                var modifiers = [item.asset_type];
                var summ = item.summary;
                if (summ.row_count == undefined) {
                	return false;
                }
                return (
                    <bem.LibList__item m={modifiers} key={item.uid} data-uid={item.uid}>
                      <bem.LibList__dragbox />
                      <bem.LibList__label m={'name'}>
                        <ui.AssetName {...item} />
                      </bem.LibList__label>
                      { item.asset_type === 'block' ?
                        <bem.LibList__qtype>
                          {t('block of ___ questions').replace('___', summ.row_count)}
                        </bem.LibList__qtype>
                      : null }
                      { (stores.pageState.state.assetNavExpanded && item.asset_type === 'block') ?
                        <ol>
                          {summ.labels.map(function(lbl, i){
                            return <li key={i}>{lbl}</li>;
                          })}
                        </ol>
                      : null }
                      { stores.pageState.state.assetNavExpanded ?
                        <bem.LibList__tags>
                          {(item.tags || []).map((tg, i)=>{
                            return <bem.LibList__tag key={i}>{tg}</bem.LibList__tag>;
                          })}
                        </bem.LibList__tags>
                      : null }
                    </bem.LibList__item>
                  );
              })}
            </bem.LibList>
        );
    }
  }
};

reactMixin(AssetNavigatorListView.prototype, searches.common);
reactMixin(AssetNavigatorListView.prototype, Reflux.ListenerMixin);

class AssetNavigator extends Reflux.Component {
  constructor(props) {
    super(props);
    this.state = {
      searchResults: {},
      imports: [],
      searchContext: searches.getSearchContext('library', {
        filterParams: {
          assetType: 'asset_type:question OR asset_type:block'
        }
      }),
      selectedTags: [],
      assetNavIntentOpen: stores.pageState.state.assetNavIntentOpen,
      assetNavIsOpen: stores.pageState.state.assetNavIsOpen
    };
    this.store = stores.tags;
    autoBind(this);
  }
  componentDidMount() {
    this.listenTo(stores.assetLibrary, this.assetLibraryTrigger);
    this.listenTo(stores.pageState, this.handlePageStateStore);
    this.state.searchContext.mixin.searchDefault();
  }
  filterSearchResults (results) {
    if (this.searchFieldValue() === results.query) {
      return results;
    }
  }
  assetLibraryTrigger (res) {
    this.setState({
      assetLibraryItems: res
    });
  }
  handlePageStateStore (state) {
    this.setState(state);
  }
  getImportsByStatus (n) {
    return this.imports.filter((i)=> i.status === n );
  }
  searchFieldValue () {
    return ReactDOM.findDOMNode(this.refs.navigatorSearchBox.refs.inp).value;
  }
  liveSearch () {
    var queryInput = this.searchFieldValue(),
      r;
    if (queryInput && queryInput.length > 2) {
      r = stores.assetSearch.getRecentSearch(queryInput);
      if (r) {
        this.setState({
          searchResults: r
        });
      } else {
        actions.search.assets(queryInput);
      }
    }
  }
  _displayAssetLibraryItems () {
    var qresults = this.state.assetLibraryItems;
    // var alItems;
    // var contents;
    if (qresults && qresults.count > 0) {
      // var alItems = qresults.results;
      return (
              <bem.LibList ref="liblist">
                {qresults.results.map((item)=> {
                  var modifiers = [item.asset_type];
                  // var summ = item.summary;
                  return (
                      <bem.LibList__item m={modifiers} key={item.uid} data-uid={item.uid}>
                        <bem.LibList__dragbox />
                        <bem.LibList__label>
                          <ui.AssetName {...item} />
                        </bem.LibList__label>
                        <bem.LibList__qtype>
                          {t(item.asset_type)}
                        </bem.LibList__qtype>
                      </bem.LibList__item>
                    );
                })}
              </bem.LibList>
              );
    } else {
      return (
              <bem.LibList m={'loading'}>
                <bem.LibList__item m={'message'}>
                  <i />
                  {t('loading library assets')}
                </bem.LibList__item>
              </bem.LibList>
              );
    }
  }
  renderSearchResults () {
  }
  toggleTagSelected (tag) {
    var tags = this.state.selectedTags,
        _ti = tags.indexOf(tag);
    if (_ti === -1) {
      tags.push(tag);
    } else {
      tags.splice(tags.indexOf(_ti), 1);
    }
    this.setState({
      selectedTags: tags
    });
  }
  toggleOpen () {
    stores.pageState.toggleAssetNavIntentOpen();
  }
  render () {
    return (
        <bem.LibNav m={{
              deactivated: !this.state.assetNavIsOpen,
              visible: this.state.assetNavIsOpen
            }}>
          {this.state.assetNavIsOpen && 
            <bem.LibNav__header>
              <bem.LibNav__logo onClick={this.toggleOpen}>
                <i />
              </bem.LibNav__logo>
              <bem.LibNav__search>
                <ListSearch
                    placeholder={t('search library')}
                    searchContext={this.state.searchContext}
                  />
              </bem.LibNav__search>
              <ListTagFilter searchContext={this.state.searchContext} />
              <ListCollectionFilter searchContext={this.state.searchContext} />
              <ListExpandToggle searchContext={this.state.searchContext} />
            </bem.LibNav__header>
          }
          {this.state.assetNavIsOpen && 
            <bem.LibNav__content>
              <AssetNavigatorListView searchContext={this.state.searchContext} />
            </bem.LibNav__content>
          }
          <bem.LibNav__footer />
        </bem.LibNav>
      );
  }
};

reactMixin(AssetNavigator.prototype, Reflux.connectFilter(stores.assetSearch, 'searchResults', AssetNavigator.prototype.filterSearchResults));

export default AssetNavigator;