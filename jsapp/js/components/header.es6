import React from 'react/addons';
import {Link} from 'react-router';
import mdl from '../libs/rest_framework/material';

import stores from '../stores';
import Reflux from 'reflux';
import bem from '../bem';
import actions from '../actions';
import {t, assign} from '../utils';
import searches from '../searches';

import {
  ListSearch,
  ListTagFilter,
} from '../components/list';

var leaveBetaUrl = stores.pageState.leaveBetaUrl;

var MainHeader = React.createClass({
  mixins: [
    Reflux.connect(stores.session),
    Reflux.connect(stores.pageState),
  ],
  getInitialState () {
    return assign({}, stores.pageState.state, {
      searchContext: searches.getSearchContext('forms', {
        filterParams: {
          assetType: 'asset_type:survey',
        },
        filterTags: 'asset_type:survey',
      })
    });
  },
  logout () {
    actions.auth.logout();
  },
  renderAccountNavMenu () {
    var accountName = this.state.currentAccount && this.state.currentAccount.username;
    var defaultGravatarImage = `${window.location.protocol}//www.gravatar.com/avatar/64e1b8d34f425d19e1ee2ea7236d3028?s=40`;
    var gravatar = this.state.currentAccount && this.state.currentAccount.gravatar || defaultGravatarImage;

    if (this.state.isLoggedIn) {
      return (
        <nav className="mdl-navigation">
          <button id="nav-menu-acct" className="mdl-button mdl-js-button">
            <span>
              <bem.AccountBox__image>
                <img src={gravatar} />
              </bem.AccountBox__image>
              <bem.AccountBox__name>{accountName}</bem.AccountBox__name>
              <i className="fa fa-caret-down"></i>
            </span>
          </button>

          <ul className="mdl-menu mdl-menu--bottom-right mdl-js-menu mdl-js-ripple-effect" htmlFor="nav-menu-acct">
            <li><a href={stores.session.currentAccount.projects_url + 'settings'} className="mdl-menu__item"><i className="ki ki-settings"></i> {t('Profile Settings')}</a></li>
            {leaveBetaUrl ?
              <li><a href={leaveBetaUrl} className="mdl-menu__item">{t('leave beta')}</a></li>
            :null}
            <li><a href='#' className="mdl-menu__item"><i className="ki ki-language"></i> {t('Language')}</a></li>

            <li><a href='#' onClick={this.logout} className="mdl-menu__item"><i className="ki ki-logout"></i> {t('Logout')}</a></li>
          </ul>
        </nav>

        );
    }
    return (
          <span>not logged in</span>
        );
  },
  render () {
    return (
        <header className="mdl-layout__header">
          <div className="mdl-layout__header-row">
            <span className='mdl-layout-title'>
              <a href='/'>
                <bem.AccountBox__logo />
              </a>
            </span>
            <ListSearch
                placeholder={t('search forms')}
                searchContext={this.state.searchContext}
              />
            <ListTagFilter
                searchContext={this.state.searchContext}
              />
            <div className="mdl-placeholder">
              (x msgs)
            </div>

            {this.renderAccountNavMenu()}
          </div>
        </header>
      );
  },
  componentDidUpdate() {
    mdl.upgradeDom();
  }
});

export default MainHeader;
