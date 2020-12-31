import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import {Link} from 'react-router';
import Reflux from 'reflux';
import mixins from '../mixins';
import {bem} from '../bem';
import ui from '../ui';
import {searches} from '../searches';
import {stores} from '../stores';
import {
  COMMON_QUERIES,
  CATEGORY_LABELS
} from 'js/constants';

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
          assetType: COMMON_QUERIES.get('s'),
        },
        filterTags: COMMON_QUERIES.get('s'),
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
  componentWillReceiveProps() {
    this.listenTo(this.searchStore, this.searchChanged);
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
        <ui.SidebarAssetName {...asset} />
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
      s.searchResultsFor.assetType === COMMON_QUERIES.get('s')
    ) {
      activeItems = 'searchResultsCategorizedResultsLists';
    }

    if (s.searchState === 'loading' && s.searchString === false) {
      return (
        <bem.Loading>
          <bem.Loading__inner>
            <i />
            {t('loading...')}
          </bem.Loading__inner>
        </bem.Loading>
      );
    }

    return (
      <bem.FormSidebar>
        {
          (() => {
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
              return [CATEGORY_LABELS.Deployed, CATEGORY_LABELS.Draft, CATEGORY_LABELS.Archived].map(
                (category) => {
                  var categoryVisible = this.state.selectedCategories[category];
                  if (s[activeItems][category].length < 1) {
                    categoryVisible = false;
                  }

                  const icon = ['k-icon'];
                  if (category === CATEGORY_LABELS.Deployed) {
                    icon.push('k-icon-deploy');
                  }
                  if (category === CATEGORY_LABELS.Draft) {
                    icon.push('k-icon-drafts');
                  }
                  if (category === CATEGORY_LABELS.Archived) {
                    icon.push('k-icon-archived');
                  }

                  return [
                    <bem.FormSidebar__label
                      m={[category, categoryVisible ? 'visible' : 'collapsed']}
                      onClick={this.toggleCategory(category)}
                      key={`${category}-label`}
                    >
                      <i className={icon.join(' ')}/>
                      <bem.FormSidebar__labelText>{category}</bem.FormSidebar__labelText>
                      <bem.FormSidebar__labelCount>{s[activeItems][category].length}</bem.FormSidebar__labelCount>
                    </bem.FormSidebar__label>,

                    <bem.FormSidebar__grouping
                      m={[category, categoryVisible ? 'visible' : 'collapsed']}
                      key={`${category}-group`}
                    >
                      {s[activeItems][category].map(this.renderMiniAssetRow.bind(this))}
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
