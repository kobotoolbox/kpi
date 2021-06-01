import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import Checkbox from 'js/components/common/checkbox';
import TextBox from 'js/components/common/textBox';
import {stores} from 'js/stores';
import {actions} from 'js/actions';
import {bem} from 'js/bem';
import {permParser} from './permParser';
import permConfig from './permConfig';
import {
  assign,
  notify,
  buildUserUrl
} from 'utils';
import {
  ANON_USERNAME,
  KEY_CODES,
  PERMISSIONS_CODENAMES
} from 'js/constants';

const PARTIAL_PLACEHOLDER = t('Enter usernames separated by commas');
const USERNAMES_SEPARATOR = ',';

/**
 * Form for adding/changing user permissions for surveys.
 *
 * @prop uid - asset uid
 * @prop username - permissions user username (could be empty for new)
 * @prop permissions - list of permissions (could be empty for new)
 * @prop assignablePerms - list of assignable permissions for given asset type
 * @prop nonOwnerPerms - list of permissions with exclusion of the asset owner permissions
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
      formEditDisabled: false,
      formEdit: false,
      submissionsView: false,
      submissionsViewDisabled: false,
      submissionsViewPartial: false,
      submissionsViewPartialDisabled: false,
      submissionsViewPartialUsers: [],
      submissionsAdd: false,
      submissionsAddDisabled: false,
      submissionsEdit: false,
      submissionsEditDisabled: false,
      submissionsDelete: false,
      submissionsDeleteDisabled: false,
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
    stateObj.formEditDisabled = false;
    stateObj.submissionsViewDisabled = false;
    stateObj.submissionsViewPartialDisabled = false;
    stateObj.submissionsAddDisabled = false;
    stateObj.submissionsDeleteDisabled = false;
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

    // checking `submissionsEdit` implies having `submissionsAdd` checked
    if (stateObj.submissionsEdit) {
      stateObj.submissionsAdd = true;
      stateObj.submissionsAddDisabled = true;
    }

    // checking these options implies having `submissionsView` checked
    if (
      stateObj.submissionsDelete ||
      stateObj.submissionsEdit ||
      stateObj.submissionsValidate
    ) {
      stateObj.submissionsView = true;
      stateObj.submissionsViewDisabled = true;
    }

    // checking `submissionsViewPartial` disallows checking two other options
    if (stateObj.submissionsViewPartial) {
      stateObj.submissionsDelete = false;
      stateObj.submissionsDeleteDisabled = true;
      stateObj.submissionsEdit = false;
      stateObj.submissionsEditDisabled = true;
      stateObj.submissionsValidate = false;
      stateObj.submissionsValidateDisabled = true;
    }

    // checking these options disallows checking `submissionsViewPartial`
    if (
      stateObj.submissionsDelete ||
      stateObj.submissionsEdit ||
      stateObj.submissionsValidate
    ) {
      stateObj.submissionsViewPartial = false;
      stateObj.submissionsViewPartialDisabled = true;
      stateObj.submissionsViewPartialUsers = [];
    }

    // `formManage` implies every other permission (except partial permissions)
    if (stateObj.formManage) {
      stateObj.formView = true;
      stateObj.formEdit = true;
      stateObj.submissionsAdd = true;
      stateObj.submissionsView = true;
      stateObj.submissionsDelete = true;
      stateObj.submissionsEdit = true;
      stateObj.submissionsValidate = true;

      stateObj.formViewDisabled = true;
      stateObj.formEditDisabled = true;
      stateObj.submissionsViewDisabled = true;
      stateObj.submissionsViewPartialDisabled = true;
      stateObj.submissionsAddDisabled = true;
      stateObj.submissionsDeleteDisabled = true;
      stateObj.submissionsEditDisabled = true;
      stateObj.submissionsValidateDisabled = true;
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
   * Enables Enter key on input.
   */
  onInputKeyPress(key, evt) {
    if (key === KEY_CODES.ENTER) {
      evt.currentTarget.blur();
      evt.preventDefault(); // prevent submitting form
    }
  }

  onSubmissionsViewPartialUsersChange(users) {
    this.setState({submissionsViewPartialUsers: users.trim().split(USERNAMES_SEPARATOR)});
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

  getLabel(permCodename) {
    return this.props.assignablePerms.get(
      permConfig.getPermissionByCodename(
        PERMISSIONS_CODENAMES[permCodename]
      ).url
    );
  }

  isAssignable(permCodename) {
    return this.props.assignablePerms.has(
      permConfig.getPermissionByCodename(
        PERMISSIONS_CODENAMES[permCodename]
      ).url
    );
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
      this.state.submissionsDelete ||
      this.state.submissionsEdit ||
      this.state.submissionsValidate
    );
    const isPartialValid = this.state.submissionsViewPartial ? this.state.submissionsViewPartialUsers.length !== 0 : true;
    return (
      isAnyCheckboxChecked &&
      isPartialValid &&
      !this.state.isSubmitPending &&
      !this.state.isEditingUsername &&
      this.state.username.length > 0 &&
      this.state.usernamesBeingChecked.size === 0 &&
      // we don't allow manual setting anonymous user permissions through UI
      this.state.username !== ANON_USERNAME
    );
  }

  /**
   * Returns only the properties for assignable permissions
   */
  getFormData() {
    const output = {
      username: this.state.username,
    };

    if (this.isAssignable('view_asset')) {output.formView = this.state.formView;}
    if (this.isAssignable('change_asset')) {output.formEdit = this.state.formEdit;}
    if (this.isAssignable('manage_asset')) {output.formManage = this.state.formManage;}
    if (this.isAssignable('add_submissions')) {output.submissionsAdd = this.state.submissionsAdd;}
    if (this.isAssignable('view_submissions')) {output.submissionsView = this.state.submissionsView;}
    if (this.isAssignable('partial_submissions')) {
      output.submissionsViewPartial = this.state.submissionsViewPartial;
      output.submissionsViewPartialUsers = this.state.submissionsViewPartialUsers;
    }
    if (this.isAssignable('change_submissions')) {output.submissionsEdit = this.state.submissionsEdit;}
    if (this.isAssignable('delete_submissions')) {output.submissionsDelete = this.state.submissionsDelete;}
    if (this.isAssignable('validate_submissions')) {output.submissionsValidate = this.state.submissionsValidate;}
    return output;
  }

  submit(evt) {
    evt.preventDefault();

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
              onKeyPress={this.onInputKeyPress}
              errors={this.state.username.length === 0}
            />
          </div>
        }

        <div className='user-permissions-editor__row'>
          {this.isAssignable('view_asset') &&
            <Checkbox
              checked={this.state.formView}
              disabled={this.state.formViewDisabled}
              onChange={this.onCheckboxChange.bind(this, 'formView')}
              label={this.getLabel('view_asset')}
            />
          }

          {this.isAssignable('change_asset') &&
            <Checkbox
              checked={this.state.formEdit}
              disabled={this.state.formEditDisabled}
              onChange={this.onCheckboxChange.bind(this, 'formEdit')}
              label={this.getLabel('change_asset')}
            />
          }

          {this.isAssignable('view_submissions') &&
            <Checkbox
              checked={this.state.submissionsView}
              disabled={this.state.submissionsViewDisabled}
              onChange={this.onCheckboxChange.bind(this, 'submissionsView')}
              label={this.getLabel('view_submissions')}
            />
          }

          {this.isAssignable('partial_submissions') && this.state.submissionsView === true &&
            <div className='user-permissions-editor__sub-row'>
              <Checkbox
                checked={this.state.submissionsViewPartial}
                disabled={this.state.submissionsViewPartialDisabled}
                onChange={this.onCheckboxChange.bind(this, 'submissionsViewPartial')}
                label={this.getLabel('partial_submissions')}
              />

              {this.state.submissionsViewPartial === true &&
                <TextBox
                  placeholder={PARTIAL_PLACEHOLDER}
                  value={this.state.submissionsViewPartialUsers.join(USERNAMES_SEPARATOR)}
                  onChange={this.onSubmissionsViewPartialUsersChange}
                  errors={this.state.submissionsViewPartial && this.state.submissionsViewPartialUsers.length === 0}
                  onKeyPress={this.onInputKeyPress}
                />
              }
            </div>
          }

          {this.isAssignable('add_submissions') &&
            <Checkbox
              checked={this.state.submissionsAdd}
              disabled={this.state.submissionsAddDisabled}
              onChange={this.onCheckboxChange.bind(this, 'submissionsAdd')}
              label={this.getLabel('add_submissions')}
            />
          }

          {this.isAssignable('change_submissions') &&
            <Checkbox
              checked={this.state.submissionsEdit}
              disabled={this.state.submissionsEditDisabled}
              onChange={this.onCheckboxChange.bind(this, 'submissionsEdit')}
              label={this.getLabel('change_submissions')}
            />
          }

          {this.isAssignable('delete_submissions') &&
            <Checkbox
              checked={this.state.submissionsDelete}
              disabled={this.state.submissionsDeleteDisabled}
              onChange={this.onCheckboxChange.bind(this, 'submissionsDelete')}
              label={this.getLabel('delete_submissions')}
            />
          }

          {this.isAssignable('validate_submissions') &&
            <Checkbox
              checked={this.state.submissionsValidate}
              disabled={this.state.submissionsValidateDisabled}
              onChange={this.onCheckboxChange.bind(this, 'submissionsValidate')}
              label={this.getLabel('validate_submissions')}
            />
          }

          {this.isAssignable('manage_asset') &&
            <Checkbox
              checked={this.state.formManage}
              onChange={this.onCheckboxChange.bind(this, 'formManage')}
              label={this.getLabel('manage_asset')}
            />
          }
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
reactMixin(UserAssetPermsEditor.prototype, Reflux.ListenerMixin);

export default UserAssetPermsEditor;
