import {
  parseFormData,
  buildFormData,
  parseBackendData,
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
        formView: true,
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
        formView: true,
        submissionsViewPartialByUsers: true,
        submissionsViewPartialByUsersList: ['john', 'olivier'],
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

    it('should add partial_permissions property for partial submissions permission', () => {
      const parsed = parseFormData({
        username: 'leszek',
        formView: true,
        formEdit: false,
        submissionsView: true,
        submissionsViewPartialByUsers: true,
        submissionsViewPartialByUsersList: ['john', 'olivier', 'eric'],
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
              filters: [{_submitted_by: {$in: ['john', 'olivier', 'eric']}}],
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
          ],
        },
      ]);
    });
  });
});
