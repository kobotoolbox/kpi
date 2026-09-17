import React from 'react'

import type { Mixin } from 'create-react-class'
import autoBind from 'react-autobind'
import reactMixin from 'react-mixin'
import { NavLink } from 'react-router-dom'
import Reflux from 'reflux'
import assetStore from '#/assetStore'
import bem from '#/bem'
import { PERMISSIONS_CODENAMES } from '#/components/permissions/permConstants'
import { userCan } from '#/components/permissions/utils'
import type { AssetResponse } from '#/dataInterface'
import { type WithRouterProps, withRouter } from '#/router/legacy'
import { ROUTES } from '#/router/routerConstants'
import mixins from '../mixins'

export interface FormViewSideTab {
  label: string
  icon: string
  path: string
  isDisabled?: boolean
}

export interface FormViewSideTabsProps extends WithRouterProps {
  show: boolean
}

interface FormViewSideTabsState {
  asset?: AssetResponse
}

export function getFormDataTabs(assetUid: string): FormViewSideTab[] {
  return [
    {
      label: t('Table'),
      icon: 'k-icon k-icon-table',
      path: ROUTES.FORM_TABLE.replace(':uid', assetUid),
    },
    {
      label: t('Reports'),
      icon: 'k-icon k-icon-reports',
      path: ROUTES.FORM_REPORT.replace(':uid', assetUid),
    },
    {
      label: t('Gallery'),
      icon: 'k-icon k-icon-gallery',
      path: ROUTES.FORM_GALLERY.replace(':uid', assetUid),
    },
    {
      label: t('Downloads'),
      icon: 'k-icon k-icon-download',
      path: ROUTES.FORM_DOWNLOADS.replace(':uid', assetUid),
    },
    {
      label: t('Map'),
      icon: 'k-icon k-icon-map-view',
      path: ROUTES.FORM_MAP.replace(':uid', assetUid),
    },
  ]
}

class FormViewSideTabs extends Reflux.Component<typeof Reflux.Store, FormViewSideTabsProps, FormViewSideTabsState> {
  // Stub functions for cleaner reference
  declare currentAssetID: () => string | undefined
  declare isActiveRoute: (path: string) => boolean

  unlisteners: Function[] = []

  constructor(props: FormViewSideTabsProps) {
    super(props)
    this.state = {}
    autoBind(this)
  }

  componentDidMount() {
    // On initial load use the possibly stored asset.
    const assetUid = this.currentAssetID()
    if (assetUid) {
      this.setState({ asset: assetStore.getAsset(assetUid) })
    }
    this.unlisteners.push(assetStore.listen(this.assetLoad, this))
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb()
    })
  }

  assetLoad(data: Record<string, AssetResponse>) {
    const assetUid = this.currentAssetID()
    if (assetUid) {
      this.setState({ asset: data[assetUid] })
    }
  }

  triggerRefresh(evt: React.MouseEvent<HTMLAnchorElement>) {
    if (evt.currentTarget.classList.contains('active') && this.state.asset) {
      this.props.router.navigate(ROUTES.FORM_RESET.replace(':uid', this.state.asset.uid))

      const path = evt.currentTarget.dataset.path
      if (path) {
        window.setTimeout(() => {
          this.props.router.navigate(path)
        }, 50)
      }

      evt.preventDefault()
    }
  }

  renderFormSideTabs(): React.ReactNode {
    let sideTabs: FormViewSideTab[] = []

    if (
      this.state.asset &&
      this.state.asset.has_deployment &&
      this.isActiveRoute(ROUTES.FORM_DATA.replace(':uid', this.state.asset.uid))
    ) {
      sideTabs = getFormDataTabs(this.state.asset.uid)
    }

    if (this.state.asset && this.isActiveRoute(ROUTES.FORM_SETTINGS.replace(':uid', this.state.asset.uid))) {
      sideTabs = []

      sideTabs.push({
        label: t('General'),
        icon: 'k-icon k-icon-settings',
        path: ROUTES.FORM_SETTINGS.replace(':uid', this.state.asset.uid),
      })

      if (userCan(PERMISSIONS_CODENAMES.change_asset, this.state.asset)) {
        sideTabs.push({
          label: t('Media'),
          icon: 'k-icon k-icon-gallery',
          path: ROUTES.FORM_MEDIA.replace(':uid', this.state.asset.uid),
        })
      }

      if (userCan(PERMISSIONS_CODENAMES.manage_asset, this.state.asset)) {
        sideTabs.push({
          label: t('Sharing'),
          icon: 'k-icon k-icon-user-share',
          path: ROUTES.FORM_SHARING.replace(':uid', this.state.asset.uid),
        })
      }

      if (userCan(PERMISSIONS_CODENAMES.manage_asset, this.state.asset)) {
        sideTabs.push({
          label: t('Connect Projects'),
          icon: 'k-icon k-icon-attach',
          path: ROUTES.FORM_RECORDS.replace(':uid', this.state.asset.uid),
        })
      }

      if (
        (this.state.asset.deployment__active ||
          // REST services should be visible for archived forms but not drafts
          this.state.asset.deployed_versions.count > 0) &&
        userCan(PERMISSIONS_CODENAMES.view_submissions, this.state.asset) &&
        userCan(PERMISSIONS_CODENAMES.change_asset, this.state.asset)
      ) {
        sideTabs.push({
          label: t('REST Services'),
          icon: 'k-icon k-icon-data-sync',
          path: ROUTES.FORM_REST.replace(':uid', this.state.asset.uid),
        })
      }

      if (userCan(PERMISSIONS_CODENAMES.manage_asset, this.state.asset)) {
        sideTabs.push({
          label: t('Activity'),
          icon: 'k-icon k-icon-document',
          path: ROUTES.FORM_ACTIVITY.replace(':uid', this.state.asset.uid),
        })
      }
    }

    if (sideTabs.length > 0) {
      return (
        <bem.FormView__sidetabs>
          {sideTabs.map((item, ind) => {
            let className = 'form-view__tab'
            if (item.isDisabled) {
              className += ' form-view__tab--disabled'
            }
            return (
              <NavLink
                to={item.path}
                key={ind}
                className={className}
                data-path={item.path}
                onClick={this.triggerRefresh}
                end
              >
                <i className={`k-icon ${item.icon}`} />
                <span className='form-view__tab-name'>{item.label}</span>
              </NavLink>
            )
          })}
        </bem.FormView__sidetabs>
      )
    }

    return false
  }

  render(): React.ReactNode {
    if (!this.props.show) {
      return false
    }
    return this.renderFormSideTabs()
  }
}

reactMixin(FormViewSideTabs.prototype, Reflux.ListenerMixin as unknown as Mixin<any, any>)
reactMixin(FormViewSideTabs.prototype, mixins.contextRouter)

export default withRouter(FormViewSideTabs)
