import React from 'react'

import alertify from 'alertifyjs'
import { actions } from '#/actions'
import assetStore from '#/assetStore'
import bem from '#/bem'
import Avatar from '#/components/common/avatar'
import Button from '#/components/common/button'
import type { PermissionBase, PermissionResponse } from '#/dataInterface'
import { router } from '#/router/legacy'
import { ROUTES } from '#/router/routerConstants'
import sessionStore from '#/stores/session'
import { escapeHtml } from '#/utils'
import { permissionsActions } from '../../actions/permissions'
import permConfig from './permConfig'
import type { AssignablePermsMap } from './sharingForm.component'
import UserAssetPermsEditor from './userAssetPermsEditor.component'
import { getFriendlyPermName, getPermLabel } from './utils'

interface UserPermissionRowProps {
  assetUid: string
  userCanEditPerms: boolean
  nonOwnerPerms: PermissionBase[]
  assignablePerms: AssignablePermsMap
  permissions: PermissionResponse[]
  isUserOwner: boolean
  isPendingOwner: boolean
  username: string
}

interface UserPermissionRowState {
  isEditFormVisible: boolean
  isBeingDeleted: boolean
}

export default class UserPermissionRow extends React.Component<UserPermissionRowProps, UserPermissionRowState> {
  constructor(props: UserPermissionRowProps) {
    super(props)

    this.state = {
      isEditFormVisible: false,
      isBeingDeleted: false,
    }
  }

  componentDidMount() {
    assetStore.listen(this.onAssetChange, this)
  }

  onAssetChange() {
    // fixes bug that disables a user who was re-added after being deleted
    this.setState({ isBeingDeleted: false })
  }

  showRemovePermissionsPrompt() {
    const dialog = alertify.dialog('confirm')
    const opts = {
      title: t('Remove permissions?'),
      message: t('This action will remove all permissions for user ##username##').replace(
        '##username##',
        `<strong>${escapeHtml(this.props.username)}</strong>`,
      ),
      labels: { ok: t('Remove'), cancel: t('Cancel') },
      onok: this.removeAllPermissions.bind(this),
      oncancel: dialog.destroy,
    }
    dialog.set(opts).show()
  }

  removeAllPermissions() {
    this.setState({ isBeingDeleted: true })
    const userAssetPermUrl = this.props.permissions.find(
      (perm) => perm.permission === permConfig.getPermissionByCodename('view_asset')?.url,
    )
    const isCurrentUser = this.props.username === sessionStore.currentAccount.username
    actions.permissions.removeAssetPermission(this.props.assetUid, userAssetPermUrl?.url, true)
    permissionsActions.removeAssetPermission.completed.listen(() => {
      // If the user deletes their own permissions, they will be routed to the form landing page
      if (isCurrentUser) {
        router?.navigate(ROUTES.FORMS)
      }
    })
  }

  onPermissionsEditorSubmitEnd(isSuccess: boolean) {
    if (isSuccess) {
      this.setState({ isEditFormVisible: false })
    }
  }

  toggleEditForm() {
    this.setState({ isEditFormVisible: !this.state.isEditFormVisible })
  }

  /**
   * Note that this renders partial permission using a general label with a list
   * of related conditions.
   */
  renderPermissions(permissions: PermissionResponse[]) {
    return (
      <bem.UserRow__perms>
        {permissions.map((perm) => {
          const permLabel = getPermLabel(perm)

          const friendlyPermName = getFriendlyPermName(perm)

          return <bem.UserRow__perm key={permLabel}>{friendlyPermName}</bem.UserRow__perm>
        })}
      </bem.UserRow__perms>
    )
  }

  render() {
    const modifiers = []
    if (!this.props.isPendingOwner && this.props.permissions.length === 0) {
      modifiers.push('deleted')
    }
    if (this.state.isBeingDeleted) {
      modifiers.push('pending')
    }

    return (
      <bem.UserRow m={modifiers}>
        <bem.UserRow__info>
          <bem.UserRow__avatar>
            <Avatar size='m' username={this.props.username} isUsernameVisible />
          </bem.UserRow__avatar>

          {this.props.isUserOwner && <bem.UserRow__perms>{t('is owner')}</bem.UserRow__perms>}

          {this.props.isPendingOwner && <bem.UserRow__perms>{t('Pending owner')}</bem.UserRow__perms>}

          {!this.props.isUserOwner && !this.props.isPendingOwner && (
            <div className='user-row__perms-actions'>
              {this.renderPermissions(this.props.permissions)}
              {this.props.userCanEditPerms && (
                <>
                  <Button
                    type='secondary'
                    size='m'
                    startIcon={this.state.isEditFormVisible ? 'close' : 'edit'}
                    onClick={this.toggleEditForm.bind(this)}
                  />

                  <Button
                    type='secondary-danger'
                    size='m'
                    startIcon='trash'
                    onClick={this.showRemovePermissionsPrompt.bind(this)}
                  />
                </>
              )}
            </div>
          )}
        </bem.UserRow__info>

        {this.state.isEditFormVisible && (
          <bem.UserRow__editor>
            <UserAssetPermsEditor
              assetUid={this.props.assetUid}
              username={this.props.username}
              permissions={this.props.permissions}
              assignablePerms={this.props.assignablePerms}
              nonOwnerPerms={this.props.nonOwnerPerms}
              onSubmitEnd={this.onPermissionsEditorSubmitEnd.bind(this)}
            />
          </bem.UserRow__editor>
        )}
      </bem.UserRow>
    )
  }
}
