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
    return {
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
                {resource.name} 
              </bem.FormSidebar__itemlink>
            </bem.FormSidebar__item>
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
              return ['active', 'drafts', 'inactive' /*, 'deleted'*/].map(
                (category) => {
                  // TODO: ask Penar what's the difference between k-icon-active-1 and k-icon-active
                  return [
                    <bem.FormSidebar__label>
                      <i className={`k-icon-${category}`} />
                      {t(category)}
                      {` (${s.defaultQueryCategorizedResultsLists[category].length})`}
                    </bem.FormSidebar__label>,
                    <bem.FormSidebar__grouping m={category}>
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
