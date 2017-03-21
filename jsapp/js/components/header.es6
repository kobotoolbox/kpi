import React from 'react/addons';
import {Link,Navigation} from 'react-router';
import mdl from '../libs/rest_framework/material';
import Select from 'react-select';
import moment from 'moment';
import alertify from 'alertifyjs';
import ui from '../ui';

import stores from '../stores';
import Reflux from 'reflux';
import bem from '../bem';
import actions from '../actions';
import {
  t,
  assign,
  currentLang,
  LANGUAGE_COOKIE_NAME,
  stringToColor,
} from '../utils';
import searches from '../searches';
import cookie from 'react-cookie';
import hotkey from 'react-hotkey';
import AutosizeInput from 'react-input-autosize';

hotkey.activate();

import {
  ListSearch,
  ListTagFilter,
} from '../components/list';

var leaveBetaUrl = stores.pageState.leaveBetaUrl;
var cookieDomain = stores.pageState.cookieDomain;
let typingTimer;

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
    Navigation
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
      showFormViewHeader: false,
      dataPopoverShowing: false, 
      asset: false,
      currentLang: currentLang(),
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
  assetLoad(data) {
    var asset = data[this.state.assetid];
    this.setState(assign({
        asset: asset
      }
    ));
  },
  logout () {
    actions.auth.logout();
  },
  accountSettings () {
    this.transitionTo('account-settings');
  },
  setStates() {
    this.listenTo(stores.asset, this.assetLoad);

    var currentParams = this.context.router.getCurrentParams();
    this.setState(assign(currentParams));

    var currentRoutes = this.context.router.getCurrentRoutes();
    var activeRoute = currentRoutes[currentRoutes.length - 1];

    switch(activeRoute.path) {
      case '/forms':
        this.setState({headerFilters: 'forms'});
        break;
      case '/library':
        this.setState({headerFilters: 'library'});
        break;
      default:
        this.setState({headerFilters: false});
        break;
    }

    if (currentRoutes[2] != undefined && currentRoutes[2].path == '/forms/:assetid') {
      this.setState({
        showFormViewHeader: true, 
        activeRoute: activeRoute.path
      });
    } else {
      this.setState({
        showFormViewHeader: false, 
        activeRoute: false
      });    
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
      <li key={lang.value}>
        <a data-key={lang.value} onClick={this.languageChange}
          className="mdl-menu__item">{lang.label}</a>
      </li>
    );
  },
  toggleAccountMenuPopover (evt) {
    var isBlur = evt.type === 'blur',
        $popoverMenu;
    if (this.state.accountMenuPopoverShowing || isBlur) {
      if (this.refs['accountMenu-popover'] != undefined) {
        $popoverMenu = $(this.refs['accountMenu-popover'].getDOMNode());
        // if we setState and immediately hide popover then the
        // links will not register as clicked
        $popoverMenu.fadeOut(250, () => {
          this.setState({
            accountMenuPopoverShowing: false,
          });
        });
      }
    } else {
      this.setState({
        accountMenuPopoverShowing: true,
      });
    }
  },

  renderAccountNavMenu () {
    var langs = [];

    if (stores.session.currentAccount) {
      var accountName = stores.session.currentAccount.username;
      langs = stores.session.currentAccount.languages;

      var initialsStyle = {background: `#${stringToColor(accountName)}`};
      var accountMenuLabel = <bem.AccountBox__initials style={initialsStyle}>{accountName.charAt(0)}</bem.AccountBox__initials>;

      return (
        <bem.AccountBox>
          <bem.AccountBox__notifications className="is-edge">
            <i className="fa fa-bell"></i> 
            <bem.AccountBox__notifications__count>
              2 
            </bem.AccountBox__notifications__count>
          </bem.AccountBox__notifications>
          <ui.PopoverMenu type='account-menu' 
                          triggerLabel={accountMenuLabel} 
                          buttonType='text'>
              <ul className="k-account__menu">
                <li className="k-account__submenu" key="settings">
                  <a onClick={this.accountSettings} className="mdl-menu__item">
                    <i className="k-icon-settings" />
                    {t('Account Settings')}
                  </a>
                </li>
                {leaveBetaUrl ?
                  <li>
                    <a href={leaveBetaUrl} className="mdl-menu__item">
                      <i className="k-icon-settings" />
                      {t('Leave Beta')}
                    </a>
                  </li>
                :null}
                <li className="k-lang__submenu" key="lang">
                  <a className="mdl-menu__item">
                    <i className="k-icon-globe" />
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
          </ui.PopoverMenu>
        </bem.AccountBox>
        );
    }

    return (
          <span>{t('not logged in')}</span>
    );
  },
  renderGitRevInfo () {
    if (stores.session.currentAccount && stores.session.currentAccount.git_rev) {
      var gitRev = stores.session.currentAccount.git_rev;
      return (
        <bem.GitRev>
          <bem.GitRev__item>
            branch: {gitRev.branch}
          </bem.GitRev__item>
          <bem.GitRev__item>
            commit: {gitRev.short}
          </bem.GitRev__item>
        </bem.GitRev>
      );
    }

    return false;
  },
  toggleFixedDrawer() {
    stores.pageState.toggleFixedDrawer();
  },
  // showDowntimeNotificationBox () {
  //   stores.pageState.showModal({
  //     message: stores.session.currentAccount.downtimeMessage,
  //     icon: 'gears',
  //   });
  // },
  assetTitleChange (e) {
    var asset = this.state.asset;
    if (e.target.name == 'title')
      asset.name = e.target.value;
    else
      asset.settings.description = e.target.value;

    this.setState({
      asset: asset
    });

    clearTimeout(typingTimer);

    typingTimer = setTimeout(() => { 
      if (!this.state.asset.name.trim()) {
        alertify.error(t('Please enter a title for your project'));
      } else {
        actions.resources.updateAsset(
          this.state.asset.uid,
          {
            name: this.state.asset.name,
            settings: JSON.stringify({
              description: this.state.asset.settings.description,
            }),
          }
        );
      }
    }, 1500);

  },
  userCanEditAsset() {
    if (stores.session.currentAccount && this.state.asset) {
      const currentAccount = stores.session.currentAccount;
      if (currentAccount.is_superuser || currentAccount.username == this.state.asset.owner__username || this.state.asset.access.change[currentAccount.username])
        return true;
    }

    return false;
  },
  render () {
    if (stores.session && stores.session.currentAccount && stores.session.currentAccount.downtimeDate) {
      var mTime = moment(stores.session.currentAccount.downtimeDate);
      var downtimeDate = `${mTime.fromNow()} (${mTime.calendar()})`;
      var downtimeMessage = [t('Scheduled server maintenance'), downtimeDate];
    }

    var userCanEditAsset = this.userCanEditAsset();

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
              <div className="account-box__alert">
                <strong>{downtimeMessage[0]}</strong>
                <br />
                {downtimeMessage[1]}
              </div>
            :null}
            {this.state.headerFilters && 
              <div className="mdl-layout__header-searchers">
                { this.state.headerFilters == 'library' && 
                  <ListSearch searchContext={this.state.libraryFiltersContext} placeholderText={t('Search Library')} />
                }
                { this.state.headerFilters == 'forms' && 
                  <ListSearch searchContext={this.state.formFiltersContext} placeholderText={t('Search Projects')} />
                }
              </div>
            }
            { this.state.showFormViewHeader && !this.state.headerFilters && this.state.asset &&
              <bem.FormTitle>
                { this.state.asset.has_deployment ?
                  <i className="k-icon-deployed" />
                :
                  <i className="k-icon-drafts" />
                }
                <bem.FormTitle__name data-tip={t('click to edit')} className="hide-tooltip__onfocus">
                  <AutosizeInput type="text"
                        name="title"
                        placeholder={userCanEditAsset ? t('Project title') : ''}
                        value={this.state.asset.name ? this.state.asset.name : ''}
                        onChange={this.assetTitleChange}
                        disabled={!userCanEditAsset}
                  />
                </bem.FormTitle__name>
                { this.state.asset.has_deployment &&
                  <bem.FormTitle__submissions>
                    {this.state.asset.deployment__submission_count} {t('submissions')}
                  </bem.FormTitle__submissions>
                }
              </bem.FormTitle>
            }
            {this.renderAccountNavMenu()}
          </div>
          {this.renderGitRevInfo()}
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
