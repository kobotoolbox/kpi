import React from 'react/addons';
import Reflux from 'reflux';
import {Navigation} from 'react-router';

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
    Navigation,
    Reflux.ListenerMixin,
    Reflux.connect(stores.pageState)
  ],
  getInitialState () {
    var selectedCategories = {
      'Draft': true,
      'Deployed': true, 
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
    return  <bem.FormSidebar__item>
              <bem.FormSidebar__itemlink href={this.makeHref('form-landing', {assetid: resource.uid})}>
                <ui.SidebarAssetName {...resource} />
              </bem.FormSidebar__itemlink>
            </bem.FormSidebar__item>
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
                      {` (${s.defaultQueryCategorizedResultsLists[category].length})`}
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
