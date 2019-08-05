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
  assign,
  t,
  notify,
  buildUserUrl
} from 'js/utils';

/**
 * Form for adding/changing user permissions for surveys.
 *
 * @prop uid - asset uid
 * @prop username - permissions user username (could be empty for new)
 * @prop permissions - list of permissions (could be empty for new)
 * @prop onSubmitEnd - callback to be run when submit ends (success or failure)
 */
class UserAssetPermsEditor extends React.Component {
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
      formView: false,
      formViewDisabled: false,
      formEdit: false,
      submissionsView: false,
      submissionsViewDisabled: false,
      submissionsViewPartial: false,
      submissionsViewPartialDisabled: false,
      submissionsViewPartialUsers: [],
      submissionsAdd: false,
      submissionsEdit: false,
      submissionsEditDisabled: false,
      submissionsValidate: false,
      submissionsValidateDisabled: false
    };

    this.applyPropsData();
  }

  /**
   * Fills up form with provided user name and permissions (if applicable)
   */
  applyPropsData() {
    if (this.props.permissions) {
      const formData = permParser.buildFormData(this.props.permissions);
      this.state = this.applyValidityRules(assign(this.state, formData));
    }

    if (this.props.username) {
      this.state.username = this.props.username;
    }
  }

  componentDidMount() {
    this.listenTo(actions.permissions.bulkSetAssetPermissions.completed, this.onBulkSetAssetPermissionCompleted);
    this.listenTo(actions.permissions.bulkSetAssetPermissions.failed, this.onBulkSetAssetPermissionFailed);
    this.listenTo(stores.userExists, this.onUserExistsStoreChange);
  }

  onBulkSetAssetPermissionCompleted() {
    this.setState({isSubmitPending: false});
    this.notifyParentAboutSubmitEnd(true);
  }

  onBulkSetAssetPermissionFailed() {
    this.setState({isSubmitPending: false});
    this.notifyParentAboutSubmitEnd(false);
  }

  notifyParentAboutSubmitEnd(isSuccess) {
    if (
      !this.state.isSubmitPending &&
      typeof this.props.onSubmitEnd === 'function'
    ) {
      this.props.onSubmitEnd(isSuccess);
    }
  }

  /**
   * Single callback for all checkboxes to keep the complex connections logic
   * being up to date regardless which one changed.
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

    // needs to be called last
    this.setState(this.applyValidityRules(newState));
  }

  /**
   * Helps to avoid users submitting invalid data.
   *
   * Checking some of the checkboxes implies that other are also checked
   * and can't be unchecked.
   *
   * Checking some of the checkboxes implies that other can't be checked.
   *
   * @param {Object} state
   * @returns {Object} updated state
   */
  applyValidityRules(stateObj) {
    // reset disabling before checks
    stateObj.formViewDisabled = false;
    stateObj.submissionsViewDisabled = false;
    stateObj.submissionsViewPartialDisabled = false;
    stateObj.submissionsEditDisabled = false;
    stateObj.submissionsValidateDisabled = false;

    // checking these options implies having `formView` checked
    if (
      stateObj.formEdit ||
      stateObj.submissionsView ||
      stateObj.submissionsViewPartial ||
      stateObj.submissionsAdd ||
      stateObj.submissionsEdit ||
      stateObj.submissionsValidate
    ) {
      stateObj.formView = true;
      stateObj.formViewDisabled = true;
    }

    // checking these options implies having `submissionsView` checked
    if (
      stateObj.submissionsEdit ||
      stateObj.submissionsValidate
    ) {
      stateObj.submissionsView = true;
      stateObj.submissionsViewDisabled = true;
    }

    // checking `submissionsViewPartial` disallows checking two other options
    if (stateObj.submissionsViewPartial) {
      stateObj.submissionsEdit = false;
      stateObj.submissionsEditDisabled = true;
      stateObj.submissionsValidate = false;
      stateObj.submissionsValidateDisabled = true;
    }

    // checking these options disallows checking `submissionsViewPartial`
    if (
      stateObj.submissionsEdit ||
      stateObj.submissionsValidate
    ) {
      stateObj.submissionsViewPartial = false;
      stateObj.submissionsViewPartialDisabled = true;
      stateObj.submissionsViewPartialUsers = [];
    }

    return stateObj;
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
   * Handles TagsInput change event and blocks adding nonexistent usernames.
   */
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
   * Remove nonexistent usernames from TagsInput list and from username input.
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

  /**
   * Blocks submitting non-ready form.
   */
  isSubmitEnabled() {
    const isAnyCheckboxChecked = (
      this.state.formView ||
      this.state.formEdit ||
      this.state.submissionsView ||
      this.state.submissionsViewPartial ||
      this.state.submissionsAdd ||
      this.state.submissionsEdit ||
      this.state.submissionsValidate
    );
    return (
      isAnyCheckboxChecked &&
      !this.state.isSubmitPending &&
      !this.state.isEditingUsername &&
      this.state.username.length > 0 &&
      this.state.usernamesBeingChecked.size === 0
    );
  }

  getFormData() {
    return {
      username: this.state.username,
      formView: this.state.formView,
      formEdit: this.state.formEdit,
      submissionsView: this.state.submissionsView,
      submissionsViewPartial: this.state.submissionsViewPartial,
      submissionsViewPartialUsers: this.state.submissionsViewPartialUsers,
      submissionsAdd: this.state.submissionsAdd,
      submissionsEdit: this.state.submissionsEdit,
      submissionsValidate: this.state.submissionsValidate
    };
  }

  submit() {
    if (!this.isSubmitEnabled()) {
      return;
    }

    const formData = this.getFormData();
    const parsedUser = permParser.parseFormData(formData);

    if (parsedUser.length > 0) {
      // bulk endpoint needs all other users permissions to be passed
      let otherUserPerms = this.props.nonOwnerPerms.filter((perm) => {
        return perm.user !== buildUserUrl(formData.username);
      });
      this.setState({isSubmitPending: true});
      actions.permissions.bulkSetAssetPermissions(
        this.props.uid,
        otherUserPerms.concat(parsedUser)
      );
    } else {
      // if nothing changes but user submits, just notify parent we're good
      this.notifyParentAboutSubmitEnd(true);
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
                  disabled={this.state.submissionsViewPartialDisabled}
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
            disabled={this.state.submissionsEditDisabled}
            onChange={this.onCheckboxChange.bind(this, 'submissionsEdit')}
            label={t('Change Submissions')}
          />

          <Checkbox
            checked={this.state.submissionsValidate}
            disabled={this.state.submissionsValidateDisabled}
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
reactMixin(UserAssetPermsEditor.prototype, Reflux.ListenerMixin);

export default UserAssetPermsEditor;
