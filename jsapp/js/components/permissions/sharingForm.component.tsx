import React from 'react';
import {stores} from 'js/stores';
import sessionStore from 'js/stores/session';
import assetStore from 'js/assetStore';
import type {AssetStoreData} from 'js/assetStore';
import {actions} from 'js/actions';
import bem from 'js/bem';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import Button from 'js/components/common/button';
import InlineMessage from 'js/components/common/inlineMessage';
import {userCan} from 'js/components/permissions/utils';
import {replaceBracketsWithLink} from 'js/textUtils';
import {ANON_USERNAME, ANON_USERNAME_URL} from 'js/users/utils';
import {ASSET_TYPES} from 'js/constants';
import {TransferStatuses} from 'js/components/permissions/transferProjects/transferProjects.api';
import './sharingForm.scss';
// parts
import CopyTeamPermissions from './copyTeamPermissions.component';
import UserAssetPermsEditor from './userAssetPermsEditor.component';
import PublicShareSettings from './publicShareSettings.component';
import UserPermissionRow from './userPermissionRow.component';
import {parseBackendData, parseUserWithPermsList} from './permParser';
import type {UserWithPerms} from './permParser';
import type {
  AssignablePermission,
  AssetResponse,
  PermissionBase,
  PermissionResponse,
  AssignablePermissionPartialLabel,
} from 'js/dataInterface';
import {ACCOUNT_ROUTES} from 'js/account/routes.constants';
import AssetName from 'js/components/common/assetName';

interface SharingFormProps {
  assetUid: string;
}

/**
 * This is a map of permission url and either a label or object with labels (for
 * partial permissions)
 */
export type AssignablePermsMap = Map<
  string,
  string | AssignablePermissionPartialLabel
>;

interface SharingFormState {
  allAssetsCount: number;
  isAddUserEditorVisible: boolean;
  permissions: UserWithPerms[] | null;
  nonOwnerPerms: PermissionBase[];
  publicPerms: PermissionResponse[];
  asset?: AssetResponse;
  assignablePerms: AssignablePermsMap;
}

export default class SharingForm extends React.Component<
  SharingFormProps,
  SharingFormState
> {
  constructor(props: SharingFormProps) {
    super(props);
    this.state = {
      allAssetsCount: 0,
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
    };
  }

  private unlisteners: Function[] = [];

  componentDidMount() {
    this.unlisteners.push(
      assetStore.listen(this.onAssetChange, this),
      stores.allAssets.listen(this.onAllAssetsChange, this),
      actions.permissions.bulkSetAssetPermissions.completed.listen(
        this.onAssetPermissionsUpdated.bind(this)
      ),
      actions.permissions.getAssetPermissions.completed.listen(
        this.onAssetPermissionsUpdated.bind(this)
      )
    );
    if (this.props.assetUid) {
      actions.resources.loadAsset({id: this.props.assetUid});
    }

    this.onAllAssetsChange();
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb();
    });
  }

  onAllAssetsChange() {
    this.setState({allAssetsCount: Object.keys(stores.allAssets.byUid).length});
  }

  onAssetPermissionsUpdated(
    permissionAssignments: PermissionResponse[],
    owner: string | null = null
  ) {
    const ownerUrl = owner || this.state.asset?.owner;
    if (!ownerUrl) {
      return;
    }

    const parsedPerms = parseBackendData(permissionAssignments, ownerUrl, true);
    const publicPerms = permissionAssignments.filter(
      (assignment) => assignment.user === ANON_USERNAME_URL
    );
    const nonOwnerPerms = parseUserWithPermsList(parsedPerms).filter(
      (perm) => perm.user !== ownerUrl
    );

    this.setState({
      permissions: parsedPerms,
      nonOwnerPerms: nonOwnerPerms,
      publicPerms: publicPerms,
    });
  }

  onAssetChange(data: AssetStoreData) {
    const asset = Object.values(data).find(
      (item) => item.uid === this.props.assetUid
    );

    if (!asset) {
      return;
    }

    this.setState({
      asset: asset,
      assignablePerms: this.getAssignablePermsMap(asset.assignable_permissions),
    });

    // use the asset's permissions to update the form
    this.onAssetPermissionsUpdated(asset.permissions, asset.owner);
  }

  getAssignablePermsMap(backendPerms: AssignablePermission[]) {
    const assignablePerms = new Map();
    backendPerms.forEach((backendPerm) => {
      assignablePerms.set(backendPerm.url, backendPerm.label);
    });
    return assignablePerms;
  }

  toggleAddUserEditor() {
    this.setState({isAddUserEditorVisible: !this.state.isAddUserEditorVisible});
  }

  onPermissionsEditorSubmitEnd(isSuccess: boolean) {
    if (isSuccess) {
      this.setState({isAddUserEditorVisible: false});
    }
  }

  getOwnerOrOrgLabel(name: string, isOwner: boolean) {
    if (isOwner) {
      return this.state.asset ? this.state.asset.owner_label : name;
    }
    return name;
  }

  /** Check if the recipient of the transfer is the specified user */
  isPendingOwner(username: string) {
    return this.state.asset?.project_ownership?.status ===
      TransferStatuses.Pending &&
      this.state.asset?.project_ownership?.recipient === username
      ? true
      : false;
  }

  /** Display pending owner if not already included in list of user permissions */
  renderPendingOwner(userCanEditPerms: boolean) {
    if (
      this.state.asset?.project_ownership?.status ===
        TransferStatuses.Pending &&
      !this.state.permissions?.find(
        (perm) =>
          perm.user.name === this.state.asset?.project_ownership?.recipient
      )
    ) {
      return (
        <UserPermissionRow
          assetUid={this.props.assetUid}
          userCanEditPerms={userCanEditPerms}
          nonOwnerPerms={this.state.nonOwnerPerms}
          assignablePerms={this.state.assignablePerms}
          permissions={[]}
          isUserOwner={false}
          isPendingOwner={true}
          username={this.state.asset.project_ownership.recipient}
        />
      );
    } else {
      return null;
    }
  }

  render() {
    if (!this.state.asset || !this.state.permissions) {
      return <LoadingSpinner />;
    }

    const assetType = this.state.asset.asset_type;
    const isManagingPossible = userCan('manage_asset', this.state.asset);

    const isRequireAuthWarningVisible =
      'extra_details' in sessionStore.currentAccount &&
      sessionStore.currentAccount.extra_details?.require_auth !== true &&
      assetType === ASSET_TYPES.survey.id;

    return (
      <bem.FormModal m='sharing-form'>
        <bem.Modal__subheader dir='auto'>
          <AssetName asset={this.state.asset} />
        </bem.Modal__subheader>

        {isRequireAuthWarningVisible && (
          <bem.FormModal__item>
            <InlineMessage
              type='warning'
              icon='alert'
              message={
                <span
                  dangerouslySetInnerHTML={{
                    __html: replaceBracketsWithLink(
                      t(
                        'Anyone can see this blank form and add submissions to it ' +
                          'because you have not set [your account] to require authentication.'
                      ),
                      `/#${ACCOUNT_ROUTES.ACCOUNT_SETTINGS}`
                    ),
                  }}
                />
              }
            />
          </bem.FormModal__item>
        )}

        {/* list of users and their permissions */}
        <bem.FormModal__item m='who-has-access'>
          <h2>{t('Who has access')}</h2>

          {this.state.permissions.map((perm) => {
            // don't show anonymous user permissions in UI
            if (perm.user.name === ANON_USERNAME) {
              return null;
            }
            return (
              <UserPermissionRow
                key={`perm.${this.props.assetUid}.${perm.user.name}`}
                assetUid={this.props.assetUid}
                userCanEditPerms={isManagingPossible}
                nonOwnerPerms={this.state.nonOwnerPerms}
                assignablePerms={this.state.assignablePerms}
                permissions={perm.permissions}
                isUserOwner={perm.user.isOwner}
                isPendingOwner={this.isPendingOwner(perm.user.name)}
                username={this.getOwnerOrOrgLabel(perm.user.name, perm.user.isOwner)}
              />
            );
          })}
          {this.renderPendingOwner(isManagingPossible)}

          {!this.state.isAddUserEditorVisible && (
            <Button
              type='primary'
              isDisabled={!isManagingPossible}
              size='l'
              onClick={this.toggleAddUserEditor.bind(this)}
              label={t('Add user')}
            />
          )}

          {this.state.isAddUserEditorVisible && (
            <bem.FormModal__item m={['gray-row', 'copy-team-permissions']}>
              <Button
                type='text'
                size='l'
                startIcon='close'
                className='user-permissions-editor-closer'
                onClick={this.toggleAddUserEditor.bind(this)}
              />

              <UserAssetPermsEditor
                assetUid={this.props.assetUid}
                assignablePerms={this.state.assignablePerms}
                nonOwnerPerms={this.state.nonOwnerPerms}
                onSubmitEnd={this.onPermissionsEditorSubmitEnd.bind(this)}
              />
            </bem.FormModal__item>
          )}
        </bem.FormModal__item>

        {/* public sharing settings */}
        {assetType === ASSET_TYPES.survey.id && (
          <>
            <bem.FormModal__item m='share-settings'>
              <PublicShareSettings
                publicPerms={this.state.publicPerms}
                assetUid={this.props.assetUid}
                deploymentActive={this.state.asset.deployment__active}
                userCanShare={isManagingPossible}
              />
            </bem.FormModal__item>
          </>
        )}

        {/* copying permissions from other assets */}
        {isManagingPossible && (
          <>
            {assetType !== ASSET_TYPES.collection.id &&
              this.state.allAssetsCount === 0 && (
                <>
                  <bem.Modal__hr />
                  {t('Waiting for all projects to load…')}
                </>
              )}
            {assetType !== ASSET_TYPES.collection.id &&
              this.state.allAssetsCount >= 2 && (
                <>
                  <bem.Modal__hr />
                  <CopyTeamPermissions assetUid={this.props.assetUid} />
                </>
              )}
          </>
        )}
      </bem.FormModal>
    );
  }
}
