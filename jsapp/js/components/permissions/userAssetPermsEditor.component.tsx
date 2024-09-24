import React from 'react';
import clonedeep from 'lodash.clonedeep';
import cx from 'classnames';
import Checkbox from 'js/components/common/checkbox';
import TextBox from 'js/components/common/textBox';
import Button from 'js/components/common/button';
import AriaText from 'js/components/common/ariaText';
import {actions} from 'js/actions';
import bem from 'js/bem';
import {parseFormData, buildFormData} from './permParser';
import {notify} from 'js/utils';
import {buildUserUrl, ANON_USERNAME} from 'js/users/utils';
import {KEY_CODES} from 'js/constants';
import {
  CHECKBOX_DISABLED_SUFFIX,
  CHECKBOX_NAMES,
  CHECKBOX_PERM_PAIRS,
  CHECKBOX_LABELS,
} from './permConstants';
import type {
  CheckboxNameAll,
  CheckboxNamePartialByUsers,
  CheckboxNamePartialByResponses,
  PartialByUsersListName,
  PermissionCodename,
} from './permConstants';
import type {AssignablePermsMap} from './sharingForm.component';
import type {PermissionBase, PermissionResponse} from 'js/dataInterface';
import userExistence from 'js/users/userExistence.store';
import {
  getPartialByUsersListName,
  getPartialByResponsesQuestionName,
  getPartialByResponsesValueName,
} from './utils';
import {getSurveyFlatPaths} from 'js/assetUtils';
import assetStore from 'js/assetStore';
import KoboSelect from 'js/components/common/koboSelect';
import type {KoboSelectOption} from 'js/components/common/koboSelect';
import {
  applyValidityRules,
  isAssignable,
  isPartialByUsersValid,
  isPartialByResponsesValid,
  getFormData,
} from './userAssetPermsEditor.utils';
import styles from './userAssetPermsEditor.module.scss';

const PARTIAL_PLACEHOLDER = t('Enter usernames separated by comma');
const USERNAMES_SEPARATOR = ',';

interface UserAssetPermsEditorProps {
  assetUid: string;
  /** Permissions user username (could be empty for new) */
  username?: string;
  /** list of permissions (could be empty for new) */
  permissions?: PermissionResponse[];
  assignablePerms: AssignablePermsMap;
  /** List of permissions with exclusion of the asset owner permissions */
  nonOwnerPerms: PermissionBase[];
  /** Callback to be run when submit ends (success or failure) */
  onSubmitEnd: (isSuccess: boolean) => void;
}

/** Note that this bares a lot of similarities with `PermsFormData` interface */
export interface UserAssetPermsEditorState {
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
  submissionsViewPartialByUsers: boolean;
  submissionsViewPartialByUsersDisabled: boolean;
  submissionsViewPartialByUsersList: string[];
  submissionsViewPartialByResponses: boolean;
  submissionsViewPartialByResponsesDisabled: boolean;
  submissionsViewPartialByResponsesQuestion: string | null;
  submissionsViewPartialByResponsesValue: string;
  submissionsAdd: boolean;
  submissionsAddDisabled: boolean;
  submissionsEdit: boolean;
  submissionsEditDisabled: boolean;
  submissionsEditPartialByUsers: boolean;
  submissionsEditPartialByUsersDisabled: boolean;
  submissionsEditPartialByUsersList: string[];
  submissionsEditPartialByResponses: boolean;
  submissionsEditPartialByResponsesDisabled: boolean;
  submissionsEditPartialByResponsesQuestion: string | null;
  submissionsEditPartialByResponsesValue: string;
  submissionsValidate: boolean;
  submissionsValidateDisabled: boolean;
  submissionsValidatePartialByUsers: boolean;
  submissionsValidatePartialByUsersDisabled: boolean;
  submissionsValidatePartialByUsersList: string[];
  submissionsValidatePartialByResponses: boolean;
  submissionsValidatePartialByResponsesDisabled: boolean;
  submissionsValidatePartialByResponsesQuestion: string | null;
  submissionsValidatePartialByResponsesValue: string;
  submissionsDelete: boolean;
  submissionsDeleteDisabled: boolean;
  submissionsDeletePartialByUsers: boolean;
  submissionsDeletePartialByUsersDisabled: boolean;
  submissionsDeletePartialByUsersList: string[];
  submissionsDeletePartialByResponses: boolean;
  submissionsDeletePartialByResponsesDisabled: boolean;
  submissionsDeletePartialByResponsesQuestion: string | null;
  submissionsDeletePartialByResponsesValue: string;
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
      submissionsViewPartialByUsers: false,
      submissionsViewPartialByUsersDisabled: false,
      submissionsViewPartialByUsersList: [],
      submissionsViewPartialByResponses: false,
      submissionsViewPartialByResponsesDisabled: false,
      submissionsViewPartialByResponsesQuestion: null,
      submissionsViewPartialByResponsesValue: '',
      submissionsAdd: false,
      submissionsAddDisabled: false,
      submissionsEdit: false,
      submissionsEditDisabled: false,
      submissionsEditPartialByUsers: false,
      submissionsEditPartialByUsersDisabled: false,
      submissionsEditPartialByUsersList: [],
      submissionsEditPartialByResponses: false,
      submissionsEditPartialByResponsesDisabled: false,
      submissionsEditPartialByResponsesQuestion: null,
      submissionsEditPartialByResponsesValue: '',
      submissionsValidate: false,
      submissionsValidateDisabled: false,
      submissionsValidatePartialByUsers: false,
      submissionsValidatePartialByUsersDisabled: false,
      submissionsValidatePartialByUsersList: [],
      submissionsValidatePartialByResponses: false,
      submissionsValidatePartialByResponsesDisabled: false,
      submissionsValidatePartialByResponsesQuestion: null,
      submissionsValidatePartialByResponsesValue: '',
      submissionsDelete: false,
      submissionsDeleteDisabled: false,
      submissionsDeletePartialByUsers: false,
      submissionsDeletePartialByUsersDisabled: false,
      submissionsDeletePartialByUsersList: [],
      submissionsDeletePartialByResponses: false,
      submissionsDeletePartialByResponsesDisabled: false,
      submissionsDeletePartialByResponsesQuestion: null,
      submissionsDeletePartialByResponsesValue: '',
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

  private unlisteners: Function[] = [];

  /**
   * Fills up form with provided user name and permissions (if applicable)
   */
  applyPropsData() {
    // Build form data from given existing permissions (e.g. when this component
    // is being used to edit existing permissions)
    const formData = buildFormData(
      this.props.permissions || [],
      this.props.username
    );

    // Merge built form data with existing state (with defaults) and then apply
    // validity rules (handles disabling and checking/unchecking properties
    // based on implied/contradictory rules from `permConfig`).
    this.state = applyValidityRules(Object.assign(this.state, formData));
  }

  componentDidMount() {
    this.unlisteners.push(
      actions.permissions.bulkSetAssetPermissions.completed.listen(
        this.onBulkSetAssetPermissionCompleted.bind(this)
      ),
      actions.permissions.bulkSetAssetPermissions.failed.listen(
        this.onBulkSetAssetPermissionFailed.bind(this)
      )
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb();
    });
  }

  onBulkSetAssetPermissionCompleted() {
    this.setState({isSubmitPending: false}, () => {
      this.notifyParentAboutSubmitEnd(true);
    });
  }

  onBulkSetAssetPermissionFailed() {
    this.setState({isSubmitPending: false}, () => {
      this.notifyParentAboutSubmitEnd(false);
    });
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
   * Single callback for all checkboxes to keep the complex connections logic
   * being up to date regardless which one changed.
   */
  onCheckboxChange(checkboxName: CheckboxNameAll, isChecked: boolean) {
    let output = clonedeep(this.state);
    output = Object.assign(output, {[checkboxName]: isChecked});
    this.setState(applyValidityRules(output));
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

  /**
   * A generic callback for text inputs that blur out of the element when ENTER
   * key is pressed - ensuring that the form is not submitted.
   */
  onInputKeyPress(key: string, evt: React.KeyboardEvent<HTMLInputElement>) {
    if (key === String(KEY_CODES.ENTER)) {
      evt.currentTarget.blur();
      evt.preventDefault(); // prevent submitting form
    }
  }

  /**
   * Generic function for updating partial users text input
   */
  onPartialUsersChange(prop: PartialByUsersListName, users: string) {
    let output = clonedeep(this.state);
    output = Object.assign(output, {
      [prop]: users.split(USERNAMES_SEPARATOR).map((user) => user.trim()),
    });
    this.setState(output);
  }

  // We make a proxy here to avoid passing `assignablePerms` props each time
  isAssignable(permCodename: PermissionCodename) {
    return isAssignable(permCodename, this.props.assignablePerms);
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
      isPartialByUsersValid('submissionsViewPartialByUsers', this.state) &&
      isPartialByUsersValid('submissionsEditPartialByUsers', this.state) &&
      isPartialByUsersValid('submissionsDeletePartialByUsers', this.state) &&
      isPartialByUsersValid('submissionsValidatePartialByUsers', this.state) &&
      isPartialByResponsesValid(
        'submissionsViewPartialByResponses',
        this.state
      ) &&
      isPartialByResponsesValid(
        'submissionsEditPartialByResponses',
        this.state
      ) &&
      isPartialByResponsesValid(
        'submissionsDeletePartialByResponses',
        this.state
      ) &&
      isPartialByResponsesValid(
        'submissionsValidatePartialByResponses',
        this.state
      ) &&
      !this.state.isSubmitPending &&
      !this.state.isEditingUsername &&
      !this.state.isCheckingUsername &&
      this.state.username.length > 0 &&
      // we don't allow manual setting anonymous user permissions through UI
      this.state.username !== ANON_USERNAME
    );
  }

  onSubmit(evt: React.FormEvent<HTMLFormElement>) {
    evt.preventDefault();

    if (!this.isSubmitEnabled()) {
      return;
    }

    const formData = getFormData(this.state, this.props.assignablePerms);

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
      CHECKBOX_DISABLED_SUFFIX) as keyof UserAssetPermsEditorState;
    const isDisabled = Boolean(this.state[disabledPropName]);
    return (
      <Checkbox
        checked={this.state[checkboxName]}
        disabled={isDisabled}
        onChange={this.onCheckboxChange.bind(this, checkboxName)}
        label={CHECKBOX_LABELS[checkboxName]}
      />
    );
  }

  /**
   * Displays UI for enabling and typing in a list of users for given partial
   * permissions checkbox. It uses a separator to turn the array into string and
   * vice versa.
   */
  renderPartialByUsersRow(checkboxName: CheckboxNamePartialByUsers) {
    if (this.isAssignable(CHECKBOX_PERM_PAIRS[checkboxName])) {
      const listName = getPartialByUsersListName(checkboxName);
      return (
        <div className={styles.subRow}>
          {this.renderCheckbox(checkboxName)}

          {this.state[checkboxName] === true && (
            <TextBox
              size='m'
              placeholder={PARTIAL_PLACEHOLDER}
              value={this.state[listName].join(USERNAMES_SEPARATOR)}
              onChange={this.onPartialUsersChange.bind(this, listName)}
              errors={
                this.state[checkboxName] && this.state[listName].length === 0
              }
              onKeyPress={this.onInputKeyPress.bind(this)}
            />
          )}
        </div>
      );
    } else {
      return null;
    }
  }

  getQuestionNameSelectOptions(): KoboSelectOption[] {
    const output: KoboSelectOption[] = [];
    const foundAsset = assetStore.getAsset(this.props.assetUid);
    if (foundAsset?.content?.survey) {
      const flatPaths = getSurveyFlatPaths(
        foundAsset.content?.survey,
        false,
        true
      );
      for (const [, path] of Object.entries(flatPaths)) {
        output.push({
          value: path,
          label: path,
        });
      }
    }
    return output;
  }

  /**
   * Displays a checkbox for enabling partial "by responses" permission editor
   * that includes a question (name) selector and a text input for typing
   * the value to filter by.
   */
  renderPartialByResponsesRow(checkboxName: CheckboxNamePartialByResponses) {
    if (this.isAssignable(CHECKBOX_PERM_PAIRS[checkboxName])) {
      const questionProp = getPartialByResponsesQuestionName(checkboxName);
      const valueProp = getPartialByResponsesValueName(checkboxName);

      return (
        <div className={styles.subRow}>
          {this.renderCheckbox(checkboxName)}

          {this.state[checkboxName] === true && (
            <div className={styles.byResponsesInputs}>
              <span className={styles.questionSelectWrapper}>
                <KoboSelect
                  name={checkboxName}
                  type='outline'
                  size='m'
                  isClearable
                  options={this.getQuestionNameSelectOptions()}
                  selectedOption={this.state[questionProp]}
                  onChange={(newSelectedOption: string | null) => {
                    // Update state object in non mutable way
                    let output = clonedeep(this.state);
                    output = Object.assign(output, {
                      [questionProp]: newSelectedOption,
                    });
                    this.setState(output);
                  }}
                />
              </span>

              {/* We display an equals character between elements here :) */}
              <AriaText
                uiText='='
                screenReaderText={t('equals')}
              />

              <span className={styles.valueInputWrapper}>
                <TextBox
                  value={this.state[valueProp]}
                  size='m'
                  onChange={(newVal: string) => {
                    // Update state object in non mutable way
                    let output = clonedeep(this.state);
                    output = Object.assign(output, {
                      [valueProp]: newVal,
                    });
                    this.setState(output);
                  }}
                />
              </span>

              <Button
                type='text'
                size='m'
                label={t('Reset changes')}
                onClick={() => {
                  // Update state object in non mutable way
                  let output = clonedeep(this.state);
                  output = Object.assign(output, {
                    [questionProp]: null,
                    [valueProp]: '',
                  });
                  this.setState(output);
                }}
              />
            </div>
          )}
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
          <div className={cx([styles.row, styles.rowUsername])}>
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

        <div className={styles.row}>
          {this.isAssignable('view_asset') && this.renderCheckbox('formView')}

          {this.isAssignable('change_asset') && this.renderCheckbox('formEdit')}

          {this.isAssignable('view_submissions') &&
            this.renderCheckbox('submissionsView')}
          {this.renderPartialByUsersRow('submissionsViewPartialByUsers')}
          {this.renderPartialByResponsesRow(
            'submissionsViewPartialByResponses'
          )}

          {this.isAssignable('add_submissions') &&
            this.renderCheckbox('submissionsAdd')}

          {this.isAssignable('change_submissions') &&
            this.renderCheckbox('submissionsEdit')}
          {this.renderPartialByUsersRow('submissionsEditPartialByUsers')}
          {this.renderPartialByResponsesRow(
            'submissionsEditPartialByResponses'
          )}

          {this.isAssignable('validate_submissions') &&
            this.renderCheckbox('submissionsValidate')}
          {this.renderPartialByUsersRow('submissionsValidatePartialByUsers')}
          {this.renderPartialByResponsesRow(
            'submissionsValidatePartialByResponses'
          )}

          {this.isAssignable('delete_submissions') &&
            this.renderCheckbox('submissionsDelete')}
          {this.renderPartialByUsersRow('submissionsDeletePartialByUsers')}
          {this.renderPartialByResponsesRow(
            'submissionsDeletePartialByResponses'
          )}

          {this.isAssignable('manage_asset') &&
            this.renderCheckbox('formManage')}
        </div>

        <div className={styles.row}>
          <Button
            type='primary'
            size='l'
            onClick={this.onSubmit.bind(this)}
            label={isNew ? t('Grant permissions') : t('Update permissions')}
            isDisabled={!this.isSubmitEnabled()}
            isPending={this.state.isSubmitPending}
            isSubmit
          />
        </div>
      </bem.FormModal__form>
    );
  }
}
