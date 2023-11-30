import React from 'react';
import clonedeep from 'lodash.clonedeep';
import Checkbox from 'js/components/common/checkbox';
import TextBox from 'js/components/common/textBox';
import Button from 'js/components/common/button';
import sessionStore from 'js/stores/session';
import {actions} from 'js/actions';
import bem from 'js/bem';
import {parseFormData, buildFormData} from './permParser';
import type {UserPerm, PermsFormData} from './permParser';
import permConfig from './permConfig';
import {notify} from 'js/utils';
import {buildUserUrl, ANON_USERNAME} from 'js/users/utils';
import {KEY_CODES} from 'js/constants';
import {
  PARTIAL_PERM_PAIRS,
  CHECKBOX_NAMES,
  CHECKBOX_PERM_PAIRS,
  PARTIAL_IMPLIED_CHECKBOX_PAIRS,
} from './permConstants';
import type {
  CheckboxNameAll,
  CheckboxNamePartial,
  CheckboxNameListPartial,
  PermissionCodename,
} from './permConstants';
import type {AssignablePermsMap} from './sharingForm.component';
import type {
  PermissionBase,
  AssignablePermissionPartialLabel,
} from 'js/dataInterface';
import userExistence from 'js/users/userExistence.store';
import {getPartialCheckboxListName} from './utils';

const PARTIAL_PLACEHOLDER = t('Enter usernames separated by comma');
const USERNAMES_SEPARATOR = ',';

const SUFFIX_DISABLED = 'Disabled';

interface UserAssetPermsEditorProps {
  assetUid: string;
  /** Permissions user username (could be empty for new) */
  username?: string;
  /** list of permissions (could be empty for new) */
  permissions?: UserPerm[];
  assignablePerms: AssignablePermsMap;
  /** List of permissions with exclusion of the asset owner permissions */
  nonOwnerPerms: PermissionBase[];
  /** Callback to be run when submit ends (success or failure) */
  onSubmitEnd: (isSuccess: boolean) => void;
}

interface UserAssetPermsEditorState {
  isSubmitPending: boolean;
  // We need both `isEditingUsername` and `isCheckingUsername` to block sending
  // permissions to Back end, when we're not sure if user exists.
  isEditingUsername: boolean;
  isCheckingUsername: boolean;
  // Properties for configuring the permission in the form:
  username: string;
  formView: boolean;
  formViewDisabled: boolean;
  formEdit: boolean;
  formEditDisabled: boolean;
  formManage: boolean;
  formManageDisabled: boolean;
  submissionsView: boolean;
  submissionsViewDisabled: boolean;
  submissionsViewPartial: boolean;
  submissionsViewPartialUsers: string[];
  submissionsAdd: boolean;
  submissionsAddDisabled: boolean;
  submissionsEdit: boolean;
  submissionsEditDisabled: boolean;
  submissionsEditPartial: boolean;
  submissionsEditPartialUsers: string[];
  submissionsValidate: boolean;
  submissionsValidateDisabled: boolean;
  submissionsValidatePartial: boolean;
  submissionsValidatePartialUsers: string[];
  submissionsDelete: boolean;
  submissionsDeleteDisabled: boolean;
  submissionsDeletePartial: boolean;
  submissionsDeletePartialUsers: string[];
}

/**
 * Form for adding new or changing existing permissions for surveys.
 */
export default class UserAssetPermsEditor extends React.Component<
  UserAssetPermsEditorProps,
  UserAssetPermsEditorState
> {
  constructor(props: UserAssetPermsEditorProps) {
    super(props);

    this.state = {
      // inner workings
      isSubmitPending: false,
      isEditingUsername: false,
      isCheckingUsername: false,
      // form user inputs
      username: '',
      formView: false,
      formViewDisabled: false,
      formEdit: false,
      formEditDisabled: false,
      formManage: false,
      formManageDisabled: false,
      submissionsView: false,
      submissionsViewDisabled: false,
      submissionsViewPartial: false,
      submissionsViewPartialUsers: [],
      submissionsAdd: false,
      submissionsAddDisabled: false,
      submissionsEdit: false,
      submissionsEditDisabled: false,
      submissionsEditPartial: false,
      submissionsEditPartialUsers: [],
      submissionsValidate: false,
      submissionsValidateDisabled: false,
      submissionsValidatePartial: false,
      submissionsValidatePartialUsers: [],
      submissionsDelete: false,
      submissionsDeleteDisabled: false,
      submissionsDeletePartial: false,
      submissionsDeletePartialUsers: [],
    };

    this.applyPropsData();
  }

  /**
   * A cached list of checked usernames; saves us some backend calls. It will
   * be wiped as soon as the editor is closed, so it's a minor improvement.
   *
   * TODO: think about a better caching mechanism, probably added inside
   * the `userExistence` store.
   */
  checkedUsernames: Map<string, boolean> = new Map();

  /**
   * Fills up form with provided user name and permissions (if applicable)
   */
  applyPropsData() {
    const formData = buildFormData(
      this.props.permissions || [],
      this.props.username
    );
    this.state = this.applyValidityRules(Object.assign(this.state, formData));

    this.state = this.applySubmissionsAddRules(this.state);
  }

  componentDidMount() {
    actions.permissions.bulkSetAssetPermissions.completed.listen(
      this.onBulkSetAssetPermissionCompleted.bind(this)
    );
    actions.permissions.bulkSetAssetPermissions.failed.listen(
      this.onBulkSetAssetPermissionFailed.bind(this)
    );
  }

  onBulkSetAssetPermissionCompleted() {
    this.setState({isSubmitPending: false});
    this.notifyParentAboutSubmitEnd(true);
  }

  onBulkSetAssetPermissionFailed() {
    this.setState({isSubmitPending: false});
    this.notifyParentAboutSubmitEnd(false);
  }

  notifyParentAboutSubmitEnd(isSuccess: boolean) {
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
   * Returns updated state object
   */
  applyValidityRules(stateObj: UserAssetPermsEditorState) {
    // Step 1: Avoid mutation
    let output = clonedeep(stateObj);

    // Step 2: Enable all checkboxes (make them not disabled) before applying
    // the rules
    for (const [, checkboxName] of Object.entries(CHECKBOX_NAMES)) {
      output = Object.assign(output, {[checkboxName + SUFFIX_DISABLED]: false});
    }

    // Step 3: Lock submission add
    output = this.applySubmissionsAddRules(output);

    // Step 4: Apply permissions configuration rules to checkboxes
    for (const [, checkboxName] of Object.entries(CHECKBOX_NAMES)) {
      output = this.applyValidityRulesForCheckbox(checkboxName, output);
    }

    // Step 5: For each unchecked partial checkbox, clean up the list of users
    for (const [, checkboxName] of Object.entries(CHECKBOX_NAMES)) {
      if (
        checkboxName in PARTIAL_PERM_PAIRS &&
        output[checkboxName] === false
      ) {
        // We cast it here, because it is definitely a partial checkbox
        const listName = getPartialCheckboxListName(
          checkboxName as CheckboxNamePartial
        );
        output = Object.assign(output, {[listName]: []});
      }
    }

    return output;
  }

  /**
   * For users with disabled `auth_required` we need to force check
   * "add submissions" and don't allow unchecking it.
   *
   * Returns updated state object
   */
  applySubmissionsAddRules(stateObj: UserAssetPermsEditorState) {
    let output = clonedeep(stateObj);

    if (
      this.isAssignable('add_submissions') &&
      'extra_details' in sessionStore.currentAccount &&
      sessionStore.currentAccount.extra_details?.require_auth !== true
    ) {
      output = Object.assign(output, {
        [CHECKBOX_NAMES.submissionsAdd]: true,
        [CHECKBOX_NAMES.submissionsAdd + SUFFIX_DISABLED]: true,
      });
      output = this.applyValidityRulesForCheckbox(
        CHECKBOX_NAMES.submissionsAdd,
        output
      );
    }

    return output;
  }

  /**
   * For given checkbox (permission) uses permissions config to fix all implied
   * and contradictory checkboxes (permissions).
   *
   * Returns updated state object
   */
  applyValidityRulesForCheckbox(
    checkboxName: CheckboxNameAll,
    stateObj: UserAssetPermsEditorState
  ) {
    let output = clonedeep(stateObj);

    // Step 1: Only apply the rules for checked checkboxes
    if (output[checkboxName] === false) {
      return output;
    }

    // Step 2: Get implied and contradictory perms from definition
    const permDef = permConfig.getPermissionByCodename(
      CHECKBOX_PERM_PAIRS[checkboxName]
    );
    const impliedPerms = permDef?.implied || [];
    const contradictoryPerms = permDef?.contradictory || [];

    // Step 3: All implied will be checked and disabled
    impliedPerms.forEach((permUrl) => {
      const impliedPermDef = permConfig.getPermission(permUrl);
      if (!impliedPermDef) {
        return;
      }

      let impliedCheckboxes = this.getPermissionCheckboxPairs(
        impliedPermDef.codename
      );
      if (checkboxName in PARTIAL_IMPLIED_CHECKBOX_PAIRS) {
        impliedCheckboxes = impliedCheckboxes.concat(
          PARTIAL_IMPLIED_CHECKBOX_PAIRS[checkboxName]
        );
      }

      impliedCheckboxes.forEach((impliedCheckbox) => {
        output = Object.assign(output, {
          [impliedCheckbox]: true,
          [impliedCheckbox + SUFFIX_DISABLED]: true,
        });
      });
    });

    // Step 4: All contradictory will be unchecked and disabled
    contradictoryPerms.forEach((permUrl) => {
      const contradictoryPermDef = permConfig.getPermission(permUrl);
      if (!contradictoryPermDef) {
        return;
      }

      const contradictoryCheckboxes = this.getPermissionCheckboxPairs(
        contradictoryPermDef.codename
      );
      contradictoryCheckboxes.forEach((contradictoryCheckbox) => {
        output = Object.assign(output, {
          [contradictoryCheckbox]: false,
          [contradictoryCheckbox + SUFFIX_DISABLED]: true,
        });
      });
    });

    return output;
  }

  /**
   * Single callback for all checkboxes to keep the complex connections logic
   * being up to date regardless which one changed.
   */
  onCheckboxChange(checkboxName: CheckboxNameAll, isChecked: boolean) {
    let output = clonedeep(this.state);
    output = Object.assign(output, {[checkboxName]: isChecked});
    this.setState(this.applyValidityRules(output));
  }

  /**
   * We need it just to update the input,
   * the real work is handled by onUsernameChangeEnd.
   */
  onUsernameChange(username: string) {
    this.setState({
      username: username,
      isEditingUsername: true,
    });
  }

  /**
   * Checks if username exist on the Back end, and clears input if doesn't.
   */
  async onUsernameChangeEnd() {
    this.setState({isEditingUsername: false});

    const usernameToCheck = this.state.username;

    // We don't check empty string.
    if (usernameToCheck === '') {
      return;
    }

    // If we have previously checked, and user does exist, we do nothing :).
    if (
      this.checkedUsernames.has(usernameToCheck) &&
      this.checkedUsernames.get(usernameToCheck) === true
    ) {
      return;
    }

    // If we have previously checked, and user doesn't exist, we notify and
    // clear input
    if (
      this.checkedUsernames.has(usernameToCheck) &&
      this.checkedUsernames.get(usernameToCheck) === false
    ) {
      this.notifyUnknownUser(usernameToCheck);
      this.setState({username: ''});
    }

    // If we didn't check for user, we do it here (and cache result).
    this.setState({isCheckingUsername: true});
    const checkResult = await userExistence.checkUsername(usernameToCheck);
    this.checkedUsernames.set(usernameToCheck, checkResult);
    if (checkResult === false) {
      // Notify about unknown user - but only if there is internet connection,
      // so that we don't display a scary "User not found" notification
      // untruthfuly.
      if (navigator.onLine) {
        this.notifyUnknownUser(usernameToCheck);
      }
      this.setState({username: ''});
    }

    this.setState({isCheckingUsername: false});
  }

  notifyUnknownUser(username: string) {
    notify(`${t('User not found:')} ${username}`, 'warning');
  }

  onInputKeyPress(key: string, evt: React.KeyboardEvent<HTMLInputElement>) {
    if (key === String(KEY_CODES.ENTER)) {
      evt.currentTarget.blur();
      evt.preventDefault(); // prevent submitting form
    }
  }

  /**
   * Generic function for updating partial users text input
   */
  onPartialUsersChange(prop: CheckboxNameListPartial, users: string) {
    let output = clonedeep(this.state);
    output = Object.assign(output, {
      [prop]: users.split(USERNAMES_SEPARATOR).map((user) => user.trim()),
    });
    this.setState(output);
  }

  /**
   * Multiple checkboxes have `partial_submissions`, so this function returns
   * an array of items
   */
  getPermissionCheckboxPairs(permCodename: PermissionCodename) {
    const found: CheckboxNameAll[] = [];

    for (const [checkboxName, checkboxPermPair] of Object.entries(
      CHECKBOX_PERM_PAIRS
    )) {
      if (checkboxPermPair === permCodename) {
        found.push(checkboxName as CheckboxNameAll);
      }
    }

    return found;
  }

  getCheckboxLabel(checkboxName: CheckboxNameAll) {
    // We need both of these pieces of data, and most probably both of them
    // should be available. But because of types we need to be extra safe. If
    // anything goes awry, we will return checkbox name as fallback.
    const permDef = permConfig.getPermissionByCodename(
      CHECKBOX_PERM_PAIRS[checkboxName]
    );
    if (!permDef) {
      return checkboxName;
    }
    const assignablePerm = this.props.assignablePerms.get(permDef.url);
    if (!assignablePerm) {
      return checkboxName;
    }

    // For partial permission we need to dig deeper
    if (checkboxName in PARTIAL_PERM_PAIRS) {
      // We need to get regular (non partial) permission name that matches
      // the partial permission. This is because each partial permissions is
      // being stored as `partial_submissions` first, and the actual respective
      // submission second.
      const permName = PARTIAL_PERM_PAIRS[checkboxName as CheckboxNamePartial];
      if (typeof assignablePerm !== 'string' && permName in assignablePerm) {
        return (
          assignablePerm[permName as keyof AssignablePermissionPartialLabel] ||
          checkboxName
        );
      }
      return checkboxName;
    } else {
      // We cast it as string, because it is definitely not partial checkbox
      return assignablePerm as string;
    }
  }

  isAssignable(permCodename: PermissionCodename) {
    const permDef = permConfig.getPermissionByCodename(permCodename);
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
    for (const [, checkboxName] of Object.entries(CHECKBOX_NAMES)) {
      if (this.state[checkboxName] === true) {
        isAnyCheckboxChecked = true;
      }
    }

    return (
      isAnyCheckboxChecked &&
      this.isPartialValid('submissionsViewPartial') &&
      this.isPartialValid('submissionsEditPartial') &&
      this.isPartialValid('submissionsDeletePartial') &&
      this.isPartialValid('submissionsValidatePartial') &&
      !this.state.isSubmitPending &&
      !this.state.isEditingUsername &&
      !this.state.isCheckingUsername &&
      this.state.username.length > 0 &&
      // we don't allow manual setting anonymous user permissions through UI
      this.state.username !== ANON_USERNAME
    );
  }

  /**
   * Partial can't be empty if checked
   */
  isPartialValid(partialCheckboxName: CheckboxNamePartial) {
    // If partial checkbox is checked, we require the users list to not be empty
    if (this.state[partialCheckboxName] === true) {
      return (
        this.state[getPartialCheckboxListName(partialCheckboxName)].length !== 0
      );
    }
    return true;
  }

  /**
   * Returns only the properties for assignable permissions
   */
  getFormData() {
    const output: PermsFormData = {
      username: this.state.username,
    };

    for (const [, checkboxName] of Object.entries(CHECKBOX_NAMES)) {
      if (this.isAssignable(CHECKBOX_PERM_PAIRS[checkboxName])) {
        output[checkboxName] = this.state[checkboxName];
        if (checkboxName in PARTIAL_PERM_PAIRS) {
          // We cast it here, because it is definitely a partial checkbox
          const listName = getPartialCheckboxListName(
            checkboxName as CheckboxNamePartial
          );
          output[listName] = this.state[listName];
        }
      }
    }

    return output;
  }

  onSubmit(evt: React.FormEvent<HTMLFormElement>) {
    evt.preventDefault();

    if (!this.isSubmitEnabled()) {
      return;
    }

    const formData = this.getFormData();

    const parsedPerms = parseFormData(formData);

    if (parsedPerms.length > 0) {
      // bulk endpoint needs all other users permissions to be passed
      const otherUserPerms = this.props.nonOwnerPerms.filter(
        (perm) => perm.user !== buildUserUrl(formData.username)
      );
      this.setState({isSubmitPending: true});
      actions.permissions.bulkSetAssetPermissions(
        this.props.assetUid,
        otherUserPerms.concat(parsedPerms)
      );
    } else {
      // if nothing changes but user submits, just notify parent we're good
      this.notifyParentAboutSubmitEnd(true);
    }

    return false;
  }

  /**
   * Displays UI for endabling/disabling given regular or partial permission
   */
  renderCheckbox(checkboxName: CheckboxNameAll) {
    // We need to trick TypeScript here, because we don't want to refactor too
    // much code to make it perfect
    const disabledPropName = (checkboxName +
      SUFFIX_DISABLED) as keyof UserAssetPermsEditorState;
    const isDisabled = Boolean(this.state[disabledPropName]);
    return (
      <Checkbox
        checked={this.state[checkboxName]}
        disabled={isDisabled}
        onChange={this.onCheckboxChange.bind(this, checkboxName)}
        label={this.getCheckboxLabel(checkboxName)}
      />
    );
  }

  /**
   * Displays UI for typing in a list of users for given partial permissions
   * checkbox. It uses a separator to turn the array into string and vice versa.
   */
  renderUsersTextbox(checkboxName: CheckboxNamePartial) {
    const listName = getPartialCheckboxListName(checkboxName);
    return (
      <TextBox
        size='m'
        placeholder={PARTIAL_PLACEHOLDER}
        value={this.state[listName].join(USERNAMES_SEPARATOR)}
        onChange={this.onPartialUsersChange.bind(this, listName)}
        errors={this.state[checkboxName] && this.state[listName].length === 0}
        onKeyPress={this.onInputKeyPress.bind(this)}
      />
    );
  }

  renderPartialRow(checkboxName: CheckboxNamePartial) {
    if (this.isAssignable(CHECKBOX_PERM_PAIRS[checkboxName])) {
      return (
        <div className='user-permissions-editor__sub-row'>
          {this.renderCheckbox(checkboxName)}

          {this.state[checkboxName] === true &&
            this.renderUsersTextbox(checkboxName)}
        </div>
      );
    } else {
      return null;
    }
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
        onSubmit={this.onSubmit.bind(this)}
      >
        {isNew && (
          // don't display username editor when editing existing user
          <div className='user-permissions-editor__row user-permissions-editor__row--username'>
            <TextBox
              size='m'
              placeholder={t('username')}
              value={this.state.username}
              onChange={this.onUsernameChange.bind(this)}
              onBlur={this.onUsernameChangeEnd.bind(this)}
              onKeyPress={this.onInputKeyPress.bind(this)}
              errors={this.state.username.length === 0}
            />
          </div>
        )}

        <div className='user-permissions-editor__row'>
          {this.isAssignable('view_asset') && this.renderCheckbox('formView')}

          {this.isAssignable('change_asset') && this.renderCheckbox('formEdit')}

          {this.isAssignable('view_submissions') &&
            this.renderCheckbox('submissionsView')}
          {this.renderPartialRow('submissionsViewPartial')}

          {this.isAssignable('add_submissions') &&
            this.renderCheckbox('submissionsAdd')}

          {this.isAssignable('change_submissions') &&
            this.renderCheckbox('submissionsEdit')}
          {this.renderPartialRow('submissionsEditPartial')}

          {this.isAssignable('validate_submissions') &&
            this.renderCheckbox('submissionsValidate')}
          {this.renderPartialRow('submissionsValidatePartial')}

          {this.isAssignable('delete_submissions') &&
            this.renderCheckbox('submissionsDelete')}
          {this.renderPartialRow('submissionsDeletePartial')}

          {this.isAssignable('manage_asset') &&
            this.renderCheckbox('formManage')}
        </div>

        <div className='user-permissions-editor__row'>
          <Button
            color='blue'
            type='full'
            size='l'
            onClick={this.onSubmit.bind(this)}
            label={isNew ? t('Grant permissions') : t('Update permissions')}
            isDisabled={!this.isSubmitEnabled()}
            isSubmit
          />
        </div>
      </bem.FormModal__form>
    );
  }
}
