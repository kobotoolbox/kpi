import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import { hashHistory } from 'react-router';
import Select from 'react-select';
import alertify from 'alertifyjs';
import ui from '../ui';

import stores from '../stores';
import Reflux from 'reflux';
import bem from '../bem';
import actions from '../actions';
import mixins from '../mixins';
import {
  t,
  assign,
  currentLang,
  LANGUAGE_COOKIE_NAME,
  stringToColor,
} from '../utils';
import searches from '../searches';
import cookie from 'react-cookie';

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

class MainHeader extends Reflux.Component {
  constructor(props){
    super(props);
    this.state = assign({
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
      _langIndex: 0
    }, stores.pageState.state);
    this.stores = [
      stores.session,
      stores.pageState
    ];
    autoBind(this);
  }
  getInitialState () {
    this.listenTo(stores.session, ({currentAccount}) => {
      this.setState({
        languages: currentAccount.languages,
      });
    });

    return assign({
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
      _langIndex: 0
    }, stores.pageState.state);
  }
  componentDidMount() {
    document.body.classList.add('hide-edge');
    this.listenTo(stores.asset, this.assetLoad);
  }
  assetLoad(data) {
    var assetid = this.props.assetid;
    var asset = data[assetid];

    this.setState(assign({
        asset: asset
      }
    ));
  }
  logout () {
    actions.auth.logout();
  }
  accountSettings () {
    // verifyLogin also refreshes stored profile data
    actions.auth.verifyLogin.triggerAsync().then(() => {
      hashHistory.push('account-settings');
    });
  }
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
  }
  renderLangItem(lang) {
    return (
      <bem.AccountBox__menuLI key={lang.value}>
        <bem.AccountBox__menuLink onClick={this.languageChange} data-key={lang.value}>
          {lang.label}
        </bem.AccountBox__menuLink>
      </bem.AccountBox__menuLI>
    );
  }
  renderAccountNavMenu () {
    var langs = [];

    if (stores.session.currentAccount) {
      var accountName = stores.session.currentAccount.username;
      var accountEmail = stores.session.currentAccount.email;
      langs = stores.session.currentAccount.languages;

      var initialsStyle = {background: `#${stringToColor(accountName)}`};
      var accountMenuLabel = <bem.AccountBox__initials style={initialsStyle}>{accountName.charAt(0)}</bem.AccountBox__initials>;

      return (
        <bem.AccountBox>
          {/*<bem.AccountBox__notifications className="is-edge">
            <i className="fa fa-bell"></i> 
            <bem.AccountBox__notifications__count> 2 </bem.AccountBox__notifications__count>
          </bem.AccountBox__notifications>*/}
          <ui.PopoverMenu type='account-menu' 
                          triggerLabel={accountMenuLabel} 
                          buttonType='text'>
              <bem.AccountBox__menu>
                <bem.AccountBox__menuLI key='1'>
                  <bem.AccountBox__menuItem m={'avatar'}>
                    {accountMenuLabel} 
                  </bem.AccountBox__menuItem>
                  <bem.AccountBox__menuItem m={'mini-profile'}>
                    <span className="account-username">{accountName}</span>
                    <span className="account-email">{accountEmail}</span>
                  </bem.AccountBox__menuItem>
                  <bem.AccountBox__menuItem m={'settings'}>
                    <button onClick={this.accountSettings} className="mdl-button mdl-button--raised mdl-button--colored">
                      {t('Account Settings')}
                    </button>
                  </bem.AccountBox__menuItem>
                </bem.AccountBox__menuLI>
                <bem.AccountBox__menuLI m={'lang'} key='2'>
                  <bem.AccountBox__menuLink>
                    <i className="k-icon-language" /> 
                    {t('Language')}
                  </bem.AccountBox__menuLink>
                  <ul>
                    {langs.map(this.renderLangItem)}
                  </ul>
                </bem.AccountBox__menuLI>
                <bem.AccountBox__menuLI m={'logout'} key='3'>
                  <bem.AccountBox__menuLink onClick={this.logout}>
                    <i className="k-icon-logout" /> 
                    {t('Logout')}
                  </bem.AccountBox__menuLink>
                </bem.AccountBox__menuLI>
              </bem.AccountBox__menu>
          </ui.PopoverMenu>
        </bem.AccountBox>
        );
    }

    return (
          <span>{t('not logged in')}</span>
    );
  }
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
  }
  toggleFixedDrawer() {
    stores.pageState.toggleFixedDrawer();
  }
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

  }
  render () {
    var userCanEditAsset = false;
    if (this.state.asset)
      userCanEditAsset = this.userCan('change_asset', this.state.asset);

    return (
        <header className="mdl-layout__header">
          <div className="mdl-layout__header-row">
            <button className="mdl-button mdl-button--icon" onClick={this.toggleFixedDrawer}>
              <i className="fa fa-bars"></i>
            </button>
            <span className='mdl-layout-title'>
              <a href='/'>
                <bem.Header__logo />
              </a>
            </span>
            { this.isFormList() && 
              <div className="mdl-layout__header-searchers">
                <ListSearch searchContext={this.state.formFiltersContext} placeholderText={t('Search Projects')} />
              </div>
            }
            { this.isLibrary() && 
              <div className="mdl-layout__header-searchers">
                <ListSearch searchContext={this.state.libraryFiltersContext} placeholderText={t('Search Library')} />
              </div>
            }
            { this.isFormSingle() && this.state.asset &&
              <bem.FormTitle>
                { this.state.asset.has_deployment ?
                  <i className="k-icon-deploy" />
                :
                  <i className="k-icon-drafts" />
                }
                <bem.FormTitle__name>
                  <input type="text"
                        name="title"
                        placeholder={t('Project title')}
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
  }
  componentWillReceiveProps(nextProps) {
    if (this.props.assetid != nextProps.assetid && nextProps.assetid != null)
      actions.resources.loadAsset({id: nextProps.assetid});
  }
};

reactMixin(MainHeader.prototype, Reflux.ListenerMixin);
reactMixin(MainHeader.prototype, mixins.contextRouter);
reactMixin(MainHeader.prototype, mixins.permissions);

MainHeader.contextTypes = {
  router: PropTypes.object
};

export default MainHeader;
