import React from 'react/addons';
import {Link} from 'react-router';
import mdl from '../libs/rest_framework/material';
import Select from 'react-select';

import stores from '../stores';
import Reflux from 'reflux';
import bem from '../bem';
import actions from '../actions';
import {t, assign} from '../utils';
import searches from '../searches';
import cookie from 'react-cookie';

const LANGUAGE_COOKIE_NAME = 'django_language';

import {
  ListSearch,
  ListTagFilter,
} from '../components/list';

var leaveBetaUrl = stores.pageState.leaveBetaUrl;
var cookieDomain = stores.pageState.cookieDomain;

function langsToValues (langs) {
  return langs.map(function(lang) {
    return {
      value: lang[0],
      label: lang[1],
    };
  });
}

var MainHeader = React.createClass({
  mixins: [
    Reflux.connect(stores.session),
    Reflux.connect(stores.pageState),
    Reflux.ListenerMixin,
  ],
  getInitialState () {
    this.listenTo(stores.session, ({currentAccount}) => {
      this.setState({
        // languageKeyValues: langsToValues(currentAccount.languages),
        languages: currentAccount.languages,
      });
    });

    return assign({
      currentLang: cookie.load(LANGUAGE_COOKIE_NAME) || 'en',
      libraryFiltersContext: searches.getSearchContext('library', {
        filterParams: {
          assetType: 'asset_type:question OR asset_type:block',
        },
        filterTags: 'asset_type:question OR asset_type:block',
      }),
      formFiltersContext: searches.getSearchContext('forms', {
        filterParams: {
          assetType: 'asset_type:survey',
        },
        filterTags: 'asset_type:survey',
      }),
      _langIndex: 0,
    }, stores.pageState.state);
  },
  componentWillMount() {
    this.setStates();
  },
  logout () {
    actions.auth.logout();
  },
  setStates() {
    var breadcrumb = this.state.headerBreadcrumb;
    if (breadcrumb.length > 1) {
      this.setState({headerFilters: false});
      return;
    }
    if (breadcrumb[0] && breadcrumb[0].to == 'library') {
      this.setState({headerFilters: 'library'});
    } else {
      this.setState({headerFilters: 'forms'});
    }
  },
  languageChange (evt) {
    var langCode = $(evt.target).data('key');
    if (langCode) {
      var cookieParams = {path: '/'};
      if (cookieDomain) {
        cookieParams.domain = cookieDomain;
      }
      cookie.save(LANGUAGE_COOKIE_NAME, langCode, cookieParams);
    }
  },
  renderLangItem(lang) {
    return (
      <li>
        <a data-key={lang[0]} onClick={this.languageChange} className="mdl-menu__item">{lang[1]}</a>
      </li>
    );
  },
  renderAccountNavMenu () {
    var accountName = this.state.currentAccount && this.state.currentAccount.username;
    var defaultGravatarImage = `${window.location.protocol}//www.gravatar.com/avatar/64e1b8d34f425d19e1ee2ea7236d3028?s=40`;
    var gravatar = this.state.currentAccount && this.state.currentAccount.gravatar || defaultGravatarImage;
    var langs = this.state.languages;

    if (this.state.isLoggedIn) {
      return (
        <bem.AccountBox>
          <span>lang = {this.state.currentLang}</span>
          <bem.AccountBox__notifications>
            <i className="fa fa-bell"></i> 
            <bem.AccountBox__notifications__count>
              2 
            </bem.AccountBox__notifications__count>
          </bem.AccountBox__notifications>
          <bem.AccountBox__name>
            <bem.AccountBox__image>
              <img src={gravatar} />
            </bem.AccountBox__image>
            <span>{accountName}</span>
            <i className="fa fa-caret-down"></i>
            <ul className="k-account__menu">
              <li><a href={stores.session.currentAccount.projects_url + '/settings'} className="mdl-menu__item"><i className="ki ki-settings"></i> {t('Profile Settings')}</a></li>
              {leaveBetaUrl ?
                <li><a href={leaveBetaUrl} className="mdl-menu__item">{t('leave beta')}</a></li>
              :null}
              <li className="k-lang__submenu">
                <a className="mdl-menu__item"><i className="ki ki-language"></i> {t('Language')}</a>
                <ul>
                  {langs.map(this.renderLangItem)}
                </ul>
              </li>
              <li><a onClick={this.logout} className="mdl-menu__item"><i className="ki ki-logout"></i> {t('Logout')}</a></li>
            </ul>
          </bem.AccountBox__name>
        </bem.AccountBox>
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
            { this.state.headerFilters == 'library' && 
              <ListSearch searchContext={this.state.libraryFiltersContext} />
            }
            { this.state.headerFilters == 'library' && 
              <ListTagFilter searchContext={this.state.libraryFiltersContext} />
            }
            { this.state.headerFilters == 'forms' && 
              <ListSearch searchContext={this.state.formFiltersContext} />
            }
            { this.state.headerFilters == 'forms' && 
              <ListTagFilter searchContext={this.state.formFiltersContext} />
            }

            {this.renderAccountNavMenu()}
          </div>
        </header>
      );
  },
  componentDidUpdate() {
    mdl.upgradeDom();
  },
  componentWillReceiveProps() {
    this.setStates();
  }
});

export default MainHeader;
