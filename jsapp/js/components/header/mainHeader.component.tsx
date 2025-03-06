import React from 'react'

import { observer } from 'mobx-react'
import assetStore from '#/assetStore'
import { getAssetIcon } from '#/assetUtils'
import bem from '#/bem'
import Button from '#/components/common/button'
import Icon from '#/components/common/icon'
import HeaderTitleEditor from '#/components/header/headerTitleEditor'
import OrganizationBadge from '#/components/header/organizationBadge.component'
import SearchBox from '#/components/header/searchBox'
import myLibraryStore from '#/components/library/myLibraryStore'
import { userCan } from '#/components/permissions/utils'
import type { AssetResponse } from '#/dataInterface'
import type { IconName } from '#/k-icons'
import pageState from '#/pageState.store'
import { router, withRouter } from '#/router/legacy'
import type { WithRouterProps } from '#/router/legacy'
import {
  getLoginUrl,
  isAnyFormRoute,
  isAnyProjectsViewRoute,
  isMyLibraryRoute,
  isPublicCollectionsRoute,
} from '#/router/routerUtils'
import sessionStore from '#/stores/session'
import AccountMenu from './accountMenu'
import GitRev from './gitRev.component'
import styles from './mainHeader.module.scss'
import MainHeaderBase from './mainHeaderBase.component'
import MainHeaderLogo from './mainHeaderLogo.component'

interface MainHeaderProps extends WithRouterProps {
  assetUid: string | null
}

/**
 * Multi-functional header element; to be used with a logged-in account.
 */
const MainHeader = class MainHeader extends React.Component<MainHeaderProps> {
  private unlisteners: Function[] = []

  componentDidMount() {
    // HACK: re-rendering this every time we navigate is not perfect. We need to
    // come up with a better solution.
    const routerUnlistener = router!.subscribe(() => this.forceUpdate())
    if (routerUnlistener) {
      this.unlisteners.push(routerUnlistener)
    }

    // Without much refactor, we ensure that the header re-renders itself,
    // whenever any linked store changes.
    this.unlisteners.push(
      assetStore.listen(() => this.forceUpdate(), this),
      myLibraryStore.listen(() => this.forceUpdate(), this),
    )
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb()
    })
  }

  isSearchBoxDisabled() {
    if (isMyLibraryRoute()) {
      // disable search when user has zero assets
      return myLibraryStore.getCurrentUserTotalAssets() === null
    } else {
      return false
    }
  }

  renderLoginButton() {
    return (
      <bem.LoginBox>
        <Button
          type='primary'
          size='l'
          label={t('Log In')}
          onClick={() => {
            window.location.assign(getLoginUrl())
          }}
        />
      </bem.LoginBox>
    )
  }

  toggleFixedDrawer() {
    pageState.toggleFixedDrawer()
  }

  render() {
    const isLoggedIn = sessionStore.isLoggedIn

    let asset: AssetResponse | undefined
    if (this.props.assetUid) {
      asset = assetStore.getAsset(this.props.assetUid)
    }

    let userCanEditAsset = false
    if (asset) {
      userCanEditAsset = userCan('change_asset', asset)
    }

    let iconName: IconName | undefined
    if (asset) {
      iconName = getAssetIcon(asset)
    }

    let librarySearchBoxPlaceholder = t('Search My Library')
    if (isPublicCollectionsRoute()) {
      librarySearchBoxPlaceholder = t('Search Public Collections')
    }

    return (
      <MainHeaderBase>
        <GitRev />

        {sessionStore.isLoggedIn && (
          <button className={styles.mobileMenuToggle} onClick={this.toggleFixedDrawer}>
            <Icon name='menu' size='xl' />
          </button>
        )}

        <MainHeaderLogo />

        {/* Things for Library */}
        {isLoggedIn && (isMyLibraryRoute() || isPublicCollectionsRoute()) && (
          <div className='mdl-layout__header-searchers'>
            <SearchBox placeholder={librarySearchBoxPlaceholder} disabled={this.isSearchBoxDisabled()} />
          </div>
        )}

        {/* Things for My Projects and any Custom View */}
        {isLoggedIn && isAnyProjectsViewRoute() && (
          <div className='mdl-layout__header-searchers'>
            <SearchBox placeholder={t('Search…')} disabled={this.isSearchBoxDisabled()} />
          </div>
        )}

        {/* Things for Project */}
        {asset && isAnyFormRoute() && (
          <React.Fragment>
            {iconName && (
              <bem.MainHeader__icon>
                <Icon name={iconName} />
              </bem.MainHeader__icon>
            )}

            <HeaderTitleEditor asset={asset} isEditable={userCanEditAsset} />
          </React.Fragment>
        )}

        <div className={styles.accountSection}>
          <div className={styles.badgeWrapper}>
            <OrganizationBadge color='dark-gray' />
          </div>
          <AccountMenu />
        </div>

        {!isLoggedIn && this.renderLoginButton()}
      </MainHeaderBase>
    )
  }
}

export default observer(withRouter(MainHeader))
