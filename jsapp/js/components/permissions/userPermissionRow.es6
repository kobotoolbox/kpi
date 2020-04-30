import _ from 'underscore';
import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import alertify from 'alertifyjs';
import mixins from 'js/mixins';
import {stores} from 'js/stores';
import {actions} from 'js/actions';
import {bem} from 'js/bem';
import {
  t,
  stringToColor,
} from 'js/utils';
import {
  KEY_CODES,
  ASSET_KINDS,
  PERMISSIONS_CODENAMES,
  COLLECTION_PERMISSIONS
} from 'js/constants';
import UserAssetPermsEditor from './userAssetPermsEditor';
import UserCollectionPermsEditor from './userCollectionPermsEditor';
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
   * Note: we remove "view_asset"/"view_collection" permission, as it is
   * the most basic one, so removing it will in fact remove all permissions
   */
  removeAllPermissions() {
    let actionFn;
    let targetPermUrl;
    if (this.props.kind === ASSET_KINDS.get('asset')) {
      actionFn = actions.permissions.removeAssetPermission;
      targetPermUrl = permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.get('view_asset')).url;
    } else if (this.props.kind === ASSET_KINDS.get('collection')) {
      actionFn = actions.permissions.removeCollectionPermission;
      targetPermUrl = permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.get('view_collection')).url;
    }

    this.setState({isBeingDeleted: true});

    const userViewAssetPerm = this.props.permissions.find((perm) => {
      return perm.permission === targetPermUrl;
    });
    actionFn(this.props.uid, userViewAssetPerm.url);
  }

  onPermissionsEditorSubmitEnd(isSuccess) {
    if (isSuccess) {
      this.setState({isEditFormVisible: false});
    }
  }

  toggleEditForm() {
    this.setState({isEditFormVisible: !this.state.isEditFormVisible});
  }

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

          let permName = '???';
          // TODO simplify this code when https://github.com/kobotoolbox/kpi/issues/2332 is done
          if (this.props.kind === ASSET_KINDS.get('asset')) {
            if (this.props.assignablePerms.has(perm.permission)) {
              permName = this.props.assignablePerms.get(perm.permission);
            }
          }
          if (this.props.kind === ASSET_KINDS.get('collection')) {
            permName = COLLECTION_PERMISSIONS[permConfig.getPermission(perm.permission).codename];
          }

          // Hopefully this is friendly to translators of RTL languages
          let permNameTemplate;
          if (permUsers.length === 0) {
            permNameTemplate = '##permission_name##';
          } else if (permUsers.length <= maxParentheticalUsernames) {
            permNameTemplate = t('##permission_name## (##username_list##)');
          } else if (permUsers.length === maxParentheticalUsernames + 1) {
            permNameTemplate = t('##permission_name## (##username_list## and 1 other)');
          } else {
            permNameTemplate = t('##permission_name## (##username_list## and ' +
                                 '##hidden_username_count## others)');
          }
          let friendlyPermName = (
            permNameTemplate.replace('##permission_name##', permName)
                            .replace('##username_list##', permUsers.slice(0, maxParentheticalUsernames).join(', '))
                            .replace('##hidden_username_count##', permUsers.length - maxParentheticalUsernames)
          );


          return <bem.UserRow__perm
            title={perm.description}
            key={permName}
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
            {/* TODO simplify this code when https://github.com/kobotoolbox/kpi/issues/2332 is done */}
            {this.props.kind === ASSET_KINDS.get('asset') &&
              <UserAssetPermsEditor
                uid={this.props.uid}
                username={this.props.user.name}
                permissions={this.props.permissions}
                assignablePerms={this.props.assignablePerms}
                nonOwnerPerms={this.props.nonOwnerPerms}
                onSubmitEnd={this.onPermissionsEditorSubmitEnd}
              />
            }
            {this.props.kind === ASSET_KINDS.get('collection') &&
              <UserCollectionPermsEditor
                uid={this.props.uid}
                username={this.props.user.name}
                permissions={this.props.permissions}
                onSubmitEnd={this.onPermissionsEditorSubmitEnd}
              />
            }

          </bem.UserRow__editor>
        }
      </bem.UserRow>
      );
  }
}

reactMixin(UserPermissionRow.prototype, mixins.permissions);
reactMixin(UserPermissionRow.prototype, Reflux.ListenerMixin);

export default UserPermissionRow;
