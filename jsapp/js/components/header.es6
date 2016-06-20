import React from 'react/addons';
import {Link} from 'react-router';
import mdl from '../libs/rest_framework/material';
import Select from 'react-select';
import moment from 'moment';
import ui from '../ui';

import stores from '../stores';
import Reflux from 'reflux';
import bem from '../bem';
import actions from '../actions';
import {t, assign} from '../utils';
import searches from '../searches';
import cookie from 'react-cookie';
import hotkey from 'react-hotkey';

hotkey.activate();

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
    hotkey.Mixin('handleHotkey'),
  ],
  handleHotkey: function(e) {
    if (e.altKey && (e.keyCode == '69' || e.keyCode == '186')) {
      document.body.classList.toggle('hide-edge');
    }
  },
  getInitialState () {
    this.listenTo(stores.session, ({currentAccount}) => {
      this.setState({
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
    document.body.classList.add('hide-edge');
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
      if ('reload' in window.location) {
        window.location.reload();
      } else {
        window.alert(t('Please refresh the page'));
      }
    }
  },
  renderLangItem(lang) {
    return (
      <li key={lang[0]}>
        <a data-key={lang[0]} onClick={this.languageChange} className="mdl-menu__item">{lang[1]}</a>
      </li>
    );
  },
  renderAccountNavMenu () {
    var defaultGravatarImage = `${window.location.protocol}//www.gravatar.com/avatar/64e1b8d34f425d19e1ee2ea7236d3028?s=40`;
    var langs = [];

    if (stores.session.currentAccount) {
      var accountName = stores.session.currentAccount.username;
      var gravatar = stores.session.currentAccount.gravatar || defaultGravatarImage;

      langs = stores.session.currentAccount.languages;
      return (
        <bem.AccountBox>
          <bem.AccountBox__notifications className="is-edge">
            <i className="fa fa-bell"></i> 
            <bem.AccountBox__notifications__count>
              2 
            </bem.AccountBox__notifications__count>
          </bem.AccountBox__notifications>
          <bem.AccountBox__name>
            <span>{accountName}</span>
            <bem.AccountBox__image>
              <img src={gravatar} />
            </bem.AccountBox__image>
            <ul className="k-account__menu">
              <li key="settings">
                <a href={stores.session.currentAccount.projects_url + '/settings'} className="mdl-menu__item">
                  <i className="k-icon-settings" />
                  {t('Profile Settings')}
                </a>
              </li>
              {leaveBetaUrl ?
                <li>
                  <a href={leaveBetaUrl} className="mdl-menu__item">
                    {t('leave beta')}
                  </a>
                </li>
              :null}
              <li className="k-lang__submenu" key="lang">
                <a className="mdl-menu__item">
                  <i className="fa fa-globe" />
                  {t('Language')}
                </a>
                <ul>
                  {langs.map(this.renderLangItem)}
                </ul>
              </li>
              <li key="logout">
                <a onClick={this.logout} className="mdl-menu__item">
                  <i className="k-icon-logout" /> 
                  {t('Logout')}</a>
                </li>
            </ul>
          </bem.AccountBox__name>
        </bem.AccountBox>
        );
    }

    return (
          <span>{t('not logged in')}</span>
    );
  },
  toggleFixedDrawer() {
    stores.pageState.toggleFixedDrawer();
  },
  showDowntimeNotificationBox () {
    stores.pageState.showModal({
      message: stores.session.currentAccount.downtimeMessage,
      icon: 'gears',
    });
  },
  render () {
    if (stores.session && stores.session.currentAccount && stores.session.currentAccount.downtimeDate) {
      var mTime = moment(stores.session.currentAccount.downtimeDate);
      var downtimeDate = `${mTime.fromNow()} (${mTime.calendar()})`;
      var downtimeMessage = [t('Scheduled server maintenance'), downtimeDate];
    }
    return (
        <header className="mdl-layout__header">
          <div className="mdl-layout__header-row">
            <button className="mdl-button mdl-button--icon k-burger" onClick={this.toggleFixedDrawer}>
            { this.state.showFixedDrawer ?
              <i className="fa fa-close"></i>
            : 
              <i className="fa fa-bars"></i>
            }
            </button>
            <span className='mdl-layout-title'>
              <a href='/'>
                <bem.AccountBox__logo />
              </a>
            </span>
            {downtimeMessage ?
              <div className="account-box__alert" onClick={this.showDowntimeNotificationBox}>
                <strong>{downtimeMessage[0]}</strong>
                <br />
                {downtimeMessage[1]}
              </div>
            :null}
            <div className="mdl-layout__header-searchers">
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
            </div>
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
