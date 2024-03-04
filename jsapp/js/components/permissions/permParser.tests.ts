import {
  parseFormData,
  buildFormData,
  parseBackendData,
  removeImpliedPerms,
  parseUserWithPermsList,
  sortParseBackendOutput,
} from './permParser';
import permConfig from './permConfig';
import {endpoints} from './permParser.mocks';
import constants from 'js/constants';
import {ANON_USERNAME} from 'js/users/utils';

describe('permParser', () => {
  beforeEach(() => {
    // bootstraping
    permConfig.setPermissions(endpoints.permissions.results);
    constants.ROOT_URL = '';
  });

  describe('parseBackendData', () => {
    it('should hide anonymous user permissions from output by default', () => {
      // in original data there are total 7 permissions (6 of asset owner and
      // one of anonymous user)
      chai.expect(endpoints.assetWithAnonymousUser.results.length).to.equal(7);
      const parsed = parseBackendData(
        endpoints.assetWithAnonymousUser.results,
        endpoints.assetWithAnonymousUser.results[0].user
      );
      // parsed data should only contain data of owner
      chai.expect(parsed.length).to.equal(1);
      chai.expect(parsed[0].user.name).to.equal('kobo');
    });

    it('should show anonymous user permissions from output when ordered to', () => {
      // in original data there are total 7 permissions (6 of asset owner and
      // one of anonymous user)
      chai.expect(endpoints.assetWithAnonymousUser.results.length).to.equal(7);
      const parsed = parseBackendData(
        endpoints.assetWithAnonymousUser.results,
        endpoints.assetWithAnonymousUser.results[0].user,
        true
      );
      // parsed data should contain data of owner and anonymous user
      chai.expect(parsed.length).to.equal(2);
      chai.expect(parsed[0].user.name).to.equal('kobo');
      chai.expect(parsed[1].user.name).to.equal(ANON_USERNAME);
    });

    it('should group permissions by users properly', () => {
      // in original data there are total 9 permissions (6 of asset owner,
      // 2 of one user and 1 of another)
      chai.expect(endpoints.assetWithMultipleUsers.results.length).to.equal(10);
      const parsed = parseBackendData(
        endpoints.assetWithMultipleUsers.results,
        endpoints.assetWithMultipleUsers.results[0].user
      );

      // parsed data should contain data of 3 users
      chai.expect(parsed.length).to.equal(3);
      chai.expect(parsed[0].user.name).to.equal('kobo');
      chai.expect(parsed[0].permissions.length).to.equal(7);
      chai.expect(parsed[1].user.name).to.equal('john');
      chai.expect(parsed[1].permissions.length).to.equal(2);
      chai.expect(parsed[2].user.name).to.equal('olivier');
      chai.expect(parsed[2].permissions.length).to.equal(1);
    });
  });

  describe('removeImpliedPerms', () => {
    it('should remove implied non-partial permissions', () => {
      const cleanedUpOutput = removeImpliedPerms([
        // Delete submissions is the one that gives/implies `view_submissions`
        // and `view_asset`
        {
          user: '/api/v2/users/joe/',
          permission: '/api/v2/permissions/delete_submissions/',
        },
        {
          user: '/api/v2/users/joe/',
          permission: '/api/v2/permissions/view_submissions/',
        },
        {
          user: '/api/v2/users/joe/',
          permission: '/api/v2/permissions/view_asset/',
        },
      ]);

      chai.expect(cleanedUpOutput).to.deep.equal([
        {
          user: '/api/v2/users/joe/',
          permission: '/api/v2/permissions/delete_submissions/',
        },
      ]);
    });

    it('should remove implied partial permissions', () => {
      const cleanedUpOutput = removeImpliedPerms([
        {
          user: '/api/v2/users/gwyneth/',
          permission: '/api/v2/permissions/partial_submissions/',
          partial_permissions: [
            {
              url: '/api/v2/permissions/add_submissions/',
              filters: [
                {
                  Where_is_it: 'North',
                  _submitted_by: 'georgia',
                },
              ],
            },
            {
              url: '/api/v2/permissions/view_submissions/',
              filters: [
                {
                  Where_is_it: 'South',
                  _submitted_by: {
                    $in: ['josh', 'bob'],
                  },
                },
                {
                  Where_is_it: 'North',
                  _submitted_by: 'georgia',
                },
              ],
            },
            {
              url: '/api/v2/permissions/change_submissions/',
              filters: [
                {
                  Where_is_it: 'North',
                  _submitted_by: 'georgia',
                },
              ],
            },
          ],
        },
      ]);

      chai.expect(cleanedUpOutput).to.deep.equal([
        {
          user: '/api/v2/users/gwyneth/',
          permission: '/api/v2/permissions/partial_submissions/',
          partial_permissions: [
            {
              url: '/api/v2/permissions/view_submissions/',
              filters: [
                {
                  _submitted_by: {$in: ['josh', 'bob']},
                  Where_is_it: 'South',
                },
              ],
            },
            {
              url: '/api/v2/permissions/change_submissions/',
              filters: [
                {
                  _submitted_by: 'georgia',
                  Where_is_it: 'North',
                },
              ],
            },
          ],
        },
      ]);
    });
  });

  describe('sortParseBackendOutput', () => {
    it('should sort alphabetically with owner always first', () => {
      const sortedOutput = sortParseBackendOutput([
        {
          user: {
            name: 'Frank',
            url: '/api/v2/users/frank',
            isOwner: false,
          },
          permissions: [],
        },
        {
          user: {
            name: 'Bob',
            url: '/api/v2/users/bob',
            isOwner: false,
          },
          permissions: [],
        },
        {
          user: {
            name: 'Diana',
            url: '/api/v2/users/diana',
            isOwner: true,
          },
          permissions: [],
        },
        {
          user: {
            name: 'Arthur',
            url: '/api/v2/users/arthur',
            isOwner: false,
          },
          permissions: [],
        },
        {
          user: {
            name: 'Esther',
            url: '/api/v2/users/esther',
            isOwner: false,
          },
          permissions: [],
        },
        {
          user: {
            name: 'Christian',
            url: '/api/v2/users/christian',
            isOwner: false,
          },
          permissions: [],
        },
      ]);
      chai.expect(sortedOutput).to.deep.equal([
        {
          user: {
            name: 'Diana',
            url: '/api/v2/users/diana',
            isOwner: true,
          },
          permissions: [],
        },
        {
          user: {
            name: 'Arthur',
            url: '/api/v2/users/arthur',
            isOwner: false,
          },
          permissions: [],
        },
        {
          user: {
            name: 'Bob',
            url: '/api/v2/users/bob',
            isOwner: false,
          },
          permissions: [],
        },
        {
          user: {
            name: 'Christian',
            url: '/api/v2/users/christian',
            isOwner: false,
          },
          permissions: [],
        },
        {
          user: {
            name: 'Esther',
            url: '/api/v2/users/esther',
            isOwner: false,
          },
          permissions: [],
        },
        {
          user: {
            name: 'Frank',
            url: '/api/v2/users/frank',
            isOwner: false,
          },
          permissions: [],
        },
      ]);
    });
  });

  describe('buildFormData', () => {
    it('should check proper options', () => {
      const parsed = parseBackendData(
        endpoints.assetWithMultipleUsers.results,
        endpoints.assetWithMultipleUsers.results[0].user
      );

      const built = buildFormData(parsed[1].permissions, 'eric');

      chai.expect(built).to.deep.equal({
        username: 'eric',
        submissionsView: true,
      });
    });

    it('should handle partial permissions', () => {
      const parsed = parseBackendData(
        endpoints.assetWithPartial.results,
        endpoints.assetWithPartial.results[0].user
      );

      const built = buildFormData(parsed[1].permissions, 'tessa');

      chai.expect(built).to.deep.equal({
        username: 'tessa',
        submissionsViewPartialByUsers: true,
        submissionsViewPartialByUsersList: ['john', 'olivier'],
        submissionsEditPartialByResponses: true,
        submissionsEditPartialByResponsesQuestion: 'Where_are_you_from',
        submissionsEditPartialByResponsesValue: 'Poland',
      });
    });

    it('should not destroy data when chain parsing and building', () => {
      const testUser = 'olivier';

      const usersWithPerms = parseBackendData(
        endpoints.assetWithMultipleUsers.results,
        endpoints.assetWithMultipleUsers.results[0].user
      );

      // Get testUser permissions
      const testUserPerms =
        usersWithPerms.find((item) => item.user.name === testUser)
          ?.permissions || [];

      // Build the data again for the testUser
      const builtFormData = buildFormData(testUserPerms, testUser);

      const parsedForm = parseFormData(builtFormData);

      chai.expect(parsedForm).to.deep.equal([
        {
          user: '/api/v2/users/olivier/',
          permission: '/api/v2/permissions/view_asset/',
        },
      ]);
    });

    it('should build proper form data for multiple partial permissions', () => {
      const testUser = 'gwyneth';

      const usersWithPerms = parseBackendData(
        endpoints.assetWithMultiplePartial.results,
        endpoints.assetWithMultiplePartial.results[0].user
      );

      // Get testUser permissions
      const testUserPerms =
        usersWithPerms.find((item) => item.user.name === testUser)
          ?.permissions || [];

      // Build the data again for the testUser
      const builtFormData = buildFormData(testUserPerms, testUser);

      chai.expect(builtFormData).to.deep.equal({
        username: 'gwyneth',
        submissionsAdd: true,
        submissionsViewPartialByUsers: true,
        submissionsViewPartialByUsersList: ['dave', 'krzysztof'],
        submissionsViewPartialByResponses: true,
        submissionsViewPartialByResponsesQuestion: 'Where_are_you_from',
        submissionsViewPartialByResponsesValue: 'Poland',
        submissionsEditPartialByResponses: true,
        submissionsEditPartialByResponsesQuestion: 'Your_color',
        submissionsEditPartialByResponsesValue: 'blue',
        submissionsDeletePartialByUsers: true,
        submissionsDeletePartialByUsersList: ['kate', 'joshua'],
        submissionsValidatePartialByUsers: true,
        submissionsValidatePartialByUsersList: ['zachary'],
        submissionsValidatePartialByResponses: true,
        submissionsValidatePartialByResponsesQuestion:
          'What_is_your_fav_animal',
        submissionsValidatePartialByResponsesValue: 'Racoon',
      });
    });

    it('should work with "by responses" permission with empty value', () => {
      const parsed = parseBackendData(
        [
          {
            url: '/api/v2/assets/abc123/permission-assignments/ghi789/',
            user: '/api/v2/users/joe/',
            permission: '/api/v2/permissions/manage_asset/',
            label: 'Manage asset',
          },
          {
            url: '/api/v2/assets/abc123/permission-assignments/def456/',
            user: '/api/v2/users/gwyneth/',
            permission: '/api/v2/permissions/partial_submissions/',
            label: 'Partial submissions',
            partial_permissions: [
              {
                url: '/api/v2/permissions/view_submissions/',
                filters: [{What_is_up: ''}],
              },
            ],
          },
        ],
        '/api/v2/users/joe/'
      );

      const built = buildFormData(parsed[1].permissions, 'gwyneth');

      chai.expect(built).to.deep.equal({
        username: 'gwyneth',
        submissionsViewPartialByResponses: true,
        submissionsViewPartialByResponsesQuestion: 'What_is_up',
        submissionsViewPartialByResponsesValue: '',
      });
    });
  });

  describe('parseFormData', () => {
    it('should exclude all implied permissions as they are not needed', () => {
      const parsed = parseFormData({
        username: 'leszek',
        formView: true,
        formEdit: true,
        submissionsView: true,
        submissionsViewPartialByUsers: false,
        submissionsViewPartialByUsersList: [],
        submissionsAdd: false,
        submissionsEdit: false,
        submissionsValidate: true,
      });

      chai.expect(parsed).to.deep.equal([
        {
          user: '/api/v2/users/leszek/',
          permission: '/api/v2/permissions/change_asset/',
        },
        {
          user: '/api/v2/users/leszek/',
          permission: '/api/v2/permissions/validate_submissions/',
        },
      ]);
    });

    it('should add partial_permissions with merged filters for identical partial permission', () => {
      const parsed = parseFormData({
        username: 'leszek',
        formView: true,
        formEdit: false,
        submissionsView: false,
        submissionsViewPartialByUsers: true,
        submissionsViewPartialByUsersList: ['john', 'olivier', 'eric'],
        submissionsViewPartialByResponses: true,
        submissionsViewPartialByResponsesQuestion: 'Where_are_you_from',
        submissionsViewPartialByResponsesValue: 'Poland',
        submissionsAdd: false,
        submissionsEdit: false,
        submissionsValidate: false,
      });

      chai.expect(parsed).to.deep.equal([
        {
          user: '/api/v2/users/leszek/',
          permission: '/api/v2/permissions/partial_submissions/',
          partial_permissions: [
            {
              url: '/api/v2/permissions/view_submissions/',
              filters: [
                {
                  _submitted_by: {$in: ['john', 'olivier', 'eric']},
                  Where_are_you_from: 'Poland',
                },
              ],
            },
          ],
        },
      ]);
    });

    it('should add separate partial_permissions for different partial permission', () => {
      const parsed = parseFormData({
        username: 'leszek',
        formView: true,
        formEdit: false,
        submissionsView: false,
        submissionsViewPartialByUsers: true,
        submissionsViewPartialByUsersList: ['john', 'olivier', 'eric'],
        submissionsAdd: false,
        submissionsEdit: false,
        submissionsEditPartialByResponses: true,
        submissionsEditPartialByResponsesQuestion: 'Where_are_you_from',
        submissionsEditPartialByResponsesValue: 'Poland',
        submissionsValidate: false,
      });

      chai.expect(parsed).to.deep.equal([
        {
          user: '/api/v2/users/leszek/',
          permission: '/api/v2/permissions/partial_submissions/',
          partial_permissions: [
            {
              url: '/api/v2/permissions/view_submissions/',
              filters: [{_submitted_by: {$in: ['john', 'olivier', 'eric']}}],
            },
            {
              url: '/api/v2/permissions/change_submissions/',
              filters: [{Where_are_you_from: 'Poland'}],
            },
          ],
        },
      ]);
    });

    it('should allow partial "by responses" with empty value', () => {
      const parsed = parseFormData({
        username: 'leszek',
        formView: true,
        formEdit: false,
        submissionsView: false,
        submissionsViewPartialByResponses: true,
        submissionsViewPartialByResponsesQuestion: 'What_is_up',
        submissionsViewPartialByResponsesValue: '',
      });

      chai.expect(parsed).to.deep.equal([
        {
          user: '/api/v2/users/leszek/',
          permission: '/api/v2/permissions/partial_submissions/',
          partial_permissions: [
            {
              url: '/api/v2/permissions/view_submissions/',
              filters: [{What_is_up: ''}],
            },
          ],
        },
      ]);
    });
  });

  describe('parseUserWithPermsList', () => {
    it('should return flat list of permissions', () => {
      const userWithPermsList = parseBackendData(
        endpoints.assetWithMultipleUsers.results,
        endpoints.assetWithMultipleUsers.results[0].user
      );
      const parsed = parseUserWithPermsList(userWithPermsList);

      chai.expect(parsed).to.deep.equal([
        {
          user: '/api/v2/users/kobo/',
          permission: '/api/v2/permissions/add_submissions/',
        },
        {
          user: '/api/v2/users/kobo/',
          permission: '/api/v2/permissions/change_asset/',
        },
        {
          user: '/api/v2/users/kobo/',
          permission: '/api/v2/permissions/change_submissions/',
        },
        {
          user: '/api/v2/users/kobo/',
          permission: '/api/v2/permissions/validate_submissions/',
        },
        {
          user: '/api/v2/users/kobo/',
          permission: '/api/v2/permissions/view_asset/',
        },
        {
          user: '/api/v2/users/kobo/',
          permission: '/api/v2/permissions/view_submissions/',
        },
        {
          user: '/api/v2/users/kobo/',
          permission: '/api/v2/permissions/delete_submissions/',
        },
        {
          user: '/api/v2/users/john/',
          permission: '/api/v2/permissions/view_submissions/',
        },
        {
          user: '/api/v2/users/john/',
          permission: '/api/v2/permissions/view_asset/',
        },
        {
          user: '/api/v2/users/olivier/',
          permission: '/api/v2/permissions/view_asset/',
        },
      ]);
    });

    it('should not omit partial permissions', () => {
      const userWithPermsList = parseBackendData(
        endpoints.assetWithPartial.results,
        endpoints.assetWithPartial.results[0].user
      );
      const parsed = parseUserWithPermsList(userWithPermsList);

      chai.expect(parsed).to.deep.equal([
        {
          user: '/api/v2/users/kobo/',
          permission: '/api/v2/permissions/add_submissions/',
        },
        {
          user: '/api/v2/users/kobo/',
          permission: '/api/v2/permissions/change_asset/',
        },
        {
          user: '/api/v2/users/kobo/',
          permission: '/api/v2/permissions/change_submissions/',
        },
        {
          user: '/api/v2/users/kobo/',
          permission: '/api/v2/permissions/validate_submissions/',
        },
        {
          user: '/api/v2/users/kobo/',
          permission: '/api/v2/permissions/view_asset/',
        },
        {
          user: '/api/v2/users/kobo/',
          permission: '/api/v2/permissions/view_submissions/',
        },
        {
          user: '/api/v2/users/leszek/',
          permission: '/api/v2/permissions/view_asset/',
        },
        {
          user: '/api/v2/users/leszek/',
          permission: '/api/v2/permissions/partial_submissions/',
          partial_permissions: [
            {
              url: '/api/v2/permissions/view_submissions/',
              filters: [{_submitted_by: {$in: ['john', 'olivier']}}],
            },
            {
              url: '/api/v2/permissions/change_submissions/',
              filters: [{Where_are_you_from: 'Poland'}],
            },
          ],
        },
      ]);
    });
  });
});
