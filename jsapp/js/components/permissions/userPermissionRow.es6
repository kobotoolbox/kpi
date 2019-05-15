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
import UserPermissionsEditor from './userPermissionsEditor';
import permConfig from './permConfig';

class UserPermissionRow extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);

    this.state = {
      isEditFormVisible: false,
      isBeingDeleted: false
    };

    this.availablePermissions = permConfig.getAvailablePermissions(this.props.kind);
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
      message: t('This action will remove all permissions for user ##username##').replace('##username##', `<strong>${this.props.username}</strong>`),
      labels: {ok: t('Remove'), cancel: t('Cancel')},
      onok: () => {
        this.setState({isBeingDeleted: true});
        // we remove "view" permission, as it is the most basic one, so removing it
        // will in fact remove all permissions
        actions.permissions.removePerm({
          permission_url: this.props.can.view.url,
          content_object_uid: this.props.uid
        });
      },
      oncancel: dialog.destroy
    };
    dialog.set(opts).show();
  }

  onPermissionsEditorSubmitEnd(isSuccess) {
    if (isSuccess) {
      this.setState({isEditFormVisible: false});
    }
  }

  toggleEditForm() {
    this.setState({isEditFormVisible: !this.state.isEditFormVisible});
  }

  render () {
    const initialsStyle = {
      background: `#${stringToColor(this.props.username)}`
    };

    const cans = [];
    for (let key in this.props.can) {
      let perm = this.availablePermissions.find(function (d) {return d.value === key;});
      if (perm && perm.label) {
        cans.push(perm.label);
      }
    }
    const cansString = cans.sort().join(', ');

    const modifiers = [];
    if (cans.length === 0) {
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

          <bem.UserRow__name>
            {this.props.username}
          </bem.UserRow__name>

          <bem.UserRow__role title={cansString}>
            {cansString}
          </bem.UserRow__role>

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
        </bem.UserRow__info>

        {this.state.isEditFormVisible &&
          <bem.UserRow__editor>
            <UserPermissionsEditor
              username={this.props.username}
              uid={this.props.uid}
              cans={cans}
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
