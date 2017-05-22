import React from 'react';
import Reflux from 'reflux';

import searches from '../searches';
import mixins from '../mixins';
import stores from '../stores';
import {dataInterface} from '../dataInterface';
import bem from '../bem';
import AssetRow from './assetrow';
import DocumentTitle from 'react-document-title';
import $ from 'jquery';

import {
  parsePermissions,
  t,
} from '../utils';

var SearchCollectionList = React.createClass({
  mixins: [
    searches.common,
    mixins.clickAssets,
    Reflux.connect(stores.selectedAsset, 'selectedAsset'),
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
    if (this.props.searchContext.store.filterTags != 'asset_type:survey') {
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
        fixedHeadings: offset < -105 ? 'fixed-headings' : '',
        fixedHeadingsWidth: offset < -105 ? $(event.target).children('.asset-list').width() + 'px' : 'auto',
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
        <bem.List__heading key='1'>
          <span className={this.state.parentName ? 'parent' : ''}>{t('My Library')}</span>
          {this.state.parentName &&
            <span>
              <i className="k-icon-next" />
              <span>{this.state.parentName}</span>
            </span>
          }
        </bem.List__heading>
      ),
      (
        <bem.AssetListSorts className="mdl-grid" key='2'>
          <bem.AssetListSorts__item m={'name'} className="mdl-cell mdl-cell--8-col mdl-cell--4-col-tablet mdl-cell--2-col-phone">
            {t('Name')}
          </bem.AssetListSorts__item>
          <bem.AssetListSorts__item m={'owner'} className="mdl-cell mdl-cell--2-col mdl-cell--2-col-tablet mdl-cell--1-col-phone">
            {t('Owner')}
          </bem.AssetListSorts__item>
          <bem.AssetListSorts__item m={'modified'} className="mdl-cell mdl-cell--2-col mdl-cell--2-col-tablet mdl-cell--1-col-phone">
            {t('Last Modified')}
          </bem.AssetListSorts__item>
        </bem.AssetListSorts>
      )];
  },
  renderGroupedHeadings () {
    return (
        <bem.AssetListSorts className="mdl-grid" style={{width: this.state.fixedHeadingsWidth}}>
          <bem.AssetListSorts__item m={'name'} className="mdl-cell mdl-cell--5-col mdl-cell--4-col-tablet mdl-cell--2-col-phone">
            {t('Name')}
          </bem.AssetListSorts__item>
          <bem.AssetListSorts__item m={'owner'} className="mdl-cell mdl-cell--2-col mdl-cell--1-col-tablet mdl-cell--hide-phone">
            {t('Shared by')}
          </bem.AssetListSorts__item>
          <bem.AssetListSorts__item m={'created'} className="mdl-cell mdl-cell--2-col mdl-cell--hide-tablet mdl-cell--hide-phone">
            {t('Created')}
          </bem.AssetListSorts__item>
          <bem.AssetListSorts__item m={'modified'} className="mdl-cell mdl-cell--2-col mdl-cell--2-col-tablet mdl-cell--1-col-phone">
            {t('Last Modified')}
          </bem.AssetListSorts__item>
          <bem.AssetListSorts__item m={'submissions'} className="mdl-cell mdl-cell--1-col mdl-cell--1-col-tablet mdl-cell--1-col-phone" >
              {t('Submissions')}
          </bem.AssetListSorts__item>
        </bem.AssetListSorts>
      );
  },
  renderGroupedResults () {
    var searchResultsBucket = 'defaultQueryCategorizedResultsLists';
    if (this.state.searchResultsDisplayed)
      searchResultsBucket = 'searchResultsCategorizedResultsLists';

    var results = ['Deployed', 'Draft', 'Archived'].map(
      (category, i) => {
        if (this.state[searchResultsBucket][category].length < 1) {
          return []
        }
        return [
          <bem.List__subheading key={i}>
            {t(category)}
          </bem.List__subheading>,
          <bem.AssetItems m={i+1} key={i+2}>
            {this.renderGroupedHeadings()}
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

    return [
      <bem.List__heading key="h1" className="is-edge">
        {t('Active Projects')}
      </bem.List__heading>,
      results];
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
  }
});

export default SearchCollectionList;
