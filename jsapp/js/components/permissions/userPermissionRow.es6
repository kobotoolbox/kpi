import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import alertify from 'alertifyjs';
import mixins from 'js/mixins';
import stores from 'js/stores';
import actions from 'js/actions';
import bem from 'js/bem';
import {
  t,
  stringToColor,
} from 'js/utils';
import {
  ASSET_KINDS,
  PERMISSIONS_CODENAMES
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

    let okCallback;
    if (this.props.kind === ASSET_KINDS.get('asset')) {
      okCallback = this.removeAssetPermissions;
    } else if (this.props.kind === ASSET_KINDS.get('collection')) {
      okCallback = this.removeCollectionPermissions;
    }

    const opts = {
      title: t('Remove permissions?'),
      message: t('This action will remove all permissions for user ##username##').replace('##username##', `<strong>${this.props.user.name}</strong>`),
      labels: {ok: t('Remove'), cancel: t('Cancel')},
      onok: okCallback,
      oncancel: dialog.destroy
    };
    dialog.set(opts).show();
  }

  removeAssetPermissions() {
    this.setState({isBeingDeleted: true});
    // we remove "view_asset" permission, as it is the most basic one, so removing it
    // will in fact remove all permissions
    const userViewAssetPerm = this.props.permissions.find((perm) => {
      return perm.permission === permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.get('view_asset')).url;
    });
    actions.permissions.removeAssetPermissions(this.props.uid, [userViewAssetPerm.url]);
  }

  removeCollectionPermissions() {
    this.setState({isBeingDeleted: true});
    // we remove "view_asset" permission, as it is the most basic one, so removing it
    // will in fact remove all permissions
    const userViewCollectionPerm = this.props.permissions.find((perm) => {
      return perm.permission === permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.get('view_collection')).url;
    });
    actions.permissions.removePerm({
      permission_url: userViewCollectionPerm.url,
      content_object_uid: this.props.uid
    });
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

          return <bem.UserRow__perm
            title={perm.description}
            key={perm.name}
          >
            {perm.name}

            {permUsers.length > 0 &&
              ' (' + permUsers.join(', ') + ')'
            }
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
            {this.props.kind === ASSET_KINDS.get('asset') &&
              <UserAssetPermsEditor
                username={this.props.user.name}
                permissions={this.props.permissions}
                uid={this.props.uid}
                onSubmitEnd={this.onPermissionsEditorSubmitEnd}
              />
            }
            {this.props.kind === ASSET_KINDS.get('collection') &&
              <UserCollectionPermsEditor
                username={this.props.user.name}
                permissions={this.props.permissions}
                uid={this.props.uid}
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
