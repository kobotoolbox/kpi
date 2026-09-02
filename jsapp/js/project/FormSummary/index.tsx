import './FormSummary.scss'
import React from 'react'
import DocumentTitle from 'react-document-title'
import reactMixin from 'react-mixin'
import { Link, NavLink } from 'react-router-dom'
import { actions } from '#/actions'
import bem from '#/bem'
import Avatar from '#/components/common/avatar'
import Icon from '#/components/common/icon'
import { getFormDataTabs } from '#/components/formViewSideTabs'
import { openSharingModal } from '#/components/permissions/openSharingModal'
import { userCan } from '#/components/permissions/utils'
import LimitNotifications from '#/components/usageLimits/limitNotifications.component'
import { MODAL_TYPES } from '#/constants'
import type { AssetResponse, PermissionResponse } from '#/dataInterface'
import mixins from '#/mixins'
import pageState from '#/pageState.store'
import SubmissionsCountGraph from '#/project/submissionsCountGraph.component'
import { ANON_USERNAME, getUsernameFromUrl } from '#/users/utils'
import FormSummaryProjectInfo from './FormSummaryProjectInfo'

/**
 * `mixins.dmix` assigns the whole loaded asset onto this component's state, but the state starts out as an empty
 * object - hence all the asset properties being optional here.
 */
type FormSummaryState = Partial<AssetResponse>

class FormSummary extends React.Component<{}, FormSummaryState> {
  private unlisteners: Function[] = []

  constructor(props: {}) {
    super(props)
    this.state = {}
  }

  // Copying how sharingForm.component.tsx does their listeners
  componentDidMount() {
    this.unlisteners.push(
      actions.permissions.bulkSetAssetPermissions.completed.listen(this.onAssetPermissionsUpdated.bind(this)),
      // This is the call to listen to for the permissions list as a response after removing a user's permissions
      actions.permissions.getAssetPermissions.completed.listen(this.onAssetPermissionsUpdated.bind(this)),
    )
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb()
    })
  }

  onAssetPermissionsUpdated(permissionsResponse: PermissionResponse[]) {
    // HACK-FIX: "update" the state's permissions with the response from adding/removing all permissions from a user
    //
    // TODO: Replacing our permissions api logic with react query is the best solution, but in the meantime the
    // "Team members" component should updated based on changes made in the sharing modal
    this.setState({ permissions: permissionsResponse })
  }

  /**
   * The asset that `mixins.dmix` put into the state, or `undefined` while it's still being loaded. As `dmix` only ever
   * assigns the asset as a whole, `uid` being there means the rest of it is there too.
   */
  private getAsset(): AssetResponse | undefined {
    return this.state.uid ? (this.state as AssetResponse) : undefined
  }

  renderQuickLinks() {
    const asset = this.getAsset()

    return (
      <bem.FormView__cell m='data-tabs'>
        {userCan('add_submissions', asset) && (
          <Link to={`/forms/${asset?.uid}/landing`} key='landing'>
            <i className='k-icon k-icon-projects' />
            {t('Collect data')}
            <Icon name='angle-right' size='s' />
          </Link>
        )}

        {userCan('change_asset', asset) && (
          <button onClick={this.sharingModal.bind(this)}>
            <i className='k-icon k-icon-user-share' />
            {t('Share project')}
            <Icon name='angle-right' size='s' />
          </button>
        )}

        {userCan('change_asset', asset) && (
          <Link to={`/forms/${asset?.uid}/edit`} key='edit'>
            <i className='k-icon k-icon-edit' />
            {t('Edit form')}
            <Icon name='angle-right' size='s' />
          </Link>
        )}

        <button onClick={this.enketoPreviewModal.bind(this)} disabled={!asset?.url}>
          <i className='k-icon k-icon-view' />
          {t('Preview form')}
          <Icon name='angle-right' size='s' />
        </button>
      </bem.FormView__cell>
    )
  }

  renderDataTabs() {
    const asset = this.getAsset()

    if (!asset?.permissions || !userCan('view_submissions', asset)) {
      return null
    }

    if (asset.deployment__submission_count < 1) {
      return null
    }

    const sideTabs = getFormDataTabs(asset.uid)

    return (
      <bem.FormView__row m='data-links'>
        <bem.FormView__cell m={['label', 'first']}>{t('Data')}</bem.FormView__cell>
        <bem.FormView__cell m='box'>
          <bem.FormView__cell m='data-tabs'>
            {sideTabs.map((item, ind) => (
              <NavLink to={item.path} key={ind}>
                <i className={`k-icon ${item.icon}`} />
                {item.label}
                <Icon name='angle-right' size='s' />
              </NavLink>
            ))}
          </bem.FormView__cell>
        </bem.FormView__cell>
      </bem.FormView__row>
    )
  }

  sharingModal(evt: React.MouseEvent<HTMLElement>) {
    evt.preventDefault()
    const asset = this.getAsset()
    if (asset) {
      openSharingModal({ asset })
    }
  }

  enketoPreviewModal(evt: React.MouseEvent<HTMLElement>) {
    evt.preventDefault()
    pageState.showModal({
      type: MODAL_TYPES.ENKETO_PREVIEW,
      assetUrl: this.state.url,
    })
  }

  renderTeam() {
    const asset = this.getAsset()
    const team: string[] = []
    asset?.permissions?.forEach((perm) => {
      let username = null
      if (perm.user) {
        username = getUsernameFromUrl(perm.user)
      }

      if (username && !team.includes(username) && username !== ANON_USERNAME) {
        team.push(username)
      }
    })

    if (team.length < 2) {
      return false
    }

    return (
      <bem.FormView__row m='team'>
        <bem.FormView__cell m={['label', 'first']}>{t('Team members')}</bem.FormView__cell>
        {userCan('change_asset', asset) && (
          <a onClick={this.sharingModal.bind(this)} className='team-sharing-button'>
            <i className='k-icon k-icon-user-share' />
          </a>
        )}
        <bem.FormView__cell m={['box', 'padding']}>
          {team.map((username, ind) => (
            <Avatar key={ind} username={username} size='s' isUsernameVisible />
          ))}
        </bem.FormView__cell>
      </bem.FormView__row>
    )
  }

  render() {
    const asset = this.getAsset()
    const docTitle = asset?.name || t('Untitled')

    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <bem.FormView m='summary'>
          <LimitNotifications />
          <bem.FormView__row m='panels'>
            <bem.FormView__column m='left'>
              {asset && <FormSummaryProjectInfo asset={asset} />}

              {asset && (
                <bem.FormView__row>
                  <bem.FormView__cell m={['label', 'first']}>{t('Submissions')}</bem.FormView__cell>

                  <bem.FormView__cell m='box'>
                    <SubmissionsCountGraph assetUid={asset.uid} />
                  </bem.FormView__cell>
                </bem.FormView__row>
              )}
            </bem.FormView__column>
            <bem.FormView__column m='right'>
              <bem.FormView__row m='quick-links'>
                <bem.FormView__cell m={['label', 'first']}>{t('Quick Links')}</bem.FormView__cell>
                <bem.FormView__cell m='box'>{this.renderQuickLinks()}</bem.FormView__cell>
              </bem.FormView__row>

              {this.renderDataTabs()}

              {this.renderTeam()}
            </bem.FormView__column>
          </bem.FormView__row>
        </bem.FormView>
      </DocumentTitle>
    )
  }
}

reactMixin(FormSummary.prototype, mixins.dmix)

export default FormSummary
