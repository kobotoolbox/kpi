import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import { hashHistory } from 'react-router';
import PopoverMenu from 'js/popoverMenu';
import {stores} from '../stores';
import Reflux from 'reflux';
import bem from 'js/bem';
import {actions} from '../actions';
import mixins from '../mixins';
import {dataInterface} from '../dataInterface';
import {
  assign,
  currentLang,
  stringToColor,
} from 'utils';
import {getLoginUrl} from 'js/router/routerUtils';
import {getAssetIcon} from 'js/assetUtils';
import {COMMON_QUERIES} from 'js/constants';
import {ROUTES} from 'js/router/routerConstants';
import {searches} from '../searches';
import {ListSearch} from '../components/list';
import HeaderTitleEditor from 'js/components/header/headerTitleEditor';
import SearchBox from 'js/components/header/searchBox';
import myLibraryStore from 'js/components/library/myLibraryStore';
import envStore from 'js/envStore';

class MainHeader extends Reflux.Component {
  constructor(props){
    super(props);
    this.state = assign({
      asset: false,
      currentLang: currentLang(),
      isLanguageSelectorVisible: false,
      formFiltersContext: searches.getSearchContext('forms', {
        filterParams: {
          assetType: COMMON_QUERIES.s,
        },
        filterTags: COMMON_QUERIES.s,
      }),
    }, stores.pageState.state);
    this.stores = [
      stores.session,
      stores.pageState,
    ];
    this.unlisteners = [];
    autoBind(this);
  }

  componentDidMount() {
    this.unlisteners.push(
      stores.asset.listen(this.onAssetLoad),
      myLibraryStore.listen(this.forceRender)
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  /*
   * NOTE: this should be updated to `getDerivedStateFromProps` but causes Error:
   * Warning: Unsafe legacy lifecycles will not be called for components using new component APIs.
   * MainHeader uses getDerivedStateFromProps() but also contains the following legacy lifecycles:
   * componentWillMount
   */
  componentWillUpdate(newProps) {
    if (this.props.assetid !== newProps.assetid) {
      this.setState({asset: false});
      // we need new asset here, but instead of duplicating a call, we wait for
      // action triggered by other component (route component)
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.assetid !== this.props.assetid && this.props.assetid !== null) {
      actions.resources.loadAsset({id: this.props.assetid});
    }
  }

  forceRender() {
    this.setState(this.state);
  }

  isSearchBoxDisabled() {
    if (this.isMyLibrary()) {
      // disable search when user has zero assets
      return myLibraryStore.getCurrentUserTotalAssets() === null;
    } else {
      return false;
    }
  }

  onAssetLoad(data) {
    const asset = data[this.props.assetid];
    this.setState(assign({asset: asset}));
  }

  logout() {
    actions.auth.logout();
  }

  toggleLanguageSelector() {
    this.setState({isLanguageSelectorVisible: !this.state.isLanguageSelectorVisible});
  }

  accountSettings() {
    // verifyLogin also refreshes stored profile data
    actions.auth.verifyLogin.triggerAsync().then(() => {
      hashHistory.push(ROUTES.ACCOUNT_SETTINGS);
    });
  }

  languageChange(evt) {
    evt.preventDefault();
    let langCode = $(evt.target).data('key');
    if (langCode) {
      // use .always (instead of .done) here since Django 1.8 redirects the request
      dataInterface.setLanguage({language: langCode}).always(() => {
        if ('reload' in window.location) {
          window.location.reload();
        } else {
          window.alert(t('Please refresh the page'));
        }
      });
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

  renderLoginButton() {
    return (
      <bem.LoginBox>
        <a
          href={getLoginUrl()}
          className='kobo-button kobo-button--blue'
        >
          {t('Log In')}
        </a>
      </bem.LoginBox>
    );
  }

  renderAccountNavMenu() {
    let shouldDisplayUrls = false;
    if (
      envStore.isReady &&
      typeof envStore.data.terms_of_service_url === 'string' &&
      typeof envStore.data.terms_of_service_url.length >= 1
    ) {
      shouldDisplayUrls = true;
    }
    if (
      envStore.isReady &&
      typeof envStore.data.privacy_policy_url === 'string' &&
      typeof envStore.data.privacy_policy_url.length >= 1
    ) {
      shouldDisplayUrls = true;
    }

    let langs = [];
    if (envStore.isReady && envStore.data.interface_languages) {
      langs = envStore.data.interface_languages;
    }
    if (stores.session.isLoggedIn) {
      var accountName = stores.session.currentAccount.username;
      var accountEmail = stores.session.currentAccount.email;

      var initialsStyle = {background: `#${stringToColor(accountName)}`};
      var accountMenuLabel = <bem.AccountBox__initials style={initialsStyle}>{accountName.charAt(0)}</bem.AccountBox__initials>;

      return (
        <bem.AccountBox>
          <PopoverMenu type='account-menu'
                          triggerLabel={accountMenuLabel}
                          buttonType='text'>
              <bem.AccountBox__menu>
                <bem.AccountBox__menuLI key='1'>
                  <bem.AccountBox__menuItem m={'avatar'}>
                    {accountMenuLabel}
                  </bem.AccountBox__menuItem>
                  <bem.AccountBox__menuItem m={'mini-profile'}>
                    <span className='account-username'>{accountName}</span>
                    <span className='account-email'>{accountEmail}</span>
                  </bem.AccountBox__menuItem>
                  <bem.AccountBox__menuItem m={'settings'}>
                    <bem.KoboButton onClick={this.accountSettings} m={['blue', 'fullwidth']}>
                      {t('Account Settings')}
                    </bem.KoboButton>
                  </bem.AccountBox__menuItem>
                </bem.AccountBox__menuLI>
                {shouldDisplayUrls &&
                  <bem.AccountBox__menuLI key='2' className='environment-links'>
                    {envStore.data.terms_of_service_url &&
                      <a href={envStore.data.terms_of_service_url} target='_blank'>
                        {t('Terms of Service')}
                      </a>
                    }
                    {envStore.data.privacy_policy_url &&
                      <a href={envStore.data.privacy_policy_url} target='_blank'>
                        {t('Privacy Policy')}
                      </a>
                    }
                  </bem.AccountBox__menuLI>
                }
                <bem.AccountBox__menuLI m={'lang'} key='3'>
                  <bem.AccountBox__menuLink onClick={this.toggleLanguageSelector} data-popover-menu-stop-blur tabIndex='0'>
                    <i className='k-icon k-icon-language' />
                    {t('Language')}
                  </bem.AccountBox__menuLink>

                  {this.state.isLanguageSelectorVisible &&
                    <ul>
                      {langs.map(this.renderLangItem)}
                    </ul>
                  }
                </bem.AccountBox__menuLI>
                <bem.AccountBox__menuLI m={'logout'} key='4'>
                  <bem.AccountBox__menuLink onClick={this.logout}>
                    <i className='k-icon k-icon-logout' />
                    {t('Logout')}
                  </bem.AccountBox__menuLink>
                </bem.AccountBox__menuLI>
              </bem.AccountBox__menu>
          </PopoverMenu>
        </bem.AccountBox>
      );
    }

    return null;
  }

  renderGitRevInfo() {
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

  render() {
    const isLoggedIn = stores.session.isLoggedIn;

    let userCanEditAsset = false;
    if (this.state.asset) {
      userCanEditAsset = this.userCan('change_asset', this.state.asset);
    }

    let iconClassName = '';
    if (this.state.asset) {
      iconClassName = getAssetIcon(this.state.asset);
    }

    let librarySearchBoxPlaceholder = t('Search My Library');
    if (this.isPublicCollections()) {
      librarySearchBoxPlaceholder = t('Search Public Collections');
    }

    return (
        <bem.MainHeader className='mdl-layout__header'>
          <div className='mdl-layout__header-row'>
            {stores.session.isLoggedIn &&
              <bem.Button m='icon' onClick={this.toggleFixedDrawer}>
                <i className='k-icon k-icon-menu' />
              </bem.Button>
            }
            <span className='mdl-layout-title'>
              <a href='/'>
                <bem.Header__logo />
              </a>
            </span>
            { isLoggedIn && this.isFormList() &&
              <div className='mdl-layout__header-searchers'>
                <ListSearch searchContext={this.state.formFiltersContext} placeholderText={t('Search Projects')} />
              </div>
            }
            { isLoggedIn && (this.isMyLibrary() || this.isPublicCollections()) &&
              <div className='mdl-layout__header-searchers'>
                <SearchBox
                  placeholder={librarySearchBoxPlaceholder}
                  disabled={this.isSearchBoxDisabled()}
                />
              </div>
            }
            { !this.isLibrary() && this.state.asset && this.isFormSingle() &&
              <React.Fragment>
                <bem.MainHeader__icon className={iconClassName} />

                <HeaderTitleEditor
                  asset={this.state.asset}
                  isEditable={userCanEditAsset}
                />

                { this.isFormSingle() && this.state.asset.has_deployment &&
                  <bem.MainHeader__counter>
                    {this.state.asset.deployment__submission_count} {t('submissions')}
                  </bem.MainHeader__counter>
                }
              </React.Fragment>
            }
            {this.renderAccountNavMenu()}
            { !isLoggedIn && this.renderLoginButton()}
          </div>
          {this.renderGitRevInfo()}
        </bem.MainHeader>
      );
  }
}

reactMixin(MainHeader.prototype, Reflux.ListenerMixin);
reactMixin(MainHeader.prototype, mixins.contextRouter);
reactMixin(MainHeader.prototype, mixins.permissions);

MainHeader.contextTypes = {router: PropTypes.object};

export default MainHeader;
