import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import {Link} from 'react-router';
import Reflux from 'reflux';
import mixins from '../mixins';
import bem from 'js/bem';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {searches} from '../searches';
import {stores} from '../stores';
import {
  COMMON_QUERIES,
  DEPLOYMENT_CATEGORIES
} from 'js/constants';
import AssetName from 'js/components/common/assetName';

class SidebarFormsList extends Reflux.Component {
  constructor(props) {
    super(props);
    var selectedCategories = {
      'Draft': false,
      'Deployed': false,
      'Archived': false
    };
    this.state = {
      selectedCategories: selectedCategories,
      searchContext: searches.getSearchContext('forms', {
        filterParams: {
          assetType: COMMON_QUERIES.s,
        },
        filterTags: COMMON_QUERIES.s,
      })
    };
    this.store = stores.pageState;
    autoBind(this);
  }
  componentDidMount() {
    this.listenTo(this.searchStore, this.searchChanged);
    if (!this.isFormList()) {
      this.searchSemaphore();
    }
  }
  searchChanged(searchStoreState) {
    this.setState(searchStoreState);
  }
  renderMiniAssetRow(asset) {
    var href = `/forms/${asset.uid}`;

    if (this.userCan('view_submissions', asset) && asset.has_deployment && asset.deployment__submission_count) {
      href = href + '/summary';
    } else {
      href = href + '/landing';
    }

    let classNames = ['form-sidebar__item'];
    if (asset.uid === this.currentAssetID()) {
      classNames.push('form-sidebar__item--active');
    }

    return (
      <Link
        to={href}
        key={asset.uid}
        className={classNames.join(' ')}
      >
        <AssetName asset={asset}/>
      </Link>
    );
  }
  toggleCategory(c) {
    return function() {
    var selectedCategories = this.state.selectedCategories;
    selectedCategories[c] = !selectedCategories[c];
      this.setState({
        selectedCategories: selectedCategories,
      });
    }.bind(this);
  }
  render() {
    var s = this.state;
    var activeItems = 'defaultQueryCategorizedResultsLists';

    // sync sidebar with main list when it is not a search query, allows for deletes to update the sidebar as well
    // this is a temporary fix, a proper fix needs to update defaultQueryCategorizedResultsLists when deleting/archiving/cloning
    if (
      s.searchState === 'done' &&
      (s.searchString === false || s.searchString === '') &&
      s.searchResultsFor &&
      s.searchResultsFor.assetType === COMMON_QUERIES.s
    ) {
      activeItems = 'searchResultsCategorizedResultsLists';
    }

    if (s.searchState === 'loading' && s.searchString === false) {
      return (<LoadingSpinner/>);
    }

    return (
      <bem.FormSidebar>
        {
          (() => {
            if (s.defaultQueryState === 'loading') {
              return (<LoadingSpinner/>);
            } else if (s.defaultQueryState === 'done') {
              return Object.keys(DEPLOYMENT_CATEGORIES).map(
                (categoryId) => {
                  var categoryVisible = this.state.selectedCategories[categoryId];
                  if (s[activeItems][categoryId].length < 1) {
                    categoryVisible = false;
                  }

                  const icon = ['k-icon'];
                  if (categoryId === DEPLOYMENT_CATEGORIES.Deployed.id) {
                    icon.push('k-icon-deploy');
                  }
                  if (categoryId === DEPLOYMENT_CATEGORIES.Draft.id) {
                    icon.push('k-icon-drafts');
                  }
                  if (categoryId === DEPLOYMENT_CATEGORIES.Archived.id) {
                    icon.push('k-icon-archived');
                  }

                  return [
                    <bem.FormSidebar__label
                      m={[categoryId, categoryVisible ? 'visible' : 'collapsed']}
                      onClick={this.toggleCategory(categoryId)}
                      key={`${categoryId}-label`}
                    >
                      <i className={icon.join(' ')}/>
                      <bem.FormSidebar__labelText>
                        {DEPLOYMENT_CATEGORIES[categoryId].label}
                      </bem.FormSidebar__labelText>
                      <bem.FormSidebar__labelCount>{s[activeItems][categoryId].length}</bem.FormSidebar__labelCount>
                    </bem.FormSidebar__label>,

                    <bem.FormSidebar__grouping
                      m={[categoryId, categoryVisible ? 'visible' : 'collapsed']}
                      key={`${categoryId}-group`}
                    >
                      {s[activeItems][categoryId].map(this.renderMiniAssetRow.bind(this))}
                    </bem.FormSidebar__grouping>
                  ];
                }
              );
            }
          })()
        }
      </bem.FormSidebar>
    );
  }
}

SidebarFormsList.contextTypes = {
  router: PropTypes.object
};

reactMixin(SidebarFormsList.prototype, searches.common);
reactMixin(SidebarFormsList.prototype, Reflux.ListenerMixin);
reactMixin(SidebarFormsList.prototype, mixins.contextRouter);
reactMixin(SidebarFormsList.prototype, mixins.permissions);

export default SidebarFormsList;
