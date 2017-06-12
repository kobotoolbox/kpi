import React from 'react';
import Reflux from 'reflux';
import { Link } from 'react-router';
import mixins from '../mixins';
import bem from '../bem';
import ui from '../ui';
import searches from '../searches';
import stores from '../stores';
import SearchCollectionList from '../components/searchcollectionlist';

import {
  parsePermissions,
  t,
  assign
} from '../utils';

var SidebarFormsList = React.createClass({
  mixins: [
    searches.common,
    Reflux.ListenerMixin,
    Reflux.connect(stores.pageState, 'pageState'),
    mixins.contextRouter
  ],
  getInitialState () {
    var selectedCategories = {
      'Draft': false,
      'Deployed': false, 
      'Archived': false
    }
    return {
      selectedCategories: selectedCategories,
      searchContext: searches.getSearchContext('forms', {
        filterParams: {
          assetType: 'asset_type:survey',
        },
        filterTags: 'asset_type:survey',
      })
    };
  },
  componentDidMount () {
    this.listenTo(this.searchStore, this.searchChanged);
  },
  componentWillReceiveProps () {
    this.listenTo(this.searchStore, this.searchChanged);
  },
  searchChanged (searchStoreState) {
    this.setState(searchStoreState);
  },
  renderMiniAssetRow (resource) {
    var active = '';
    if (resource.uid == this.currentAssetID())
      active = ' active';

    return (
        <bem.FormSidebar__item key={resource.uid} className={active}>
          <Link to={`/forms/${resource.uid}`} className={`form-sidebar__itemlink`}>
            <ui.SidebarAssetName {...resource} />
          </Link>
        </bem.FormSidebar__item>
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
  render () {
    var s = this.state;
    return (
      <bem.FormSidebar>
        { 
          s.defaultQueryState === 'done' && 
          <bem.FormSidebar__label m={'active-projects'} className="is-edge">
            <i className="k-icon-projects" />
            {t('Active Projects')}
          </bem.FormSidebar__label>
        }
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
              return ['Deployed', 'Draft', 'Archived' /*, 'Deleted'*/].map(
                (category) => {
                  var categoryVisible = this.state.selectedCategories[category];
                  if (s.defaultQueryCategorizedResultsLists[category].length < 1) {
                    categoryVisible = false;
                  }
                  return [
                    <bem.FormSidebar__label m={[category, categoryVisible ? 'visible' : 'collapsed']} 
                                            onClick={this.toggleCategory(category)}>
                      <i />
                      {t(category)}
                      <bem.FormSidebar__labelCount>
                        {s.defaultQueryCategorizedResultsLists[category].length}
                      </bem.FormSidebar__labelCount>
                    </bem.FormSidebar__label>,
                    <bem.FormSidebar__grouping m={[category, categoryVisible ? 'visible' : 'collapsed']}>
                      {
                        s.defaultQueryCategorizedResultsLists[category].map(
                          this.renderMiniAssetRow)
                      }
                    </bem.FormSidebar__grouping>
                  ];
                }
              );
            }
          })()
        }
        <bem.FormSidebar__label className="is-edge">
          <i className="k-icon-trash" />
          {t('Deleted')} (#)
        </bem.FormSidebar__label>
      </bem.FormSidebar>
    );
  },
});

export default SidebarFormsList;
