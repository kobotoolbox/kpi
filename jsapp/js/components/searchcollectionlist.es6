import React from 'react/addons';
import Reflux from 'reflux';
import {Navigation} from 'react-router';

import searches from '../searches';
import mixins from '../mixins';
import stores from '../stores';
import bem from '../bem';
import {notify, getAnonymousUserPermission, formatTime, anonUsername, parsePermissions, log, t} from '../utils';

import AssetRow from './assetrow';

var SearchCollectionList = React.createClass({
  mixins: [
    searches.common,
    Navigation,
    mixins.clickAssets,
    Reflux.connect(stores.selectedAsset),
    Reflux.ListenerMixin,
  ],
  getDefaultProps () {
    return {
      assetRowClass: AssetRow,
      searchContext: 'default',
    }
  },
  componentDidMount () {
    this.listenTo(this.searchStore, this.searchChanged);
  },
  searchChanged (searchStoreState) {
    this.setState(searchStoreState);
  },
  renderAssetRow (resource) {
    var currentUsername = stores.session.currentAccount && stores.session.currentAccount.username;
    var perm = parsePermissions(resource.owner, resource.permissions)
    var isSelected = this.state.selectedAssetUid === resource.uid;
    return <this.props.assetRowClass key={resource.uid}
                      currentUsername={currentUsername}
                      perm={perm}
                      onActionButtonClick={this.onActionButtonClick}
                      isSelected={isSelected}
                      {...resource}
                        />
  },
  render () {
    var s = this.state,
        p = this.props;
    return (
        <bem.CollectionAssetList>
        {
          (()=>{
            if (s.searchResultsDisplayed) {
              if (s.searchState === 'loading') {
                return (
                  <bem.CollectionAssetList__message m={'loading'}>
                    {t('loading...')}
                  </bem.CollectionAssetList__message>
                );
              } else if (s.searchState === 'done') {
                return s.searchResultsList.map(this.renderAssetRow);
              }
            } else {
              if (s.defaultQueryState === 'loading') {
                return (
                  <bem.CollectionAssetList__message m={'loading'}>
                    {t('loading...')}
                  </bem.CollectionAssetList__message>
                );
              } else if (s.defaultQueryState === 'done') {
                return s.defaultQueryResultsList.map(this.renderAssetRow);
              }
            }
            // it shouldn't get to this point
            return (
              <bem.CollectionAssetList__message m={'error'}>
                {t('error')}
              </bem.CollectionAssetList__message>
            );
          })()
        }
        </bem.CollectionAssetList>
      );
  },
});

export default SearchCollectionList;
