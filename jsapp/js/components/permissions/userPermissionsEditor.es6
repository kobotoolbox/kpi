import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import TagsInput from 'react-tagsinput';
import Checkbox from 'js/components/checkbox';
import TextBox from 'js/components/textbox';
import stores from 'js/stores';
import actions from 'js/actions';
import bem from 'js/bem';
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
      username: '',
      isEditingUsername: false,
      view: false,
      change: false,
      view_submissions: false,
      add_submissions: false,
      change_submissions: false,
      validate_submissions: false,
      restricted_view: false,
      restricted_view_users: [],
      usernamesBeingChecked: new Set()
    };
  }

  componentDidMount() {
    // TODO 1: set permissions from props if given
    // TODO 2: set mode based on props (i.e. editing existing permissions vs giving new)

    this.listenTo(stores.userExists, this.onUserExistsStoreChange);
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

  restrictedUsersChange(allUsers, changedUsers) {
    const restrictedUsers = [];

    allUsers.forEach((username) => {
      const userCheck = this.checkUsernameSync(username);
      if (userCheck === true) {
        restrictedUsers.push(username);
      } else if (userCheck === undefined) {
        // we add unknown usernames for now and will check with checkUsernameAsync
        restrictedUsers.push(username);
        this.checkUsernameAsync(username);
      } else {
        this.notifyUnknownUser(username);
      }
    })

    this.setState({restricted_view_users: restrictedUsers});
  }

  /**
   * This function returns either boolean (for known username) or undefined
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
    // check restricted users
    const restrictedUsers = this.state.restricted_view_users;
    restrictedUsers.forEach((username) => {
      if (result[username] === false) {
        restrictedUsers.pop(restrictedUsers.indexOf(username));
        this.notifyUnknownUser(username);
      }
    });
    this.setState({restricted_view_users: restrictedUsers});

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
      !this.state.isEditingUsername &&
      this.state.username.length > 0 &&
      this.state.usernamesBeingChecked.size === 0
    )
  }

  submit() {
    if (!this.isSubmitEnabled()) {
      return;
    }

    // TODO: add or patch permission
    console.log('submit', this.state);
  }

  render() {
    const restrictedViewUsersInputProps = {
      placeholder: t('Add username(s)')
    };

    return (
      <bem.FormModal__form
        onSubmit={this.submit}
      >
        {t('Grant permissions to')}

        <TextBox
          placeholder={t('username')}
          value={this.state.username}
          onChange={this.onUsernameChange}
          onBlur={this.onUsernameChangeEnd}
          onKeyPress={this.onUsernameKeyPress}
        />

        <Checkbox
          checked={this.state.view}
          onChange={this.togglePerm.bind(this, 'view')}
          label={AVAILABLE_PERMISSIONS.get('view')}
        />

        {this.state.view === true &&
          <div>
            <Checkbox
              checked={this.state.restricted_view}
              onChange={this.togglePerm.bind(this, 'restricted_view')}
              label={t('Restrict to submissions made by certain users')}
            />

            {this.state.restricted_view === true &&
              <TagsInput
                value={this.state.restricted_view_users}
                onChange={this.restrictedUsersChange}
                inputProps={restrictedViewUsersInputProps}
                onlyUnique
              />
            }
          </div>
        }

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

        <bem.Button
          m={['raised', 'colored']}
          type='submit'
          disabled={!this.isSubmitEnabled()}
        >
          {t('Submit')}
        </bem.Button>
      </bem.FormModal__form>
    );
  }
}
reactMixin(UserPermissionsEditor.prototype, Reflux.ListenerMixin);

export default UserPermissionsEditor;
