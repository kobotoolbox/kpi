import React from 'react';
import alertify from 'alertifyjs';
import assetStore from 'js/assetStore';
import {actions} from 'js/actions';
import bem from 'js/bem';
import {stringToColor, escapeHtml} from 'js/utils';
import UserAssetPermsEditor from './userAssetPermsEditor.component';
import permConfig from './permConfig';
import type {UserPerm} from './permParser';
import type {PermissionBase} from 'js/dataInterface';
import type {AssignablePermsMap} from './sharingForm.component';

interface UserPermissionRowProps {
  assetUid: string;
  nonOwnerPerms: PermissionBase[];
  assignablePerms: AssignablePermsMap;
  permissions: UserPerm[];
  isUserOwner: boolean;
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

  removePermissions() {
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
   * so removing it will in fact remove all permissions
   */
  removeAllPermissions() {
    this.setState({isBeingDeleted: true});
    const userViewAssetPerm = this.props.permissions.find(
      (perm) =>
        perm.permission ===
        permConfig.getPermissionByCodename('view_asset')?.url
    );
    if (userViewAssetPerm) {
      actions.permissions.removeAssetPermission(
        this.props.assetUid,
        userViewAssetPerm.url
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

  // TODO: This doesn't display `partial_permissions` in a nice way, as it
  // assumes that there can be only "view" in them, but this is partially
  // backend's fault for giving a non universal label to "partial_permissions".
  // See: https://github.com/kobotoolbox/kpi/issues/4641
  renderPermissions(permissions: UserPerm[]) {
    const maxParentheticalUsernames = 3;
    return (
      <bem.UserRow__perms>
        {permissions.map((perm) => {
          let permUsers: string[] = [];

          if (perm.partial_permissions) {
            perm.partial_permissions.forEach((partial) => {
              partial.filters.forEach((filter) => {
                if (filter._submitted_by) {
                  permUsers = permUsers.concat(filter._submitted_by.$in);
                }
              });
            });
          }

          // Keep only unique values
          permUsers = [...new Set(permUsers)];

          // We fallback to "???" so it's clear when some error happens
          let permLabel: string = '???';
          if (this.props.assignablePerms.has(perm.permission)) {
            const assignablePerm = this.props.assignablePerms.get(
              perm.permission
            );
            if (typeof assignablePerm === 'object') {
              // let's assume back end always returns a `default` property with
              // nested permissions
              permLabel = assignablePerm.default;
            } else if (assignablePerm) {
              permLabel = assignablePerm;
            }
          }

          // Hopefully this is friendly to translators of RTL languages
          let permNameTemplate;
          if (permUsers.length === 0) {
            permNameTemplate = '##permission_label##';
          } else if (permUsers.length <= maxParentheticalUsernames) {
            permNameTemplate = t('##permission_label## (##username_list##)');
          } else if (permUsers.length === maxParentheticalUsernames + 1) {
            permNameTemplate = t(
              '##permission_label## (##username_list## and 1 other)'
            );
          } else {
            permNameTemplate = t(
              '##permission_label## (##username_list## and ' +
                '##hidden_username_count## others)'
            );
          }

          const friendlyPermName = permNameTemplate
            .replace('##permission_label##', permLabel)
            .replace(
              '##username_list##',
              permUsers.slice(0, maxParentheticalUsernames).join(', ')
            )
            .replace(
              '##hidden_username_count##',
              String(permUsers.length - maxParentheticalUsernames)
            );

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
    const initialsStyle = {
      background: `#${stringToColor(this.props.username)}`,
    };

    const modifiers = [];
    if (this.props.permissions.length === 0) {
      modifiers.push('deleted');
    }
    if (this.state.isBeingDeleted) {
      modifiers.push('pending');
    }

    return (
      <bem.UserRow m={modifiers}>
        <bem.UserRow__info>
          <bem.UserRow__avatar>
            <bem.AccountBox__initials style={initialsStyle}>
              {this.props.username.charAt(0)}
            </bem.AccountBox__initials>
          </bem.UserRow__avatar>

          <bem.UserRow__name>{this.props.username}</bem.UserRow__name>

          {this.props.isUserOwner && (
            <bem.UserRow__perms>{t('is owner')}</bem.UserRow__perms>
          )}
          {!this.props.isUserOwner && (
            <React.Fragment>
              {this.renderPermissions(this.props.permissions)}

              <bem.Button m='icon' onClick={this.toggleEditForm.bind(this)}>
                {this.state.isEditFormVisible && (
                  <i className='k-icon k-icon-close' />
                )}
                {!this.state.isEditFormVisible && (
                  <i className='k-icon k-icon-edit' />
                )}
              </bem.Button>

              <bem.Button m='icon' onClick={this.removePermissions.bind(this)}>
                <i className='k-icon k-icon-trash' />
              </bem.Button>
            </React.Fragment>
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
