import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import Checkbox from 'js/components/checkbox';
import TextBox from 'js/components/textBox';
import {stores} from 'js/stores';
import {actions} from 'js/actions';
import {bem} from 'js/bem';
import {permParser} from './permParser';
import permConfig from './permConfig';
import {
  assign,
  notify,
  buildUserUrl,
} from 'utils';
import {
  ANON_USERNAME,
  KEY_CODES,
  PERMISSIONS_CODENAMES,
} from 'js/constants';
import {
  SUFFIX_USERS,
  SUFFIX_PARTIAL,
  PARTIAL_CHECKBOX_PAIRS,
  PERM_CHECKBOX_NAMES,
} from './permConstants';

const PARTIAL_PLACEHOLDER = t('Enter usernames separated by spaces');
const USERNAMES_SEPARATOR = ',';

// used for validity rules
const CHECKBOX_PERM_PAIRS = new Map([
  [PERM_CHECKBOX_NAMES.formView, PERMISSIONS_CODENAMES.view_asset],
  [PERM_CHECKBOX_NAMES.formEdit, PERMISSIONS_CODENAMES.change_asset],
  [PERM_CHECKBOX_NAMES.submissionsAdd, PERMISSIONS_CODENAMES.add_submissions],
  [PERM_CHECKBOX_NAMES.submissionsAddPartial, PERMISSIONS_CODENAMES.partial_submissions],
  [PERM_CHECKBOX_NAMES.submissionsView, PERMISSIONS_CODENAMES.view_submissions],
  [PERM_CHECKBOX_NAMES.submissionsViewPartial, PERMISSIONS_CODENAMES.partial_submissions],
  [PERM_CHECKBOX_NAMES.submissionsEdit, PERMISSIONS_CODENAMES.change_submissions],
  [PERM_CHECKBOX_NAMES.submissionsEditPartial, PERMISSIONS_CODENAMES.partial_submissions],
  [PERM_CHECKBOX_NAMES.submissionsValidate, PERMISSIONS_CODENAMES.validate_submissions],
  [PERM_CHECKBOX_NAMES.submissionsValidatePartial, PERMISSIONS_CODENAMES.partial_submissions],
  [PERM_CHECKBOX_NAMES.submissionsDelete, PERMISSIONS_CODENAMES.delete_submissions],
]);

const SUFFIX_DISABLED = 'Disabled';

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
      // all other properties are defined by setupStateCheckbox
    };

    this.setupStateCheckbox(PERM_CHECKBOX_NAMES.formView);
    this.setupStateCheckbox(PERM_CHECKBOX_NAMES.formEdit);
    this.setupStateCheckbox(PERM_CHECKBOX_NAMES.submissionsView);
    this.setupStateCheckbox(PERM_CHECKBOX_NAMES.submissionsAdd);
    this.setupStateCheckbox(PERM_CHECKBOX_NAMES.submissionsEdit);
    this.setupStateCheckbox(PERM_CHECKBOX_NAMES.submissionsValidate);
    this.setupStateCheckbox(PERM_CHECKBOX_NAMES.submissionsDelete);

    this.applyPropsData();
  }

  /**
   * DRY function to be used in constructor
   */
  setupStateCheckbox(checkboxName) {
    this.state[checkboxName] = false;
    this.state[checkboxName + SUFFIX_DISABLED] = false;

    // checks whether there is a partial permission checkbox for this checkbox
    if (PARTIAL_CHECKBOX_PAIRS[checkboxName]) {
      this.state[PARTIAL_CHECKBOX_PAIRS[checkboxName]] = false;
      this.state[PARTIAL_CHECKBOX_PAIRS[checkboxName] + SUFFIX_DISABLED] = false;
      this.state[PARTIAL_CHECKBOX_PAIRS[checkboxName] + SUFFIX_USERS] = [];
    }
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
    // enable all checkboxes before applying rules
    CHECKBOX_PERM_PAIRS.forEach((pairPermission, pairCheckbox) => {
      stateObj[pairCheckbox + SUFFIX_DISABLED] = false;
    });
    // apply permissions configuration rules to checkboxes
    CHECKBOX_PERM_PAIRS.forEach((pairPermission, pairCheckbox) => {
      this.applyValidityRulesForCheckbox(pairCheckbox, stateObj);
    });
    // cleanup unchecked partial checkboxes users lists
    CHECKBOX_PERM_PAIRS.forEach((pairPermission, pairCheckbox) => {
      if (
        pairCheckbox.endsWith(SUFFIX_PARTIAL) &&
        stateObj[pairCheckbox] === false
      ) {
        stateObj[pairCheckbox + SUFFIX_USERS] = [];
      }
    });
    return stateObj;
  }

  /**
   * For given checkbox (permission) uses permissions config to fix all implied
   * and contradictory checkboxes (permissions).
   *
   * Modifies passed state object.
   */
  applyValidityRulesForCheckbox(checkboxName, stateObj) {
    // only applies the rules for checked checkboxes
    if (stateObj[checkboxName] === false) {
      return;
    }

    const permissionPair = CHECKBOX_PERM_PAIRS.get(checkboxName);
    const impliedPerms = this.getImpliedPermissions(permissionPair);
    const contradictoryPerms = this.getContradictoryPermissions(permissionPair);

    // all implied will be checked and disabled
    impliedPerms.forEach((permUrl) => {
      const impliedPermDef = permConfig.getPermission(permUrl);
      const impliedCheckboxes = this.getPermissionCheckboxPairs(impliedPermDef.codename);
      impliedCheckboxes.forEach((impliedCheckbox) => {
        stateObj[impliedCheckbox] = true;
        stateObj[impliedCheckbox + SUFFIX_DISABLED] = true;
      });
    });

    // all contradictory will be unchecked and disabled
    contradictoryPerms.forEach((permUrl) => {
      const contradictoryPermDef = permConfig.getPermission(permUrl);
      const contradictoryCheckboxes = this.getPermissionCheckboxPairs(contradictoryPermDef.codename);
      contradictoryCheckboxes.forEach((contradictoryCheckbox) => {
        stateObj[contradictoryCheckbox] = false;
        stateObj[contradictoryCheckbox + SUFFIX_DISABLED] = true;
      });
    });
  }

  /**
   * Single callback for all checkboxes to keep the complex connections logic
   * being up to date regardless which one changed.
   */
  onCheckboxChange(id, isChecked) {
    // apply checked checkbox change to state
    const newState = this.state;
    newState[id] = isChecked;
    this.setState(this.applyValidityRules(newState));
  }

  /**
   * We need it just to update the input,
   * the real work is handled by onUsernameChangeEnd.
   */
  onUsernameChange(username) {
    this.setState({
      username: username,
      isEditingUsername: true,
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

  onInputKeyPress(key, evt) {
    if (key === KEY_CODES.ENTER) {
      evt.currentTarget.blur();
      evt.preventDefault(); // prevent submitting form
    }
  }

  /**
   * Generic function for updating partial users text input
   */
  onPartialUsersChange(prop, users) {
    const newState = this.state;
    newState[prop] = users.split(' ');
    this.setState(newState);
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

  /**
   * Mulitple checkboxes have `partial_submissions`, so this function returns
   * an array of items
   */
  getPermissionCheckboxPairs(permCodename) {
    const found = [];
    CHECKBOX_PERM_PAIRS.forEach((pairPermission, pairCheckbox) => {
      if (pairPermission === permCodename) {
        found.push(pairCheckbox);
      }
    });
    return found;
  }

  getImpliedPermissions(permCodename) {
    const permDef = permConfig.getPermissionByCodename(
      PERMISSIONS_CODENAMES[permCodename]
    );
    if (permDef) {
      return permDef.implied;
    } else {
      return [];
    }
  }

  getContradictoryPermissions(permCodename) {
    const permDef = permConfig.getPermissionByCodename(
      PERMISSIONS_CODENAMES[permCodename]
    );
    if (permDef) {
      return permDef.contradictory;
    } else {
      return [];
    }
  }

  getCheckboxLabel(checkboxName) {
    const permName = CHECKBOX_PERM_PAIRS.get(checkboxName);
    const permDef = permConfig.getPermissionByCodename(permName);
    if (!permDef) {
      return false;
    } else {
      return this.props.assignablePerms.get(permDef.url);
    }
  }

  isAssignable(permCodename) {
    const permDef = permConfig.getPermissionByCodename(
      PERMISSIONS_CODENAMES[permCodename]
    );
    if (!permDef) {
      return false;
    } else {
      return this.props.assignablePerms.has(permDef.url);
    }
  }

  /**
   * Blocks submitting non-ready form.
   */
  isSubmitEnabled() {
    let isAnyCheckboxChecked = false;
    CHECKBOX_PERM_PAIRS.forEach((pairPermission, pairCheckbox) => {
      if (this.state[pairCheckbox] === true) {
        isAnyCheckboxChecked = true;
      }
    });

    return (
      isAnyCheckboxChecked &&
      this.isPartialValid(PERM_CHECKBOX_NAMES.submissionsViewPartial) &&
      this.isPartialValid(PERM_CHECKBOX_NAMES.submissionsAddPartial) &&
      this.isPartialValid(PERM_CHECKBOX_NAMES.submissionsEditPartial) &&
      this.isPartialValid(PERM_CHECKBOX_NAMES.submissionsValidatePartial) &&
      !this.state.isSubmitPending &&
      !this.state.isEditingUsername &&
      this.state.username.length > 0 &&
      this.state.usernamesBeingChecked.size === 0 &&
      // we don't allow manual setting anonymous user permissions through UI
      this.state.username !== ANON_USERNAME
    );
  }

  /**
   * Partial can't be empty if checked
   */
  isPartialValid(partialCheckboxName) {
    return this.state[partialCheckboxName] ? this.state[partialCheckboxName + SUFFIX_USERS].length !== 0 : true;
  }

  /**
   * Returns only the properties for assignable permissions
   *
   * @returns {FormData}
   */
  getFormData() {
    const output = {
      username: this.state.username,
    };

    // TODO use CHECKBOX_PERM_PAIRS on a loop for this
    CHECKBOX_PERM_PAIRS.forEach((permName, checkboxName) => {
      if (this.isAssignable(permName)) {
        output[checkboxName] = this.state[checkboxName];
        if (checkboxName.endsWith(SUFFIX_PARTIAL)) {
          output[checkboxName + SUFFIX_USERS] = this.state[checkboxName + SUFFIX_USERS];
        }
      }
    });

    return output;
  }

  submit(evt) {
    evt.preventDefault();

    if (!this.isSubmitEnabled()) {
      return;
    }

    const formData = this.getFormData();

    // TODO update perm parser

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

  renderCheckbox(checkboxName) {
    return (
      <Checkbox
        checked={this.state[checkboxName]}
        disabled={this.state[checkboxName + SUFFIX_DISABLED]}
        onChange={this.onCheckboxChange.bind(this, checkboxName)}
        label={this.getCheckboxLabel(checkboxName)}
      />
    );
  }

  renderTextbox(checkboxName) {
    return (
      <TextBox
        placeholder={PARTIAL_PLACEHOLDER}
        value={this.state[checkboxName + SUFFIX_USERS].join(USERNAMES_SEPARATOR)}
        onChange={this.onPartialUsersChange.bind(this, checkboxName + SUFFIX_USERS)}
        errors={this.state[checkboxName] && this.state[checkboxName + SUFFIX_USERS].length === 0}
        onKeyPress={this.onInputKeyPress}
      />
    );
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
          {this.isAssignable(PERMISSIONS_CODENAMES.view_asset) &&
            this.renderCheckbox(PERM_CHECKBOX_NAMES.formView)
          }

          {this.isAssignable(PERMISSIONS_CODENAMES.change_asset) &&
            this.renderCheckbox(PERM_CHECKBOX_NAMES.formEdit)
          }

          {this.isAssignable(PERMISSIONS_CODENAMES.view_submissions) &&
            this.renderCheckbox(PERM_CHECKBOX_NAMES.submissionsView)
          }

          {this.isAssignable(PERMISSIONS_CODENAMES.partial_submissions) &&
            <div className='user-permissions-editor__sub-row'>
              {this.renderCheckbox(PERM_CHECKBOX_NAMES.submissionsViewPartial)}

              {this.state.submissionsViewPartial === true &&
                this.renderTextbox(PERM_CHECKBOX_NAMES.submissionsViewPartial)
              }
            </div>
          }

          {this.isAssignable(PERMISSIONS_CODENAMES.add_submissions) &&
            this.renderCheckbox(PERM_CHECKBOX_NAMES.submissionsAdd)
          }

          {this.isAssignable(PERMISSIONS_CODENAMES.partial_submissions) &&
            <div className='user-permissions-editor__sub-row'>
              {this.renderCheckbox(PERM_CHECKBOX_NAMES.submissionsAddPartial)}

              {this.state.submissionsAddPartial === true &&
                this.renderTextbox(PERM_CHECKBOX_NAMES.submissionsAddPartial)
              }
            </div>
          }

          {this.isAssignable(PERMISSIONS_CODENAMES.change_submissions) &&
            this.renderCheckbox(PERM_CHECKBOX_NAMES.submissionsEdit)
          }

          {this.isAssignable(PERMISSIONS_CODENAMES.partial_submissions) &&
            <div className='user-permissions-editor__sub-row'>
              {this.renderCheckbox(PERM_CHECKBOX_NAMES.submissionsEditPartial)}

              {this.state.submissionsEditPartial === true &&
                this.renderTextbox(PERM_CHECKBOX_NAMES.submissionsEditPartial)
              }
            </div>
          }

          {this.isAssignable(PERMISSIONS_CODENAMES.delete_submissions) &&
            this.renderCheckbox(PERM_CHECKBOX_NAMES.submissionsDelete)
          }

          {this.isAssignable(PERMISSIONS_CODENAMES.validate_submissions) &&
            this.renderCheckbox(PERM_CHECKBOX_NAMES.submissionsValidate)
          }

          {this.isAssignable(PERMISSIONS_CODENAMES.partial_submissions) &&
            <div className='user-permissions-editor__sub-row'>
              {this.renderCheckbox(PERM_CHECKBOX_NAMES.submissionsValidatePartial)}

              {this.state.submissionsValidatePartial === true &&
                this.renderTextbox(PERM_CHECKBOX_NAMES.submissionsValidatePartial)
              }
            </div>
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
