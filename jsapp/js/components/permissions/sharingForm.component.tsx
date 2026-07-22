import { Box, Group, Stack, Title } from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import React from 'react'
import { actions } from '#/actions'
import assetStore from '#/assetStore'
import type { AssetStoreData } from '#/assetStore'
import ActionIcon from '#/components/common/ActionIcon'
import ButtonNew from '#/components/common/ButtonNew'
import LoadingSpinner from '#/components/common/loadingSpinner'
import { TransferStatuses } from '#/components/permissions/transferProjects/transferProjects.api'
import { userCan } from '#/components/permissions/utils'
import { ASSET_TYPES } from '#/constants'
import type {
  AssetResponse,
  AssignablePermission,
  AssignablePermissionPartialLabel,
  PermissionBase,
  PermissionResponse,
} from '#/dataInterface'
import { ANON_USERNAME, ANON_USERNAME_URL } from '#/users/utils'
import { recordValues } from '#/utils'
import AnonymousSubmissionSettings from './AnonymousSubmissionSettings'
import CopyTeamPermissions from './copyTeamPermissions.component'
import { parseBackendData, parseUserWithPermsList } from './permParser'
import type { UserWithPerms } from './permParser'
import PublicShareSettings from './publicShareSettings.component'
import UserAssetPermsEditor from './userAssetPermsEditor.component'
import UserPermissionRow from './userPermissionRow.component'

interface SharingFormProps {
  assetUid: string
}

/**
 * This is a map of permission url and either a label or object with labels (for
 * partial permissions)
 */
export type AssignablePermsMap = Map<string, string | AssignablePermissionPartialLabel>

interface SharingFormState {
  isAddUserEditorVisible: boolean
  permissions: UserWithPerms[] | null
  nonOwnerPerms: PermissionBase[]
  publicPerms: PermissionResponse[]
  asset?: AssetResponse
  assignablePerms: AssignablePermsMap
}

export default class SharingForm extends React.Component<SharingFormProps, SharingFormState> {
  constructor(props: SharingFormProps) {
    super(props)
    this.state = {
      isAddUserEditorVisible: false,
      // `permissions`, `nonOwnerPerms` and `publicPerms` are all being built at
      // the same moment when API call finishes, so we can start with empty
      // arrays for two of them (simplifies TypeScript stuff)
      permissions: null,
      nonOwnerPerms: [],
      publicPerms: [],
      // `asset` and `assignablePerms` comes from single API call
      asset: undefined,
      assignablePerms: new Map(),
    }
  }

  private unlisteners: Function[] = []

  componentDidMount() {
    this.unlisteners.push(
      assetStore.listen(this.onAssetChange, this),
      actions.permissions.bulkSetAssetPermissions.completed.listen(this.onAssetPermissionsUpdated.bind(this)),
      actions.permissions.getAssetPermissions.completed.listen(this.onAssetPermissionsUpdated.bind(this)),
    )
    if (this.props.assetUid) {
      actions.resources.loadAsset({ id: this.props.assetUid }, true)
    }
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb()
    })
  }

  onAssetPermissionsUpdated(permissionAssignments: PermissionResponse[], owner: string | null = null) {
    const ownerUrl = owner || this.state.asset?.owner
    if (!ownerUrl) {
      return
    }

    const parsedPerms = parseBackendData(permissionAssignments, ownerUrl, true)
    const publicPerms = permissionAssignments.filter((assignment) => assignment.user === ANON_USERNAME_URL)
    const nonOwnerPerms = parseUserWithPermsList(parsedPerms).filter((perm) => perm.user !== ownerUrl)

    this.setState({
      permissions: parsedPerms,
      nonOwnerPerms: nonOwnerPerms,
      publicPerms: publicPerms,
    })
  }

  onAssetChange(data: AssetStoreData) {
    const asset = recordValues(data).find((item) => item.uid === this.props.assetUid)

    if (!asset) {
      return
    }

    this.setState({
      asset: asset,
      assignablePerms: this.getAssignablePermsMap(asset.assignable_permissions),
    })

    // use the asset's permissions to update the form
    this.onAssetPermissionsUpdated(asset.permissions, asset.owner)
  }

  getAssignablePermsMap(backendPerms: AssignablePermission[]) {
    const assignablePerms = new Map()
    backendPerms.forEach((backendPerm) => {
      assignablePerms.set(backendPerm.url, backendPerm.label)
    })
    return assignablePerms
  }

  toggleAddUserEditor() {
    this.setState({ isAddUserEditorVisible: !this.state.isAddUserEditorVisible })
  }

  onPermissionsEditorSubmitEnd(isSuccess: boolean) {
    if (isSuccess) {
      this.setState({ isAddUserEditorVisible: false })
    }
  }

  getOwnerOrOrgLabel(name: string, isOwner: boolean) {
    if (isOwner) {
      return this.state.asset ? this.state.asset.owner_label : name
    }
    return name
  }

  /** Check if the recipient of the transfer is the specified user */
  isPendingOwner(username: string) {
    return this.state.asset?.project_ownership?.status === TransferStatuses.Pending &&
      this.state.asset?.project_ownership?.recipient === username
      ? true
      : false
  }

  /** Display pending owner if not already included in list of user permissions */
  renderPendingOwner(userCanEditPerms: boolean) {
    if (
      this.state.asset?.project_ownership?.status === TransferStatuses.Pending &&
      !this.state.permissions?.find((perm) => perm.user.name === this.state.asset?.project_ownership?.recipient)
    ) {
      return (
        <UserPermissionRow
          asset={this.state.asset}
          userCanEditPerms={userCanEditPerms}
          nonOwnerPerms={this.state.nonOwnerPerms}
          assignablePerms={this.state.assignablePerms}
          permissions={[]}
          isUserOwner={false}
          isPendingOwner={true}
          username={this.state.asset.project_ownership.recipient}
        />
      )
    } else {
      return null
    }
  }

  render() {
    if (!this.state.asset || !this.state.permissions) {
      return <LoadingSpinner />
    }

    const assetType = this.state.asset.asset_type
    const isManagingPossible = userCan('manage_asset', this.state.asset)

    return (
      <Stack gap='xl'>
        {/* list of users and their permissions */}
        <Stack gap='sm'>
          <Title order={4}>{t('Who has access')}</Title>

          {this.state.permissions.map((perm) => {
            // don't show anonymous user permissions in UI
            if (perm.user.name === ANON_USERNAME || !this.state.asset) {
              return null
            }
            return (
              <UserPermissionRow
                key={`perm.${this.props.assetUid}.${perm.user.name}`}
                asset={this.state.asset}
                userCanEditPerms={isManagingPossible}
                nonOwnerPerms={this.state.nonOwnerPerms}
                assignablePerms={this.state.assignablePerms}
                permissions={perm.permissions}
                isUserOwner={perm.user.isOwner}
                isPendingOwner={this.isPendingOwner(perm.user.name)}
                username={this.getOwnerOrOrgLabel(perm.user.name, perm.user.isOwner)}
              />
            )
          })}
          {this.renderPendingOwner(isManagingPossible)}

          {!this.state.isAddUserEditorVisible && (
            <ButtonNew
              disabled={!isManagingPossible}
              size='md'
              onClick={this.toggleAddUserEditor.bind(this)}
              style={{ alignSelf: 'flex-start' }}
            >
              {t('Add user')}
            </ButtonNew>
          )}

          {this.state.isAddUserEditorVisible && (
            <Box p='md' bg='gray.7' bdrs='sm'>
              <Group gap='xs' align='top'>
                <Box flex={1}>
                  <UserAssetPermsEditor
                    asset={this.state.asset}
                    assignablePerms={this.state.assignablePerms}
                    nonOwnerPerms={this.state.nonOwnerPerms}
                    onSubmitEnd={this.onPermissionsEditorSubmitEnd.bind(this)}
                  />
                </Box>

                <ActionIcon
                  variant='subtle'
                  size='md'
                  aria-label={t('Close add user editor')}
                  onClick={this.toggleAddUserEditor.bind(this)}
                  icon={IconX}
                />
              </Group>
            </Box>
          )}
        </Stack>

        {/* public sharing settings */}
        {assetType === ASSET_TYPES.survey.id && (
          <>
            <Stack gap='sm'>
              <Title order={4}>{t('Who can submit')}</Title>
              <AnonymousSubmissionSettings
                publicPerms={this.state.publicPerms}
                assetUid={this.props.assetUid}
                userCanShare={isManagingPossible}
              />
            </Stack>

            <PublicShareSettings
              publicPerms={this.state.publicPerms}
              assetUid={this.props.assetUid}
              userCanShare={isManagingPossible}
            />
          </>
        )}

        {/* copying permissions from other assets */}
        {isManagingPossible && assetType !== ASSET_TYPES.collection.id && (
          <CopyTeamPermissions asset={this.state.asset} />
        )}
      </Stack>
    )
  }
}
