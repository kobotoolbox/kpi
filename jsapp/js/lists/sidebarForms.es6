import React from 'react/addons';
import Reflux from 'reflux';
import {Navigation} from 'react-router';

import mixins from '../mixins';
import bem from '../bem';
import ui from '../ui';
import searches from '../searches';
import stores from '../stores';
import SearchCollectionList from '../components/searchcollectionlist';
import SVGIcon from '../libs/SVGIcon';

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
        <bem.FormSidebar__label className="is-edge">
          <SVGIcon id="ki-check-round" />
          {t('Active')} (#)
        </bem.FormSidebar__label>
        <bem.FormSidebar__grouping>
          {
            (()=>{
              if (s.defaultQueryState === 'loading') {
                return (
                  <bem.FormSidebar__item m={'loading'}>
                    {t('loading...')}
                  </bem.FormSidebar__item>
                );
              } else if (s.defaultQueryState === 'done') {
                  return s.defaultQueryResultsList.map(this.renderMiniAssetRow);
              }
            })()
          }
        </bem.FormSidebar__grouping>
        <bem.FormSidebar__label className="is-edge">
          <SVGIcon id="ki-drafts" />
          {t('Drafts')} (#)
        </bem.FormSidebar__label>
        <bem.FormSidebar__label className="is-edge">
          <SVGIcon id="ki-inactive" />
          {t('Inactive')} (#)
        </bem.FormSidebar__label>
        <bem.FormSidebar__label className="is-edge">
          <SVGIcon id="ki-trash" />
          {t('Deleted')} (#)
        </bem.FormSidebar__label>
      </bem.FormSidebar>
    );
  },
});

export default SidebarFormsList;