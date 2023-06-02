import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import {observer} from 'mobx-react';
import autoBind from 'react-autobind';
import {stores} from 'js/stores';
import sessionStore from 'js/stores/session';
import assetStore from 'js/assetStore';
import {withRouter} from 'js/router/legacy';
import Reflux from 'reflux';
import bem from 'js/bem';
import {actions} from 'js/actions';
import mixins from 'js/mixins';
import {assign} from 'js/utils';
import {getLoginUrl, isAnyProjectsViewRoute} from 'js/router/routerUtils';
import {getAssetIconName} from 'js/assetUtils';
import HeaderTitleEditor from 'js/components/header/headerTitleEditor';
import SearchBox from 'js/components/header/searchBox';
import myLibraryStore from 'js/components/library/myLibraryStore';
import {userCan} from 'js/components/permissions/utils';
import AccountMenu from './accountMenu';

const MainHeader = class MainHeader extends Reflux.Component {
  constructor(props) {
    super(props);
    this.state = assign({
      asset: false,
    }, stores.pageState.state);
    this.stores = [
      stores.pageState,
    ];
    this.unlisteners = [];
    autoBind(this);
  }

  componentDidMount() {
    // On initial load use the possibly stored asset.
    this.setState({asset: assetStore.getAsset(this.currentAssetID())});

    this.unlisteners.push(
      assetStore.listen(this.onAssetLoad, this),
      myLibraryStore.listen(this.forceRender, this)
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

  renderGitRevInfo() {
    if (sessionStore.currentAccount?.git_rev) {
      const gitRev = sessionStore.currentAccount.git_rev;
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
      userCanEditAsset = userCan('change_asset', this.state.asset);
    }

    let iconClassName = '';
    if (this.state.asset) {
      iconClassName = `k-icon-${getAssetIconName(this.state.asset)}`;
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

            {/* Things for Library */}
            { isLoggedIn && (this.isMyLibrary() || this.isPublicCollections()) &&
              <div className='mdl-layout__header-searchers'>
                <SearchBox
                  placeholder={librarySearchBoxPlaceholder}
                  disabled={this.isSearchBoxDisabled()}
                />
              </div>
            }

            {/* Things for My Projects and any Custom View */}
            { isLoggedIn && isAnyProjectsViewRoute() &&
              <div className='mdl-layout__header-searchers'>
                <SearchBox
                  placeholder={t('Search…')}
                  disabled={this.isSearchBoxDisabled()}
                />
              </div>
            }

            {/* Things for Project */}
            {this.state.asset && this.isFormSingle() &&
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

            <AccountMenu />

            { !isLoggedIn && this.renderLoginButton()}
          </div>
          {this.renderGitRevInfo()}
        </bem.MainHeader>
      );
  }
};

reactMixin(MainHeader.prototype, Reflux.ListenerMixin);
reactMixin(MainHeader.prototype, mixins.contextRouter);

MainHeader.contextTypes = {router: PropTypes.object};

export default observer(withRouter(MainHeader));
