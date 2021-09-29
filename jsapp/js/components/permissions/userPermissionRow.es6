import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import alertify from 'alertifyjs';
import mixins from 'js/mixins';
import {stores} from 'js/stores';
import {actions} from 'js/actions';
import bem from 'js/bem';
import {stringToColor} from 'utils';
import {
  ASSET_TYPES,
  PERMISSIONS_CODENAMES
} from 'js/constants';
import UserAssetPermsEditor from './userAssetPermsEditor';
import permConfig from './permConfig';

class UserPermissionRow extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);

    this.state = {
      isEditFormVisible: false,
      isBeingDeleted: false
    };
  }

  componentDidMount() {
    this.listenTo(stores.asset, this.onAssetChange);
  }

  onAssetChange() {
    // fixes bug that disables a user who was re-added after being deleted
    this.setState({isBeingDeleted: false});
  }

  removePermissions() {
    const dialog = alertify.dialog('confirm');
    const opts = {
      title: t('Remove permissions?'),
      message: t('This action will remove all permissions for user ##username##').replace('##username##', `<strong>${this.props.user.name}</strong>`),
      labels: {ok: t('Remove'), cancel: t('Cancel')},
      onok: this.removeAllPermissions,
      oncancel: dialog.destroy
    };
    dialog.set(opts).show();
  }

  /**
   * Note: we remove "view_asset" permission, as it is the most basic one,
   * so removing it will in fact remove all permissions
   */
  removeAllPermissions() {
    this.setState({isBeingDeleted: true});
    const userViewAssetPerm = this.props.permissions.find((perm) => {
      return perm.permission === permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.view_asset).url;
    });
    actions.permissions.removeAssetPermission(this.props.uid, userViewAssetPerm.url);
  }

  onPermissionsEditorSubmitEnd(isSuccess) {
    if (isSuccess) {
      this.setState({isEditFormVisible: false});
    }
  }

  toggleEditForm() {
    this.setState({isEditFormVisible: !this.state.isEditFormVisible});
  }

  // TODO this doesn't display partial_permissions in a nice way,
  // as it assumes that there can be only "view" in them,
  // but this is partially a fault of Backend giving a non universal label to "partial_permissions"
  renderPermissions(permissions) {
    const maxParentheticalUsernames = 3;
    return (
      <bem.UserRow__perms>
        {permissions.map((perm) => {
          let permUsers = [];

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

          let permLabel = '???';
          if (this.props.assignablePerms.has(perm.permission)) {
            permLabel = this.props.assignablePerms.get(perm.permission);
            if (typeof permLabel === 'object') {
              // let's assume back end always returns a `default` property with
              // nested permissions
              permLabel = permLabel.default;
            }
          }

          // Hopefully this is friendly to translators of RTL languages
          let permNameTemplate;
          if (permUsers.length === 0) {
            permNameTemplate = '##permission_label##';
          } else if (permUsers.length <= maxParentheticalUsernames) {
            permNameTemplate = t('##permission_label## (##username_list##)');
          } else if (permUsers.length === maxParentheticalUsernames + 1) {
            permNameTemplate = t('##permission_label## (##username_list## and 1 other)');
          } else {
            permNameTemplate = t('##permission_label## (##username_list## and ' +
                                 '##hidden_username_count## others)');
          }

          let friendlyPermName = (
            permNameTemplate.replace('##permission_label##', permLabel)
                            .replace('##username_list##', permUsers.slice(0, maxParentheticalUsernames).join(', '))
                            .replace('##hidden_username_count##', permUsers.length - maxParentheticalUsernames)
          );


          return <bem.UserRow__perm
            title={perm.description}
            key={permLabel}
          >
            {friendlyPermName}
          </bem.UserRow__perm>;
        })}
      </bem.UserRow__perms>
    );
  }

  render() {
    const initialsStyle = {
      background: `#${stringToColor(this.props.user.name)}`
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
              {this.props.user.name.charAt(0)}
            </bem.AccountBox__initials>
          </bem.UserRow__avatar>

          <bem.UserRow__name>
            {this.props.user.name}
          </bem.UserRow__name>

          {this.props.user.isOwner &&
            <bem.UserRow__perms>{t('is owner')}</bem.UserRow__perms>
          }
          {!this.props.user.isOwner &&
            <React.Fragment>
              {this.renderPermissions(this.props.permissions)}

              <bem.Button m='icon' onClick={this.toggleEditForm}>
                {this.state.isEditFormVisible &&
                  <i className='k-icon k-icon-close'/>
                }
                {!this.state.isEditFormVisible &&
                  <i className='k-icon k-icon-edit'/>
                }
              </bem.Button>

              <bem.Button m='icon' onClick={this.removePermissions}>
                <i className='k-icon k-icon-trash' />
              </bem.Button>
            </React.Fragment>
          }
        </bem.UserRow__info>

        {this.state.isEditFormVisible &&
          <bem.UserRow__editor>
            <UserAssetPermsEditor
              uid={this.props.uid}
              username={this.props.user.name}
              permissions={this.props.permissions}
              assignablePerms={this.props.assignablePerms}
              nonOwnerPerms={this.props.nonOwnerPerms}
              onSubmitEnd={this.onPermissionsEditorSubmitEnd}
            />
          </bem.UserRow__editor>
        }
      </bem.UserRow>
      );
  }
}

reactMixin(UserPermissionRow.prototype, mixins.permissions);
reactMixin(UserPermissionRow.prototype, Reflux.ListenerMixin);

export default UserPermissionRow;
