import {
  applyValidityRules,
  isPartialByUsersValid,
  isPartialByResponsesValid,
  getFormData,
} from './userAssetPermsEditor.utils';
import permConfig from './permConfig';
import {endpoints} from './permParser.mocks';
import constants from 'js/constants';

/**
 * This is `UserAssetPermsEditorState` with all possible properties having falsy
 * values.
 */
const EMPTY_EDITOR_STATE = {
  isSubmitPending: false,
  isEditingUsername: false,
  isCheckingUsername: false,
  username: 'zefir',
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

describe('userAssetPermsEditor utils tests', () => {
  beforeEach(() => {
    // bootstraping
    permConfig.setPermissions(endpoints.permissions.results);
    constants.ROOT_URL = '';
  });

  describe('applyValidityRules', () => {
    it('should check and disable all implied checkboxes', () => {
      // We test here form with a single `formManage` checkbox enabled - it has
      // almost all permissions in the implied list, so a lot of checkboxes need
      // to be checked, and even more need to be disabled. This is a good test
      // to check if most of the cases will work correctly.
      const outcome = applyValidityRules({
        ...EMPTY_EDITOR_STATE,
        formManage: true,
      });
      chai.expect(outcome).to.deep.equal({
        ...EMPTY_EDITOR_STATE,
        formView: true,
        formViewDisabled: true,
        formEdit: true,
        formEditDisabled: true,
        formManage: true,
        formManageDisabled: false,
        submissionsView: true,
        submissionsViewDisabled: true,
        submissionsViewPartialByUsersDisabled: true,
        submissionsViewPartialByResponsesDisabled: true,
        submissionsAdd: true,
        submissionsAddDisabled: true,
        submissionsEdit: true,
        submissionsEditDisabled: true,
        submissionsEditPartialByUsersDisabled: true,
        submissionsEditPartialByResponsesDisabled: true,
        submissionsValidate: true,
        submissionsValidateDisabled: true,
        submissionsValidatePartialByUsersDisabled: true,
        submissionsValidatePartialByResponsesDisabled: true,
        submissionsDelete: true,
        submissionsDeleteDisabled: true,
        submissionsDeletePartialByUsersDisabled: true,
        submissionsDeletePartialByResponsesDisabled: true,
      });
    });

    it('should cleanup partial properties of unchecked checkbox', () => {
      const outcome = applyValidityRules({
        ...EMPTY_EDITOR_STATE,
        submissionsViewPartialByUsers: false,
        submissionsViewPartialByUsersList: ['joe', 'josh'],
        submissionsViewPartialByResponses: false,
        submissionsViewPartialByResponsesQuestion: 'Where_are_you_from',
        submissionsViewPartialByResponsesValue: 'North',
      });

      chai.expect(outcome).to.deep.equal({
        ...EMPTY_EDITOR_STATE,
        submissionsViewPartialByUsers: false,
        submissionsViewPartialByUsersList: [],
        submissionsViewPartialByResponses: false,
        submissionsViewPartialByResponsesQuestion: null,
        submissionsViewPartialByResponsesValue: '',
      });
    });

    it('should disable and uncheck "parent" checkbox if its partial counterpart is checked', () => {
      const outcome = applyValidityRules({
        ...EMPTY_EDITOR_STATE,
        submissionsViewPartialByUsers: true,
        submissionsViewPartialByUsersList: ['joe', 'josh'],
      });

      chai.expect(outcome).to.deep.equal({
        ...EMPTY_EDITOR_STATE,
        formView: true,
        formViewDisabled: true,
        submissionsView: false,
        submissionsViewDisabled: true,
        submissionsViewPartialByUsers: true,
        submissionsViewPartialByUsersList: ['joe', 'josh'],
        submissionsEdit: false,
        submissionsEditDisabled: true,
        submissionsValidate: false,
        submissionsValidateDisabled: true,
        submissionsDelete: false,
        submissionsDeleteDisabled: true,
        formManage: false,
        formManageDisabled: true,
      });
    });
  });

  describe('isPartialByUsersValid', () => {
    it('should be true for all required data filled out', () => {
      const stateObj = {
        ...EMPTY_EDITOR_STATE,
        submissionsEditPartialByUsers: true,
        submissionsEditPartialByUsersList: ['karen'],
      };
      chai
        .expect(
          isPartialByUsersValid('submissionsEditPartialByUsers', stateObj)
        )
        .to.equal(true);
    });

    it('should be false for missing users list and checked checkbox', () => {
      const stateObj = {
        ...EMPTY_EDITOR_STATE,
        submissionsEditPartialByUsers: true,
        submissionsEditPartialByUsersList: [],
      };
      chai
        .expect(
          isPartialByUsersValid('submissionsEditPartialByUsers', stateObj)
        )
        .to.equal(false);
    });
  });

  describe('isPartialByResponsesValid', () => {
    it('should be true for all required data filled out', () => {
      const stateObj = {
        ...EMPTY_EDITOR_STATE,
        submissionsDeletePartialByResponses: true,
        submissionsDeletePartialByResponsesQuestion: 'Where_are_you_from',
        submissionsDeletePartialByResponsesValue: 'North',
      };
      chai
        .expect(
          isPartialByResponsesValid(
            'submissionsDeletePartialByResponses',
            stateObj
          )
        )
        .to.equal(true);
    });

    it('should be false for missing question name', () => {
      const stateObj = {
        ...EMPTY_EDITOR_STATE,
        submissionsDeletePartialByResponses: true,
        submissionsDeletePartialByResponsesQuestion: null,
        submissionsDeletePartialByResponsesValue: 'North',
      };
      chai
        .expect(
          isPartialByResponsesValid(
            'submissionsDeletePartialByResponses',
            stateObj
          )
        )
        .to.equal(false);
    });

    it('should be true for empty value', () => {
      const stateObj = {
        ...EMPTY_EDITOR_STATE,
        submissionsDeletePartialByResponses: true,
        submissionsDeletePartialByResponsesQuestion: 'Where_are_you_from',
        submissionsDeletePartialByResponsesValue: '',
      };
      chai
        .expect(
          isPartialByResponsesValid(
            'submissionsDeletePartialByResponses',
            stateObj
          )
        )
        .to.equal(true);
    });
  });

  describe('getFormData', () => {
    it('should remove unassignable permissions from output', () => {
      const stateObj = {
        ...EMPTY_EDITOR_STATE,
        formEdit: true,
        submissionsAdd: true,
        submissionsView: true,
        submissionsValidate: true,
        submissionsDelete: true,
      };

      const testAssignablePerms = new Map([
        ['/api/v2/permissions/add_submissions/', 'Add submissions'],
        ['/api/v2/permissions/view_submissions/', 'View submissions'],
      ]);

      chai.expect(getFormData(stateObj, testAssignablePerms)).to.deep.equal({
        username: 'zefir',
        submissionsAdd: true,
        submissionsView: true,
      });
    });
  });
});
