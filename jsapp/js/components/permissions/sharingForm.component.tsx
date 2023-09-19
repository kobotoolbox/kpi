import React from 'react';
import {stores} from 'js/stores';
import sessionStore from 'js/stores/session';
import assetStore from 'js/assetStore';
import type {AssetStoreData} from 'js/assetStore';
import {actions} from 'js/actions';
import bem from 'js/bem';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import InlineMessage from 'js/components/common/inlineMessage';
import {buildUserUrl, replaceBracketsWithLink} from 'js/utils';
import {ASSET_TYPES, ANON_USERNAME} from 'js/constants';
import {ACCOUNT_ROUTES} from 'js/account/routes';
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
import {getRouteAssetUid} from 'js/router/routerUtils';

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

  componentDidMount() {
    assetStore.listen(this.onAssetChange, this);
    stores.allAssets.listen(this.onAllAssetsChange, this);
    actions.permissions.bulkSetAssetPermissions.completed.listen(
      this.onAssetPermissionsUpdated.bind(this)
    );
    actions.permissions.getAssetPermissions.completed.listen(
      this.onAssetPermissionsUpdated.bind(this)
    );

    if (this.props.assetUid) {
      actions.resources.loadAsset({id: this.props.assetUid});
    }

    this.onAllAssetsChange();
  }

  onAllAssetsChange() {
    this.setState({allAssetsCount: Object.keys(stores.allAssets.byUid).length});
  }

  onAssetPermissionsUpdated(permissionAssignments: PermissionResponse[]) {
    const ownerUrl = this.state.asset?.owner;
    if (!ownerUrl) {
      return;
    }

    const parsedPerms = parseBackendData(permissionAssignments, ownerUrl, true);
    const anonUserUrl = buildUserUrl(ANON_USERNAME);
    const publicPerms = permissionAssignments.filter(
      (assignment) => assignment.user === anonUserUrl
    );
    const nonOwnerPerms = parseUserWithPermsList(parsedPerms).filter(
      (perm) => perm.user !== buildUserUrl(ownerUrl)
    );

    this.setState({
      permissions: parsedPerms,
      nonOwnerPerms: nonOwnerPerms,
      publicPerms: publicPerms,
    });
  }

  onAssetChange(data: AssetStoreData) {
    // TODO: check if it is possible to get no assetUid! because most probably
    // we don't need that fallback
    const uid = this.props.assetUid || getRouteAssetUid();
    const asset = Object.values(data).find((item) => item.uid === uid);

    if (!asset) {
      return;
    }

    this.setState({
      asset: asset,
      assignablePerms: this.getAssignablePermsMap(asset.assignable_permissions),
    });

    // we need to fetch permissions after asset has loaded, as we need to have
    // the owner username first to parse permissions
    actions.permissions.getAssetPermissions(uid);
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

  render() {
    if (!this.state.asset || !this.state.permissions) {
      return <LoadingSpinner />;
    }

    const assetType = this.state.asset.asset_type;

    const isRequireAuthWarningVisible =
      'extra_details' in sessionStore.currentAccount &&
      sessionStore.currentAccount.extra_details?.require_auth !== true &&
      assetType === ASSET_TYPES.survey.id;

    return (
      <bem.FormModal m='sharing-form'>
        <bem.Modal__subheader>{this.state.asset.name}</bem.Modal__subheader>

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
        <bem.FormModal__item>
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
                nonOwnerPerms={this.state.nonOwnerPerms}
                assignablePerms={this.state.assignablePerms}
                permissions={perm.permissions}
                isUserOwner={perm.user.isOwner}
                userName={perm.user.name}
              />
            );
          })}

          {!this.state.isAddUserEditorVisible && (
            <bem.KoboButton m='blue' onClick={this.toggleAddUserEditor}>
              {t('Add user')}
            </bem.KoboButton>
          )}

          {this.state.isAddUserEditorVisible && (
            <bem.FormModal__item m={['gray-row', 'copy-team-permissions']}>
              <bem.Button
                m='icon'
                className='user-permissions-editor-closer'
                onClick={this.toggleAddUserEditor}
              >
                <i className='k-icon k-icon-close' />
              </bem.Button>

              <UserAssetPermsEditor
                assetUid={this.props.assetUid}
                assignablePerms={this.state.assignablePerms}
                nonOwnerPerms={this.state.nonOwnerPerms}
                onSubmitEnd={this.onPermissionsEditorSubmitEnd}
              />
            </bem.FormModal__item>
          )}
        </bem.FormModal__item>

        {/* public sharing settings */}
        {assetType === ASSET_TYPES.survey.id && (
          <>
            <bem.Modal__hr />

            <bem.FormModal__item m='share-settings'>
              <h2>{t('Share publicly by link')}</h2>

              <PublicShareSettings
                publicPerms={this.state.publicPerms}
                assetUid={this.props.assetUid}
                deploymentActive={this.state.asset.deployment__active}
              />
            </bem.FormModal__item>
          </>
        )}

        {/* copying permissions from other assets */}
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
      </bem.FormModal>
    );
  }
}
