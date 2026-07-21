import { Box, Divider, Group, Stack, Text } from '@mantine/core'
import { IconPencil, IconTrash, IconX } from '@tabler/icons-react'
import alertify from 'alertifyjs'
import React from 'react'
import { actions } from '#/actions'
import assetStore from '#/assetStore'
import ActionIcon from '#/components/common/ActionIcon'
import Avatar from '#/components/common/avatar'
import type { AssetResponse, PermissionBase, PermissionResponse } from '#/dataInterface'
import { router } from '#/router/legacy'
import { ROUTES } from '#/router/routerConstants'
import sessionStore from '#/stores/session'
import { escapeHtml } from '#/utils'
import { permissionsActions } from '../../actions/permissions'
import permConfig from './permConfig'
import { PERMISSIONS_CODENAMES } from './permConstants'
import type { AssignablePermsMap } from './sharingForm.component'
import UserAssetPermsEditor from './userAssetPermsEditor.component'
import { getFriendlyPermName, getPermLabel } from './utils'

interface UserPermissionRowProps {
  asset: AssetResponse
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

    const isCurrentUser = this.props.username === sessionStore.currentAccount.username

    actions.permissions.removeAssetPermission(this.props.asset.uid, undefined, true, undefined, this.props.username)

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
    const permissionLabels: string[] = []

    permissions.forEach((perm) => {
      // UI already shows if a collection is discoverable, and we should not explicitly assign this permission.
      if (perm.permission.includes(PERMISSIONS_CODENAMES.discover_asset)) {
        return
      }

      // Keep this as key generation and to preserve previous mapping behavior.
      getPermLabel(perm, this.props.asset.asset_type)

      // Between UserPermissionRow and UserAssetPermsEditor, generation of permission labels takes a small but
      // significantly different starting point. To avoid deeper complications we do a little bit of redundant work
      // here (to get the permission definition) needed to generate contextual labels.
      //
      // See https://github.com/kobotoolbox/kpi/pull/5736#discussion_r2085252485
      const permDef = permConfig.getPermission(perm.permission)
      if (permDef) {
        permissionLabels.push(getFriendlyPermName(perm, this.props.asset.asset_type))
      }
    })

    return (
      <Text size='sm' ta='right' maw={400}>
        {permissionLabels.join(' · ')}
      </Text>
    )
  }

  render() {
    if (!this.props.isPendingOwner && this.props.permissions.length === 0) {
      return null
    }

    const isPending = this.state.isBeingDeleted

    return (
      <Stack gap='xs'>
        <Group
          justify='space-between'
          align='center'
          wrap='nowrap'
          style={{ opacity: isPending ? 0.5 : 1, pointerEvents: isPending ? 'none' : 'auto' }}
        >
          <Box miw={200}>
            <Avatar size='m' username={this.props.username} isUsernameVisible />
          </Box>

          {this.props.isUserOwner && <Text size='sm'>{t('is owner')}</Text>}

          {this.props.isPendingOwner && <Text size='sm'>{t('Pending owner')}</Text>}

          {!this.props.isUserOwner && !this.props.isPendingOwner && (
            <Group gap='xs' align='center' wrap='nowrap'>
              {this.renderPermissions(this.props.permissions)}
              {this.props.userCanEditPerms && (
                <Group gap={6} wrap='nowrap'>
                  <ActionIcon
                    variant='subtle'
                    size='md'
                    aria-label={this.state.isEditFormVisible ? t('Close permission editor') : t('Edit permissions')}
                    tooltip={this.state.isEditFormVisible ? t('Close permission editor') : t('Edit permissions')}
                    onClick={this.toggleEditForm.bind(this)}
                    icon={this.state.isEditFormVisible ? IconX : IconPencil}
                  />

                  <ActionIcon
                    variant='subtle'
                    size='md'
                    color='red'
                    aria-label={t('Remove all permissions')}
                    tooltip={t('Remove all permissions')}
                    onClick={this.showRemovePermissionsPrompt.bind(this)}
                    icon={IconTrash}
                  />
                </Group>
              )}
            </Group>
          )}
        </Group>

        {this.state.isEditFormVisible && (
          <Box p='md' bg='gray.7' bdrs='sm'>
            <UserAssetPermsEditor
              asset={this.props.asset}
              username={this.props.username}
              permissions={this.props.permissions}
              assignablePerms={this.props.assignablePerms}
              nonOwnerPerms={this.props.nonOwnerPerms}
              onSubmitEnd={this.onPermissionsEditorSubmitEnd.bind(this)}
            />
          </Box>
        )}

        <Divider />
      </Stack>
    )
  }
}
