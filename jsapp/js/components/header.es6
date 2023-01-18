import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import { observer } from 'mobx-react';
import autoBind from 'react-autobind';
import PopoverMenu from 'js/popoverMenu';
import {stores} from '../stores';
import sessionStore from 'js/stores/session';
import assetStore from 'js/assetStore';
import { withRouter } from 'js/router/legacy';
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
import {ACCOUNT_ROUTES} from 'js/account/routes';
import HeaderTitleEditor from 'js/components/header/headerTitleEditor';
import SearchBox from 'js/components/header/searchBox';
import myLibraryStore from 'js/components/library/myLibraryStore';
import envStore from 'js/envStore';

const MainHeader = class MainHeader extends Reflux.Component {
  constructor(props){
    super(props);
    this.state = assign({
      asset: false,
      isLanguageSelectorVisible: false,
    }, stores.pageState.state);
    this.stores = [
      stores.pageState,
    ];
    this.unlisteners = [];
    autoBind(this);
  }

  componentDidMount() {
    // On initial load use the possibly stored asset.
    this.setState({asset: assetStore.getAsset(this.currentAssetID())})

    this.unlisteners.push(
      assetStore.listen(this.onAssetLoad),
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
    if (prevProps.assetid !== this.props.assetid && this.props && this.props.assetid) {
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
      this.props.router.navigate(ACCOUNT_ROUTES.ACCOUNT_SETTINGS);
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
    const currentLanguage = currentLang();
    return (
      <bem.AccountBox__menuLI key={lang.value}>
        <bem.AccountBox__menuLink onClick={this.languageChange} data-key={lang.value}>
          {lang.value === currentLanguage &&
            <strong>{lang.label}</strong>
          }
          {lang.value !== currentLanguage &&
            lang.label
          }
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
    if (sessionStore.isLoggedIn) {
      var accountName = sessionStore.currentAccount.username;
      var accountEmail = sessionStore.currentAccount.email;

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
    if (sessionStore.currentAccount && sessionStore.currentAccount.git_rev) {
      var gitRev = sessionStore.currentAccount.git_rev;
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
    const isLoggedIn = sessionStore.isLoggedIn;

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
            {sessionStore.isLoggedIn &&
              <bem.Button m='icon' onClick={this.toggleFixedDrawer}>
                <i className='k-icon k-icon-menu' />
              </bem.Button>
            }
            <span className='mdl-layout__title'>
              <a href='/'>
                <bem.Header__logo />
              </a>
            </span>
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

export default observer(withRouter(MainHeader));
