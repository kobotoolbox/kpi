import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import {searches} from 'js/searches';
import mixins from 'js/mixins';
import {stores} from 'js/stores';
import {dataInterface} from 'js/dataInterface';
import bem from 'js/bem';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import AssetRow from './assetrow';
import DocumentTitle from 'react-document-title';
import Dropzone from 'react-dropzone';
import {validFileTypes} from 'utils';
import {redirectToLogin} from 'js/router/routerUtils';
import {
  ASSET_TYPES,
  COMMON_QUERIES,
  ACCESS_TYPES,
  DEPLOYMENT_CATEGORIES,
} from 'js/constants';

class SearchCollectionList extends Reflux.Component {
  constructor(props) {
    super(props);
    this.state = {
      ownedCollections: [],
      fixedHeadings: '',
      fixedHeadingsWidth: 'auto',
    };
    this.store = stores.selectedAsset;
    this.unlisteners = [];
    autoBind(this);
  }
  componentDidMount() {
    this.unlisteners.push(
      this.searchStore.listen(this.searchChanged)
    );
    this.queryCollections();
  }
  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }
  searchChanged(searchStoreState) {
    this.setState(searchStoreState);
    if (searchStoreState.searchState === 'done') {
      this.queryCollections();
    }
  }
  queryCollections() {
    if (this.props.searchContext.store.filterTags !== COMMON_QUERIES.s) {
      dataInterface.getCollections().then((collections) => {
        this.setState({
          ownedCollections: collections.results.filter((value) => {
            if (value.access_types && value.access_types.includes(ACCESS_TYPES.shared)) {
              // TODO: include shared assets with edit (change) permission for current user
              // var hasChangePermission = false;
              // value.permissions.forEach((perm, index) => {
              //   if (perm.permission == 'change_asset')
              //     hasChangePermission = true;
              // });
              // return hasChangePermission;
              return false;
            } else {
              return value.access_types && value.access_types.includes(ACCESS_TYPES.owned);
            }
          })
        });
      });
    }
  }
  handleScroll(event) {
    if (this.props.searchContext.store.filterTags === COMMON_QUERIES.s) {
      let offset = $(event.target).children('.asset-list').offset().top;
      this.setState({
        fixedHeadings: offset < 30 ? 'fixed-headings' : '',
        fixedHeadingsWidth: offset < 30 ? $(event.target).children('.asset-list').width() + 'px' : 'auto',
      });
    }
  }

  renderAssetRow(resource) {
    var currentUsername = stores.session.currentAccount && stores.session.currentAccount.username;
    var isSelected = stores.selectedAsset.uid === resource.uid;
    var ownedCollections = this.state.ownedCollections;

    // for unnamed assets, we try to display first question label
    let firstQuestionLabel;
    if (
      resource.asset_type !== ASSET_TYPES.survey.id &&
      resource.name === '' &&
      resource.summary &&
      resource.summary.labels &&
      resource.summary.labels.length > 0
    ) {
      firstQuestionLabel = resource.summary.labels[0];
    }

    return (
      <this.props.assetRowClass key={resource.uid}
        currentUsername={currentUsername}
        onActionButtonClick={this.onActionButtonClick}
        isSelected={isSelected}
        ownedCollections={ownedCollections}
        deleting={resource.deleting}
        firstQuestionLabel={firstQuestionLabel}
        {...resource}
      />
    );
  }
  renderHeadings() {
    return [
      (
        <bem.List__heading key='1'>
          <span className={this.state.parentName ? 'parent' : ''}>
            {t('My Library')}
          </span>

          {this.state.parentName &&
            <span>
              <i className='k-icon k-icon-next' />
              <span>{this.state.parentName}</span>
            </span>
          }
        </bem.List__heading>
      ),
      (
        <bem.AssetListSorts className='mdl-grid' key='2'>
          <bem.AssetListSorts__item m={'name'} className='mdl-cell mdl-cell--6-col mdl-cell--3-col-tablet mdl-cell--2-col-phone'>
            {t('Name')}
          </bem.AssetListSorts__item>
          <bem.AssetListSorts__item m={'type'} className='mdl-cell mdl-cell--2-col mdl-cell--1-col-tablet mdl-cell--hide-phone'>
            {t('Type')}
          </bem.AssetListSorts__item>
          <bem.AssetListSorts__item m={'owner'} className='mdl-cell mdl-cell--2-col mdl-cell--2-col-tablet mdl-cell--1-col-phone'>
            {t('Owner')}
          </bem.AssetListSorts__item>
          <bem.AssetListSorts__item m={'modified'} className='mdl-cell mdl-cell--2-col mdl-cell--2-col-tablet mdl-cell--1-col-phone'>
            {t('Last Modified')}
          </bem.AssetListSorts__item>
        </bem.AssetListSorts>
      )];
  }
  renderGroupedHeadings() {
    return (
        <bem.AssetListSorts className='mdl-grid' style={{width: this.state.fixedHeadingsWidth}}>
          <bem.AssetListSorts__item m={'name'} className='mdl-cell mdl-cell--5-col mdl-cell--4-col-tablet mdl-cell--2-col-phone'>
            {t('Name')}
          </bem.AssetListSorts__item>
          <bem.AssetListSorts__item m={'owner'} className='mdl-cell mdl-cell--2-col mdl-cell--1-col-tablet mdl-cell--hide-phone'>
            {t('Shared by')}
          </bem.AssetListSorts__item>
          <bem.AssetListSorts__item m={'created'} className='mdl-cell mdl-cell--2-col mdl-cell--hide-tablet mdl-cell--hide-phone'>
            {t('Created')}
          </bem.AssetListSorts__item>
          <bem.AssetListSorts__item m={'modified'} className='mdl-cell mdl-cell--2-col mdl-cell--2-col-tablet mdl-cell--1-col-phone'>
            {t('Last Modified')}
          </bem.AssetListSorts__item>
          <bem.AssetListSorts__item m={'submissions'} className='mdl-cell mdl-cell--1-col mdl-cell--1-col-tablet mdl-cell--1-col-phone' >
            {t('Submissions')}
          </bem.AssetListSorts__item>
        </bem.AssetListSorts>
      );
  }
  renderGroupedResults() {
    var searchResultsBucket = 'defaultQueryCategorizedResultsLists';
    if (this.state.searchResultsDisplayed) {
      searchResultsBucket = 'searchResultsCategorizedResultsLists';
    }

    var results = Object.keys(DEPLOYMENT_CATEGORIES).map(
      (category, i) => {
        if (this.state[searchResultsBucket][category].length < 1) {
          return [];
        }
        return [
          <bem.List__subheading key={i}>
            {DEPLOYMENT_CATEGORIES[category].label}
          </bem.List__subheading>,

          <bem.AssetItems m={i + 1} key={i + 2}>
            {this.renderGroupedHeadings()}
            {
              (() => {
                return this.state[[searchResultsBucket]][category].map(this.renderAssetRow);
              })()
            }
          </bem.AssetItems>
        ];
      }
    );

    return results;
  }

  render() {
    if (!stores.session.isLoggedIn && stores.session.isAuthStateKnown) {
      redirectToLogin();
      return null;
    }

    var s = this.state;
    var docTitle = '';
    let display;
    if (this.props.searchContext.store.filterTags === COMMON_QUERIES.s) {
      display = 'grouped';
      docTitle = t('Projects');
    } else {
      display = 'regular';
      docTitle = t('Library');
    }
    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <Dropzone
          onDrop={this.dropFiles}
          disableClick
          multiple
          className='dropzone'
          activeClassName='dropzone--active'
          accept={validFileTypes()}
        >
          <bem.List m={display} onScroll={this.handleScroll}>
            {
              (() => {
                if (display === 'regular') {
                  return this.renderHeadings();
                }
              })()
            }
            <bem.AssetList m={this.state.fixedHeadings}>
            {
              (() => {
                if (s.searchResultsDisplayed) {
                  if (s.searchState === 'loading') {
                    return (<LoadingSpinner/>);
                  } else if (s.searchState === 'done') {
                    if (s.searchResultsCount === 0) {
                      return (
                        <bem.Loading>
                          <bem.Loading__inner>
                            {t('Your search returned no results.')}
                          </bem.Loading__inner>
                        </bem.Loading>
                      );
                    } else if (display === 'grouped') {
                      return this.renderGroupedResults();
                    } else {
                      return s.searchResultsList.map(this.renderAssetRow);
                    }
                  }
                } else {
                  if (s.defaultQueryState === 'loading') {
                    return (<LoadingSpinner/>);
                  } else if (s.defaultQueryState === 'done') {
                    if (s.defaultQueryCount < 1) {
                      if (s.defaultQueryFor.assetType === COMMON_QUERIES.s) {
                        return (
                          <bem.Loading>
                            <bem.Loading__inner>
                              {t('Let\'s get started by creating your first project. Click the New button to create a new form.')}
                              <div className='pro-tip'>
                              {t('Advanced users: You can also drag and drop XLSForms here and they will be uploaded and converted to projects.')}
                              </div>
                            </bem.Loading__inner>
                          </bem.Loading>
                        );
                      } else {
                        return (
                          <bem.Loading>
                            <bem.Loading__inner>
                              {t('Let\'s get started by creating your first library question or question block. Click the New button to create a new question or block.')}
                            </bem.Loading__inner>
                          </bem.Loading>
                        );
                      }
                    }

                    if (display === 'grouped') {
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
            <div className='dropzone-active-overlay'>
              <i className='k-icon k-icon-upload' />
              {t('Drop files to upload')}
            </div>
          </bem.List>
        </Dropzone>
      </DocumentTitle>
      );
  }
}

SearchCollectionList.defaultProps = {
  assetRowClass: AssetRow,
  searchContext: 'default',
};

SearchCollectionList.contextTypes = {
  router: PropTypes.object
};

reactMixin(SearchCollectionList.prototype, searches.common);
reactMixin(SearchCollectionList.prototype, mixins.clickAssets);
reactMixin(SearchCollectionList.prototype, Reflux.ListenerMixin);
reactMixin(SearchCollectionList.prototype, mixins.droppable);

export default SearchCollectionList;
