import React from 'react/addons';
import Reflux from 'reflux';
import {Navigation} from 'react-router';

import searches from '../searches';
import mixins from '../mixins';
import stores from '../stores';
import {dataInterface} from '../dataInterface';
import bem from '../bem';
import mdl from '../libs/rest_framework/material';
import AssetRow from './assetrow';
import DocumentTitle from 'react-document-title';
import $ from 'jquery';

import {
  parsePermissions,
  t,
  isLibrary,
} from '../utils';

var SearchCollectionList = React.createClass({
  mixins: [
    searches.common,
    Navigation,
    mixins.clickAssets,
    Reflux.connect(stores.selectedAsset),
    Reflux.ListenerMixin,
  ],
  getInitialState () {
    var selectedCategories = {
      'Draft': true,
      'Deployed': true, 
      'Archived': true
    }
    return {
      selectedCategories: selectedCategories,
      ownedCollections: [],
      fixedHeadings: '',
      fixedHeadingsWidth: 'auto'
    };
  },
  getDefaultProps () {
    return {
      assetRowClass: AssetRow,
      searchContext: 'default',
    };
  },
  componentDidMount () {
    this.listenTo(this.searchStore, this.searchChanged);
    this.queryCollections();
  },
  searchChanged (searchStoreState) {
    this.setState(searchStoreState);
    if (searchStoreState.searchState === 'done')
      this.queryCollections();
  },
  queryCollections () {
    if (isLibrary(this.context.router)) {
      dataInterface.listCollections().then((collections)=>{
        this.setState({
          ownedCollections: collections.results.filter((value) => {
            if (value.access_type === 'shared') {
              // TODO: include shared assets with edit (change) permission for current user
              // var hasChangePermission = false;
              // value.permissions.forEach((perm, index) => {
              //   if (perm.permission == 'change_collection')
              //     hasChangePermission = true;
              // });
              // return hasChangePermission;
              return false;
            } else {
              return value.access_type === 'owned';
            }
          })
        });
      });
    }
  },
  handleScroll: function(event) {
    if (this.props.searchContext.store.filterTags == 'asset_type:survey') {
      let offset = $(event.target).children('.asset-list').offset().top;
      this.setState({
        fixedHeadings: offset < -55 ? 'fixed-headings' : '',
        fixedHeadingsWidth: offset < -55 ? $(event.target).children('.asset-list').width() + 'px' : 'auto',
      });
    }
  },

  renderAssetRow (resource) {
    var currentUsername = stores.session.currentAccount && stores.session.currentAccount.username;
    var perm = parsePermissions(resource.owner, resource.permissions);
    var isSelected = stores.selectedAsset.uid === resource.uid;
    var ownedCollections = this.state.ownedCollections;

    return (
        <this.props.assetRowClass key={resource.uid}
                      currentUsername={currentUsername}
                      perm={perm}
                      onActionButtonClick={this.onActionButtonClick}
                      isSelected={isSelected}
                      ownedCollections={ownedCollections}
                      deleting={resource.deleting}
                      {...resource}
                        />
      );
  },
  toggleCategory(c) {
    return function (e) {
    var selectedCategories = this.state.selectedCategories;
    selectedCategories[c] = !selectedCategories[c];
      this.setState({
        selectedCategories: selectedCategories,
      });
    }.bind(this)
  },
  renderHeadings () {
    return [
      (
        <bem.Library_breadcrumb className={this.state.parentName ? '' : 'hidden'}>
          <span>{t('Library')}</span>
          <span className="separator"><i className="fa fa-caret-right" /></span>
          <span>{this.state.parentName}</span>
        </bem.Library_breadcrumb>
      ),
      (
        <bem.AssetListSorts className="mdl-grid">
          <bem.AssetListSorts__item m={'name'} className="mdl-cell mdl-cell--6-col mdl-cell--3-col-tablet">
            {t('Name')}
          </bem.AssetListSorts__item>
          <bem.AssetListSorts__item m={'owner'} className="mdl-cell mdl-cell--2-col mdl-cell--2-col-tablet">
            {t('Owner')}
          </bem.AssetListSorts__item>
          <bem.AssetListSorts__item m={'modified'} className="mdl-cell mdl-cell--3-col mdl-cell--2-col-tablet">
            {t('Last Modified')}
          </bem.AssetListSorts__item>
          <bem.AssetListSorts__item m={'questions'} className="mdl-cell mdl-cell--1-col mdl-cell--1-col-tablet">
            {t('Questions')}
          </bem.AssetListSorts__item>
        </bem.AssetListSorts>
      )];
  },
  renderGroupedHeadings () {
    return (
        <bem.AssetListSorts className="mdl-grid" style={{width: this.state.fixedHeadingsWidth}}>
          <bem.AssetListSorts__item m={'name'} className="mdl-cell mdl-cell--5-col mdl-cell--3-col-tablet">
            {t('Name')}
          </bem.AssetListSorts__item>
          <bem.AssetListSorts__item m={'owner'} className="mdl-cell mdl-cell--2-col mdl-cell--2-col-tablet">
            {t('Shared by')}
          </bem.AssetListSorts__item>
          <bem.AssetListSorts__item m={'created'} className="mdl-cell mdl-cell--2-col mdl-cell--hide-tablet">
            {t('Created')}
          </bem.AssetListSorts__item>
          <bem.AssetListSorts__item m={'modified'} className="mdl-cell mdl-cell--2-col mdl-cell--2-col-tablet">
            {t('Last Modified')}
          </bem.AssetListSorts__item>
          <bem.AssetListSorts__item m={'submissions'} className="mdl-cell mdl-cell--1-col mdl-cell--1-col-tablet">
            {t('Submissions')}
          </bem.AssetListSorts__item>
        </bem.AssetListSorts>
      );
  },
  renderGroupedResults () {
    var searchResultsBucket = 'defaultQueryCategorizedResultsLists';
    if (this.state.searchResultsDisplayed)
      searchResultsBucket = 'searchResultsCategorizedResultsLists';

    return ['Deployed', 'Draft', 'Archived'].map(
      (category) => {
        return [
          <bem.AssetList__heading m={['visible']}>
            {t(category)}
            {` (${this.state[searchResultsBucket][category].length})`}
          </bem.AssetList__heading>,
          <bem.AssetItems m={['visible']}>
            {this.state[searchResultsBucket][category].length > 0 && this.renderGroupedHeadings()}
            {
              (()=>{
                return this.state[[searchResultsBucket]][category].map(
                  this.renderAssetRow)
              })()
            }
          </bem.AssetItems>
        ];
      }
    );    
  },

  render () {
    var s = this.state;
    var docTitle = '';
    if (this.props.searchContext.store.filterTags == 'asset_type:survey') {
      var display = 'grouped';
      docTitle = t('Projects');
    } else {
      var display = 'regular';
      docTitle = t('Library');
    }
    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <bem.List m={display} onScroll={this.handleScroll}>
          {
            (()=>{
              if (display == 'regular') {
                return this.renderHeadings();
              }
            })()
          }
          <bem.AssetList m={this.state.fixedHeadings}>
          {
            (()=>{
              if (s.searchResultsDisplayed) {
                if (s.searchState === 'loading') {
                  return (
                    <bem.Loading>
                      <bem.Loading__inner>
                        <i />
                        {t('loading...')} 
                      </bem.Loading__inner>
                    </bem.Loading>
                  );
                } else if (s.searchState === 'done') {
                  if (display == 'grouped') {
                    return this.renderGroupedResults();
                  } else {
                    return s.searchResultsList.map(this.renderAssetRow);
                  }
                }
              } else {
                if (s.defaultQueryState === 'loading') {
                  return (
                    <bem.Loading>
                      <bem.Loading__inner>
                        <i />
                        {t('loading...')} 
                      </bem.Loading__inner>
                    </bem.Loading>
                  );
                } else if (s.defaultQueryState === 'done') {
                  if (s.defaultQueryCount < 1) {
                    if (s.defaultQueryFor.assetType == 'asset_type:survey') {
                      return (
                        <bem.Loading>
                          <bem.Loading__inner>
                            {t("Let's get started by creating your first project. Click the New button to create a new form.")} 
                          </bem.Loading__inner>
                        </bem.Loading>
                      );
                    } else {
                      return (
                        <bem.Loading>
                          <bem.Loading__inner>
                            {t("Let's get started by creating your first library question or question block. Click the New button to create a new question or block.")} 
                          </bem.Loading__inner>
                        </bem.Loading>
                      );
                    }
                  }

                  if (display == 'grouped') {
                    return this.renderGroupedResults();
                  } else {
                    return s.defaultQueryResultsList.map(this.renderAssetRow);
                  }
                }
              }
              // it shouldn't get to this point
              return false;
            })()
          }
          </bem.AssetList>
        </bem.List>
      </DocumentTitle>
      );
  },
  componentDidUpdate() {
    mdl.upgradeDom();
  }
});

export default SearchCollectionList;
