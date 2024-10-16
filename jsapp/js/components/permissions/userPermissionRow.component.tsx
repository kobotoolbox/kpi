import React from 'react';
import alertify from 'alertifyjs';
import assetStore from 'js/assetStore';
import {actions} from 'js/actions';
import bem from 'js/bem';
import {escapeHtml} from 'js/utils';
import UserAssetPermsEditor from './userAssetPermsEditor.component';
import permConfig from './permConfig';
import type {PermissionBase, PermissionResponse} from 'js/dataInterface';
import type {AssignablePermsMap} from './sharingForm.component';
import {getPermLabel, getFriendlyPermName} from './utils';
import Button from 'js/components/common/button';
import Avatar from 'js/components/common/avatar';

interface UserPermissionRowProps {
  assetUid: string;
  userCanEditPerms: boolean;
  nonOwnerPerms: PermissionBase[];
  assignablePerms: AssignablePermsMap;
  permissions: PermissionResponse[];
  isUserOwner: boolean;
  isPendingOwner: boolean;
  username: string;
}

interface UserPermissionRowState {
  isEditFormVisible: boolean;
  isBeingDeleted: boolean;
}

export default class UserPermissionRow extends React.Component<
  UserPermissionRowProps,
  UserPermissionRowState
> {
  constructor(props: UserPermissionRowProps) {
    super(props);

    this.state = {
      isEditFormVisible: false,
      isBeingDeleted: false,
    };
  }

  componentDidMount() {
    assetStore.listen(this.onAssetChange, this);
  }

  onAssetChange() {
    // fixes bug that disables a user who was re-added after being deleted
    this.setState({isBeingDeleted: false});
  }

  showRemovePermissionsPrompt() {
    const dialog = alertify.dialog('confirm');
    const opts = {
      title: t('Remove permissions?'),
      message: t(
        'This action will remove all permissions for user ##username##'
      ).replace(
        '##username##',
        `<strong>${escapeHtml(this.props.username)}</strong>`
      ),
      labels: {ok: t('Remove'), cancel: t('Cancel')},
      onok: this.removeAllPermissions.bind(this),
      oncancel: dialog.destroy,
    };
    dialog.set(opts).show();
  }

  /**
   * Note: we remove "view_asset" permission, as it is the most basic one,
   * so removing it will in fact remove every permission except `add_submissions`.
   * That permission will be removed seprately.
   */
  removeAllPermissions() {
    this.setState({isBeingDeleted: true});
    const userViewAssetPerm = this.props.permissions.find(
      (perm) =>
        perm.permission ===
        permConfig.getPermissionByCodename('view_asset')?.url
    );

    const userAddSubmissionsPerm = this.props.permissions.find(
      (perm) =>
        perm.permission ===
        permConfig.getPermissionByCodename('add_submissions')?.url
    );
    if (userViewAssetPerm) {
      actions.permissions.removeAssetPermission(
        this.props.assetUid,
        userViewAssetPerm.url
      );
    }

    // We have to remove this permission seprately as it can be granted without
    // `view_asset`.
    if (userAddSubmissionsPerm) {
      actions.permissions.removeAssetPermission(
        this.props.assetUid,
        userAddSubmissionsPerm.url
      );
    }
  }

  onPermissionsEditorSubmitEnd(isSuccess: boolean) {
    if (isSuccess) {
      this.setState({isEditFormVisible: false});
    }
  }

  toggleEditForm() {
    this.setState({isEditFormVisible: !this.state.isEditFormVisible});
  }

  /**
   * Note that this renders partial permission using a general label with a list
   * of related conditions.
   */
  renderPermissions(permissions: PermissionResponse[]) {
    return (
      <bem.UserRow__perms>
        {permissions.map((perm) => {
          const permLabel = getPermLabel(perm);

          const friendlyPermName = getFriendlyPermName(perm);

          return (
            <bem.UserRow__perm key={permLabel}>
              {friendlyPermName}
            </bem.UserRow__perm>
          );
        })}
      </bem.UserRow__perms>
    );
  }

  render() {
    const modifiers = [];
    if (!this.props.isPendingOwner && this.props.permissions.length === 0) {
      modifiers.push('deleted');
    }
    if (this.state.isBeingDeleted) {
      modifiers.push('pending');
    }

    return (
      <bem.UserRow m={modifiers}>
        <bem.UserRow__info>
          <bem.UserRow__avatar>
            <Avatar size='m' username={this.props.username} isUsernameVisible />
          </bem.UserRow__avatar>

          {this.props.isUserOwner && (
            <bem.UserRow__perms>{t('is owner')}</bem.UserRow__perms>
          )}

          {this.props.isPendingOwner && (
            <bem.UserRow__perms>{t('Pending owner')}</bem.UserRow__perms>
          )}

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
    );
  }
}
