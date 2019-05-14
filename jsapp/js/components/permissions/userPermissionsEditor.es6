import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import TagsInput from 'react-tagsinput';
import Checkbox from 'js/components/checkbox';
import TextBox from 'js/components/textBox';
import stores from 'js/stores';
import actions from 'js/actions';
import bem from 'js/bem';
import classNames from 'classnames';
import {
  t,
  notify
} from 'js/utils';
import {
  AVAILABLE_PERMISSIONS
} from 'js/constants';

/**
 * Displays a form for either giving a new user some permissions,
 * or for editing existing user permissions
 */
class UserPermissionsEditor extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);

    this.state = {
      isSubmitPending: false,
      username: '',
      isEditingUsername: false,
      view: false,
      change: false,
      view_submissions: false,
      add_submissions: false,
      change_submissions: false,
      validate_submissions: false,
      partial_view: false,
      partial_view_users: [],
      usernamesBeingChecked: new Set()
    };
  }

  componentDidMount() {
    // TODO 1: set permissions from props if given
    // TODO 2: set mode based on props (i.e. editing existing permissions vs giving new)

    this.listenTo(actions.permissions.assignPerm.completed, this.onAssignPermCompleted);
    this.listenTo(actions.permissions.assignPerm.failed, this.onAssignPermFailed);
    this.listenTo(stores.userExists, this.onUserExistsStoreChange);
  }

  onAssignPermCompleted() {
    this.setState({isSubmitPending: false});
    if (typeof this.props.onSubmitEnd === 'function') {
      this.props.onSubmitEnd(true);
    }
  }

  onAssignPermFailed() {
    this.setState({isSubmitPending: false});
    if (typeof this.props.onSubmitEnd === 'function') {
      this.props.onSubmitEnd(false);
    }
  }

  /**
   * handles changes to permission checkboxes
   */
  togglePerm(permId) {
    let newPerms = {};
    newPerms[permId] = !this.state[permId];
    this.setState(newPerms);
  }

  /**
   * we need it just to update the input,
   * real work is handled by onUsernameChangeEnd
   */
  onUsernameChange(username) {
    this.setState({
      username: username,
      isEditingUsername: true
    });
  }

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

  onUsernameKeyPress(key, evt) {
    if (key === 'Enter') {
      evt.currentTarget.blur();
      evt.preventDefault(); // prevent submitting form
    }
  }

  onPartialViewUsersChange(allUsers) {
    const partialViewUsers = [];

    allUsers.forEach((username) => {
      const userCheck = this.checkUsernameSync(username);
      if (userCheck === true) {
        partialViewUsers.push(username);
      } else if (userCheck === undefined) {
        // we add unknown usernames for now and will check and possibly remove
        // with checkUsernameAsync
        partialViewUsers.push(username);
        this.checkUsernameAsync(username);
      } else {
        this.notifyUnknownUser(username);
      }
    });

    this.setState({partial_view_users: partialViewUsers});
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
    notify(`${t('User not found:')} ${username}`, 'warning');
  }

  /**
   * Remove nonexistent usernames from tagsinput array
   */
  onUserExistsStoreChange(result) {
    // check partial view users
    const partialViewUsers = this.state.partial_view_users;
    partialViewUsers.forEach((username) => {
      if (result[username] === false) {
        partialViewUsers.pop(partialViewUsers.indexOf(username));
        this.notifyUnknownUser(username);
      }
    });
    this.setState({partial_view_users: partialViewUsers});

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

  isSubmitEnabled() {
    return (
      !this.state.isSubmitPending &&
      !this.state.isEditingUsername &&
      this.state.username.length > 0 &&
      this.state.usernamesBeingChecked.size === 0
    );
  }

  submit() {
    if (!this.isSubmitEnabled()) {
      return;
    }

    // TODO: add or patch permission
    console.log('submit', this.state);

    // make sure user exists
    if (this.checkUsernameSync(this.state.username)) {
      this.setState({isSubmitPending: true});
      actions.permissions.assignPerm({
        username: this.state.username,
        uid: this.props.uid,
        kind: this.props.kind,
        objectUrl: this.props.objectUrl,
        role: 'view'
      });
    }
  }

  render() {
    const partialViewUsersInputProps = {
      placeholder: t('Add username(s)')
    };

    const modifiers = [];
    if (this.state.isSubmitPending) {
      modifiers.push('pending');
    }

    return (
      <bem.FormModal__form
        m={modifiers}
        className='user-permissions-editor'
        onSubmit={this.submit}
      >
        {t('Grant permissions to')}

        <div className='user-permissions-editor__row'>
          <TextBox
            placeholder={t('username')}
            value={this.state.username}
            onChange={this.onUsernameChange}
            onBlur={this.onUsernameChangeEnd}
            onKeyPress={this.onUsernameKeyPress}
          />
        </div>

        <div className={classNames(
          this.state.view === true ? 'user-permissions-editor__row user-permissions-editor__row--group' : ''
        )}>
          <Checkbox
            checked={this.state.view}
            onChange={this.togglePerm.bind(this, 'view')}
            label={AVAILABLE_PERMISSIONS.get('view')}
          />

          {this.state.view === true &&
            <div>
              <Checkbox
                checked={this.state.partial_view}
                onChange={this.togglePerm.bind(this, 'partial_view')}
                label={t('Restrict to submissions made by certain users')}
              />

              {this.state.partial_view === true &&
                <TagsInput
                  value={this.state.partial_view_users}
                  onChange={this.onPartialViewUsersChange}
                  inputProps={partialViewUsersInputProps}
                  onlyUnique
                />
              }
            </div>
          }
        </div>

        <div className='user-permissions-editor__row'>
          <Checkbox
            checked={this.state.change}
            onChange={this.togglePerm.bind(this, 'change')}
            label={AVAILABLE_PERMISSIONS.get('change')}
          />

          <Checkbox
            checked={this.state.view_submissions}
            onChange={this.togglePerm.bind(this, 'view_submissions')}
            label={AVAILABLE_PERMISSIONS.get('view_submissions')}
          />

          <Checkbox
            checked={this.state.add_submissions}
            onChange={this.togglePerm.bind(this, 'add_submissions')}
            label={AVAILABLE_PERMISSIONS.get('add_submissions')}
          />

          <Checkbox
            checked={this.state.change_submissions}
            onChange={this.togglePerm.bind(this, 'change_submissions')}
            label={AVAILABLE_PERMISSIONS.get('change_submissions')}
          />

          <Checkbox
            checked={this.state.validate_submissions}
            onChange={this.togglePerm.bind(this, 'validate_submissions')}
            label={AVAILABLE_PERMISSIONS.get('validate_submissions')}
          />
        </div>

        <div className='user-permissions-editor__row'>
          <bem.Button
            m={['raised', 'colored']}
            type='submit'
            disabled={!this.isSubmitEnabled()}
            >
              {this.props.username ? t('Update') : t('Submit')}
            </bem.Button>
        </div>
      </bem.FormModal__form>
    );
  }
}
reactMixin(UserPermissionsEditor.prototype, Reflux.ListenerMixin);

export default UserPermissionsEditor;
