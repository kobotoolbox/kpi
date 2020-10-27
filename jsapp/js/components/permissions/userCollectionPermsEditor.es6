// TODO remove all this code when https://github.com/kobotoolbox/kpi/issues/2332 is done

import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import Checkbox from 'js/components/checkbox';
import TextBox from 'js/components/textBox';
import {stores} from 'js/stores';
import {actions} from 'js/actions';
import {bem} from 'js/bem';
import permConfig from './permConfig';
import {
  t,
  notify,
  buildUserUrl
} from 'js/utils';
import {
  ANON_USERNAME,
  PERMISSIONS_CODENAMES,
  COLLECTION_PERMISSIONS
} from 'js/constants';

/**
 * Form for adding/changing user permissions for collections.
 */
class UserCollectionPermissionsEditor extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);

    this.state = {
      // inner workings
      usernamesBeingChecked: new Set(),
      isSubmitPending: false,
      isEditingUsername: false,
      // form user inputs
      username: '',
      collectionView: false,
      collectionViewDisabled: false,
      collectionEdit: false
    };

    this.applyPropsData();
  }

  /**
   * Fills up form with provided user name and permissions (if applicable)
   */
  applyPropsData() {
    if (this.props.permissions) {
      const parsedPropsPerms = this.parsePropsPerms(this.props.permissions);
      this.state.collectionView = parsedPropsPerms.viewUrl !== null;
      this.state.collectionEdit = parsedPropsPerms.changeUrl !== null;
      this.state.collectionViewDisabled = this.state.collectionEdit;
    }
    if (this.props.username) {
      this.state.username = this.props.username;
    }
  }

  parsePropsPerms(perms) {
    const out = {
      viewUrl: null,
      changeUrl: null
    };

    perms.forEach((perm) => {
      if (perm.permission.endsWith(`${PERMISSIONS_CODENAMES.get('view_collection')}/`)) {
        out.viewUrl = perm.url;
      }
      if (perm.permission.endsWith(`${PERMISSIONS_CODENAMES.get('change_collection')}/`)) {
        out.changeUrl = perm.url;
      }
    });

    return out;
  }

  componentDidMount() {
    this.listenTo(actions.permissions.assignCollectionPermission.completed, this.onChangeCollectionPermissionCompleted);
    this.listenTo(actions.permissions.assignCollectionPermission.failed, this.onChangeCollectionPermissionFailed);
    this.listenTo(actions.permissions.removeCollectionPermission.completed, this.onChangeCollectionPermissionCompleted);
    this.listenTo(actions.permissions.removeCollectionPermission.failed, this.onChangeCollectionPermissionFailed);
    this.listenTo(stores.userExists, this.onUserExistsStoreChange);
  }

  onChangeCollectionPermissionCompleted() {
    this.setState({isSubmitPending: false});
    if (typeof this.props.onSubmitEnd === 'function') {
      this.props.onSubmitEnd(true);
    }
  }

  onChangeCollectionPermissionFailed() {
    this.setState({isSubmitPending: false});
    if (typeof this.props.onSubmitEnd === 'function') {
      this.props.onSubmitEnd(false);
    }
  }

  /**
   * Single callback for all checkboxes.
   */
  onCheckboxChange(id, isChecked) {
    const newState = this.state;
    newState[id] = isChecked;
    newState.collectionViewDisabled = false;
    if (id === 'collectionEdit' && isChecked) {
      newState.collectionView = true;
      newState.collectionViewDisabled = true;
    }
    this.setState(newState);
  }

  /**
   * We need it just to update the input,
   * the real work is handled by onUsernameChangeEnd.
   */
  onUsernameChange(username) {
    this.setState({
      username: username,
      isEditingUsername: true
    });
  }

  /**
   * Checks if username exist on the Backend and clears input if doesn't.
   */
  onUsernameChangeEnd() {
    this.setState({isEditingUsername: false});

    if (this.state.username === '') {
      return;
    }

    const userCheck = this.checkUsernameSync(this.state.username);
    if (userCheck === undefined) {
      this.checkUsernameAsync(this.state.username);
    } else if (userCheck === false) {
      this.notifyUnknownUser(this.state.username);
      this.setState({username: ''});
    }
  }

  /**
   * Enables Enter key on username input.
   */
  onUsernameKeyPress(key, evt) {
    if (key === 'Enter') {
      evt.currentTarget.blur();
      evt.preventDefault(); // prevent submitting form
    }
  }

  /**
   * This function returns either boolean (for known username) or undefined
   * for usernames that weren't checked before
   */
  checkUsernameSync(username) {
    return stores.userExists.checkUsername(username);
  }

  /**
   * This function calls API and relies on onUserExistsStoreChange callback
   */
  checkUsernameAsync(username) {
    const usernamesBeingChecked = this.state.usernamesBeingChecked;
    usernamesBeingChecked.add(username);
    this.setState({usernamesBeingChecked: usernamesBeingChecked});
    actions.misc.checkUsername(username);
  }

  notifyUnknownUser(username) {
    if (navigator.onLine) {
      notify(`${t('User not found:')} ${username}`, 'warning');
    }
  }

  /**
   * Remove nonexistent username from username input.
   */
  onUserExistsStoreChange(result) {
    // check username
    if (result[this.state.username] === false) {
      this.notifyUnknownUser(this.state.username);
      this.setState({username: ''});
    }

    // clean usernamesBeingChecked array
    Object.keys(result).forEach((username) => {
      const usernamesBeingChecked = this.state.usernamesBeingChecked;
      usernamesBeingChecked.delete(username);
      this.setState({usernamesBeingChecked: usernamesBeingChecked});
    });
  }

  /**
   * Blocks submitting non-ready form.
   */
  isSubmitEnabled() {
    const isAnyCheckboxChecked = (
      this.state.collectionView ||
      this.state.collectionEdit
    );
    return (
      isAnyCheckboxChecked &&
      !this.state.isSubmitPending &&
      !this.state.isEditingUsername &&
      this.state.username.length > 0 &&
      this.state.usernamesBeingChecked.size === 0 &&
      // we don't allow manual setting anonymous user permissions through UI
      this.state.username !== ANON_USERNAME
    );
  }

  submit(evt) {
    evt.preventDefault();

    if (!this.isSubmitEnabled()) {
      return;
    }

    let permToSet = null;
    let permToRemove = null;
    const isNew = !this.props.permissions;

    if (isNew) {
      if (this.state.collectionEdit) {
        permToSet = PERMISSIONS_CODENAMES.get('change_collection');
      }
      if (!this.state.collectionEdit && this.state.collectionView) {
        permToSet = PERMISSIONS_CODENAMES.get('view_collection');
      }
    } else {
      const parsedPropsPerms = this.parsePropsPerms(this.props.permissions);
      if (!isNew && parsedPropsPerms.changeUrl === null && this.state.collectionEdit) {
        permToSet = PERMISSIONS_CODENAMES.get('change_collection');
      }
      if (!isNew && parsedPropsPerms.changeUrl !== null && !this.state.collectionEdit) {
        permToRemove = parsedPropsPerms.changeUrl;
      }
    }

    if (permToRemove) {
      actions.permissions.removeCollectionPermission(this.props.uid, permToRemove);
      this.setState({isSubmitPending: true});
    }
    if (permToSet) {
      actions.permissions.assignCollectionPermission(
        this.props.uid, {
          user: buildUserUrl(this.state.username),
          permission: permConfig.getPermissionByCodename(permToSet).url
        }
      );
      this.setState({isSubmitPending: true});
    }

    // if nothing changes but user wants submits, just notify parent we're good
    if (
      permToSet === null &&
      permToRemove === null &&
      !this.state.isSubmitPending &&
      typeof this.props.onSubmitEnd === 'function'
    ) {
      this.props.onSubmitEnd(true);
    }

    return false;
  }

  render() {
    const isNew = typeof this.props.username === 'undefined';

    const formModifiers = [];
    if (this.state.isSubmitPending) {
      formModifiers.push('pending');
    }

    return (
      <bem.FormModal__form
        m={formModifiers}
        className='user-permissions-editor'
        onSubmit={this.submit}
      >
        {isNew &&
          // don't display username editor when editing existing user
          <div className='user-permissions-editor__row user-permissions-editor__row--username'>
            <TextBox
              placeholder={t('username')}
              value={this.state.username}
              onChange={this.onUsernameChange}
              onBlur={this.onUsernameChangeEnd}
              onKeyPress={this.onUsernameKeyPress}
            />
          </div>
        }

        <div className='user-permissions-editor__row'>
          <Checkbox
            checked={this.state.collectionView}
            disabled={this.state.collectionViewDisabled}
            onChange={this.onCheckboxChange.bind(this, 'collectionView')}
            label={COLLECTION_PERMISSIONS[PERMISSIONS_CODENAMES.get('view_collection')]}
          />

          <Checkbox
            checked={this.state.collectionEdit}
            onChange={this.onCheckboxChange.bind(this, 'collectionEdit')}
            label={COLLECTION_PERMISSIONS[PERMISSIONS_CODENAMES.get('change_collection')]}
          />
        </div>

        <div className='user-permissions-editor__row'>
          <bem.KoboButton
            m='blue'
            type='submit'
            disabled={!this.isSubmitEnabled()}
            >
              {isNew ? t('Grant permissions') : t('Update permissions')}
            </bem.KoboButton>
        </div>
      </bem.FormModal__form>
    );
  }
}
reactMixin(UserCollectionPermissionsEditor.prototype, Reflux.ListenerMixin);

export default UserCollectionPermissionsEditor;
