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
import permParser from './permParser';
import {
  t,
  notify
} from 'js/utils';

/**
 * Displays a form for either giving a new user some permissions,
 * or for editing existing user permissions
 */
class UserPermissionsEditor extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);

    this.state = {
      // inner workings
      usernamesBeingChecked: new Set(),
      isSubmitPending: false,
      isEditingUsername: false,
      formViewDisabled: false,
      submissionsViewDisabled: false,
      // form user inputs
      username: '',
      formView: false,
      formEdit: false,
      submissionsView: false,
      submissionsViewPartial: false,
      submissionsViewPartialUsers: [],
      submissionsAdd: false,
      submissionsEdit: false,
      submissionsValidate: false
    };

    this.applyPropsData();
  }

  /*
   * Fills up form with provided user name and permissions (if applicable)
   */
  applyPropsData() {
    // TODO 1: set permissions from props if given
    // TODO 2: set mode based on props (i.e. editing existing permissions vs giving new)

    console.log('applyPropsData', this.props);

    if (this.props.username) {
      this.state.username = this.props.username;
    }
  }

  componentDidMount() {
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

  /*
   * Single callback for all checkboxes to keep the complex connections logic
   * being up to date regardless which one changed
   * NOTE: the order of things is important
   */
  onCheckboxChange(id, isChecked) {
    // apply checked checkbox change to state
    const newState = this.state;
    newState[id] = isChecked;

    // reset partial inputs when unchecking `submissionsView`
    if (newState.submissionsView === false) {
      newState.submissionsViewPartial = false;
      newState.submissionsViewPartialUsers = [];
    }

    this.setState(newState);

    this.verifyConnectedCheckboxes();
  }

  /*
   * Checking some of the checkboxes implies that other are also checked
   * and disabled (to avoid users from submitting invalid data)
   */
  verifyConnectedCheckboxes() {
    const newState = this.state;

    // reset disabling before checks
    newState.formViewDisabled = false;
    newState.submissionsViewDisabled = false;

    // checking these options implies having `formView`
    if (
      newState.formEdit ||
      newState.submissionsView ||
      newState.submissionsViewPartial ||
      newState.submissionsAdd ||
      newState.submissionsEdit ||
      newState.submissionsValidate
    ) {
      newState.formView = true;
      newState.formViewDisabled = true;
    }

    // checking these options implies having `submissionsView`
    if (
      newState.submissionsEdit ||
      newState.submissionsValidate
    ) {
      newState.submissionsView = true;
      newState.submissionsViewDisabled = true;
    }

    // apply changes of connected checkboxes to state
    this.setState(newState);
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

  onSubmissionsViewPartialUsersChange(allUsers) {
    const submissionsViewPartialUsers = [];

    allUsers.forEach((username) => {
      const userCheck = this.checkUsernameSync(username);
      if (userCheck === true) {
        submissionsViewPartialUsers.push(username);
      } else if (userCheck === undefined) {
        // we add unknown usernames for now and will check and possibly remove
        // with checkUsernameAsync
        submissionsViewPartialUsers.push(username);
        this.checkUsernameAsync(username);
      } else {
        this.notifyUnknownUser(username);
      }
    });

    this.setState({submissionsViewPartialUsers: submissionsViewPartialUsers});
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
    const submissionsViewPartialUsers = this.state.submissionsViewPartialUsers;
    submissionsViewPartialUsers.forEach((username) => {
      if (result[username] === false) {
        submissionsViewPartialUsers.pop(submissionsViewPartialUsers.indexOf(username));
        this.notifyUnknownUser(username);
      }
    });
    this.setState({submissionsViewPartialUsers: submissionsViewPartialUsers});

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

    const parsedData = permParser.parseFormData({
      username: this.state.username,
      formView: this.state.formView,
      formEdit: this.state.formEdit,
      submissionsView: this.state.submissionsView,
      submissionsViewPartial: this.state.submissionsViewPartial,
      submissionsViewPartialUsers: this.state.submissionsViewPartialUsers,
      submissionsAdd: this.state.submissionsAdd,
      submissionsEdit: this.state.submissionsEdit,
      submissionsValidate: this.state.submissionsValidate
    });

    // TODO: add or patch permission
    console.log('submit', this.state, parsedData);

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
    const isNew = typeof this.props.username === 'undefined';

    const submissionsViewPartialUsersInputProps = {
      placeholder: t('Add username(s)')
    };

    const formModifiers = [];
    if (this.state.isSubmitPending) {
      formModifiers.push('pending');
    }

    const formClassNames = classNames(
      'user-permissions-editor',
      isNew ? 'user-permissions-editor--new' : ''
    );

    return (
      <bem.FormModal__form
        m={formModifiers}
        className={formClassNames}
        onSubmit={this.submit}
      >
        {isNew &&
          // don't display username editor for editing existing user
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
            checked={this.state.formView}
            disabled={this.state.formViewDisabled}
            onChange={this.onCheckboxChange.bind(this, 'formView')}
            label={t('View Form')}
          />

          <Checkbox
            checked={this.state.formEdit}
            onChange={this.onCheckboxChange.bind(this, 'formEdit')}
            label={t('Edit Form')}
          />

          <div className={classNames(
            this.state.submissionsView === true ? 'user-permissions-editor__row user-permissions-editor__row--group' : ''
          )}>
            <Checkbox
              checked={this.state.submissionsView}
              disabled={this.state.submissionsViewDisabled}
              onChange={this.onCheckboxChange.bind(this, 'submissionsView')}
              label={t('View Submissions')}
            />

            {this.state.submissionsView === true &&
              <div>
                <Checkbox
                  checked={this.state.submissionsViewPartial}
                  onChange={this.onCheckboxChange.bind(this, 'submissionsViewPartial')}
                  label={t('Restrict to submissions made by certain users')}
                />

                {this.state.submissionsViewPartial === true &&
                  <TagsInput
                    value={this.state.submissionsViewPartialUsers}
                    onChange={this.onSubmissionsViewPartialUsersChange}
                    inputProps={submissionsViewPartialUsersInputProps}
                    onlyUnique
                  />
                }
              </div>
            }
          </div>

          <Checkbox
            checked={this.state.submissionsAdd}
            onChange={this.onCheckboxChange.bind(this, 'submissionsAdd')}
            label={t('Add Submissions')}
          />

          <Checkbox
            checked={this.state.submissionsEdit}
            onChange={this.onCheckboxChange.bind(this, 'submissionsEdit')}
            label={t('Edit Submissions')}
          />

          <Checkbox
            checked={this.state.submissionsValidate}
            onChange={this.onCheckboxChange.bind(this, 'submissionsValidate')}
            label={t('Validate Submissions')}
          />
        </div>

        <div className='user-permissions-editor__row'>
          <bem.Button
            m={['raised', 'colored']}
            type='submit'
            disabled={!this.isSubmitEnabled()}
            >
              {isNew ? t('Grant permissions') : t('Update permissions')}
            </bem.Button>
        </div>
      </bem.FormModal__form>
    );
  }
}
reactMixin(UserPermissionsEditor.prototype, Reflux.ListenerMixin);

export default UserPermissionsEditor;
