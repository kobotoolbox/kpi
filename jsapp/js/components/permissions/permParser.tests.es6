import {permParser} from './permParser';
import permConfig from './permConfig';
import {endpoints} from './permissionsMocks';
import constants from 'js/constants';

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
      const parsed = permParser.parseBackendData(
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
      const parsed = permParser.parseBackendData(
        endpoints.assetWithAnonymousUser.results,
        endpoints.assetWithAnonymousUser.results[0].user,
        true
      );
      // parsed data should contain data of owner and anonymous user
      chai.expect(parsed.length).to.equal(2);
      chai.expect(parsed[0].user.name).to.equal('kobo');
      chai.expect(parsed[1].user.name).to.equal(constants.ANON_USERNAME);
    });

    it('should group permissions by users properly', () => {
      // in original data there are total 9 permissions (6 of asset owner,
      // 2 of one user and 1 of another)
      chai.expect(endpoints.assetWithMultipleUsers.results.length).to.equal(10);
      const parsed = permParser.parseBackendData(
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
      const sortedOutput = permParser.sortParseBackendOutput([
        {user: {url: '/api/v2/users/frank', isOwner: false}},
        {user: {url: '/api/v2/users/bob', isOwner: false}},
        {user: {url: '/api/v2/users/diana', isOwner: true}},
        {user: {url: '/api/v2/users/arthur', isOwner: false}},
        {user: {url: '/api/v2/users/esther', isOwner: false}},
        {user: {url: '/api/v2/users/christian', isOwner: false}}
      ]);
      chai.expect(sortedOutput).to.deep.equal([
        {user: {url: '/api/v2/users/diana', isOwner: true}},
        {user: {url: '/api/v2/users/arthur', isOwner: false}},
        {user: {url: '/api/v2/users/bob', isOwner: false}},
        {user: {url: '/api/v2/users/christian', isOwner: false}},
        {user: {url: '/api/v2/users/esther', isOwner: false}},
        {user: {url: '/api/v2/users/frank', isOwner: false}}
      ]);
    });
  });

  describe('buildFormData', () => {
    it('should check proper options', () => {
      const parsed = permParser.parseBackendData(
        endpoints.assetWithMultipleUsers.results,
        endpoints.assetWithMultipleUsers.results[0].user
      );

      const built = permParser.buildFormData(parsed[1].permissions);

      chai.expect(built).to.deep.equal({
        formView: true,
        submissionsView: true
      });
    });

    it('should handle partial permissions', () => {
      const parsed = permParser.parseBackendData(
        endpoints.assetWithPartial.results,
        endpoints.assetWithPartial.results[0].user
      );

      const built = permParser.buildFormData(parsed[1].permissions);

      chai.expect(built).to.deep.equal({
        formView: true,
        submissionsView: true,
        submissionsViewPartial: true,
        submissionsViewPartialUsers: ['john', 'olivier']
      });
    });
  });

  describe('parseFormData', () => {
    it('should exclude all implied permissions as they are not needed', () => {
      const parsed = permParser.parseFormData({
        username: 'leszek',
        formView: true,
        formEdit: true,
        submissionsView: true,
        submissionsViewPartial: false,
        submissionsViewPartialUsers: [],
        submissionsAdd: false,
        submissionsEdit: false,
        submissionsValidate: true
      });

      chai.expect(parsed).to.deep.equal([
        {
          user: '/api/v2/users/leszek/',
          permission: '/api/v2/permissions/change_asset/'
        },
        {
          user: '/api/v2/users/leszek/',
          permission: '/api/v2/permissions/validate_submissions/'
        }
      ]);
    });

    it('should add partial_permissions property for partial submissions permission', () => {
      const parsed = permParser.parseFormData({
        username: 'leszek',
        formView: true,
        formEdit: false,
        submissionsView: true,
        submissionsViewPartial: true,
        submissionsViewPartialUsers: ['john', 'olivier', 'eric'],
        submissionsAdd: false,
        submissionsEdit: false,
        submissionsValidate: false
      });

      chai.expect(parsed).to.deep.equal([
        {
          user: '/api/v2/users/leszek/',
          permission: '/api/v2/permissions/partial_submissions/',
          partial_permissions: [
            {
              url: '/api/v2/permissions/view_submissions/',
              filters: [
                {'_submitted_by': {'$in': ['john', 'olivier', 'eric']}}
              ]
            }
          ]
        }
      ]);
    });
  });

  describe('parseUserWithPermsList', () => {
    it('should return flat list of permissions', () => {
      const userWithPermsList = permParser.parseBackendData(
        endpoints.assetWithMultipleUsers.results,
        endpoints.assetWithMultipleUsers.results[0].user
      );
      const parsed = permParser.parseUserWithPermsList(userWithPermsList);

      chai.expect(parsed).to.deep.equal([
        {
          'user': '/api/v2/users/kobo/',
          'permission': '/api/v2/permissions/add_submissions/'
        },
        {
          'user': '/api/v2/users/kobo/',
          'permission': '/api/v2/permissions/change_asset/'
        },
        {
          'user': '/api/v2/users/kobo/',
          'permission': '/api/v2/permissions/change_submissions/'
        },
        {
          'user': '/api/v2/users/kobo/',
          'permission': '/api/v2/permissions/validate_submissions/'
        },
        {
          'user': '/api/v2/users/kobo/',
          'permission': '/api/v2/permissions/view_asset/'
        },
        {
          'user': '/api/v2/users/kobo/',
          'permission': '/api/v2/permissions/view_submissions/'
        },
        {
          'user': '/api/v2/users/kobo/',
          'permission': '/api/v2/permissions/delete_submissions/'
        },
        {
          'user': '/api/v2/users/john/',
          'permission': '/api/v2/permissions/view_submissions/'
        },
        {
          'user': '/api/v2/users/john/',
          'permission': '/api/v2/permissions/view_asset/'
        },
        {
          'user': '/api/v2/users/olivier/',
          'permission': '/api/v2/permissions/view_asset/'
        },
      ]);
    });

    it('should not omit partial permissions', () => {
      const userWithPermsList = permParser.parseBackendData(
        endpoints.assetWithPartial.results,
        endpoints.assetWithPartial.results[0].user
      );
      const parsed = permParser.parseUserWithPermsList(userWithPermsList);

      chai.expect(parsed).to.deep.equal([
        {
          'user': '/api/v2/users/kobo/',
          'permission': '/api/v2/permissions/add_submissions/'
        },
        {
          'user': '/api/v2/users/kobo/',
          'permission': '/api/v2/permissions/change_asset/'
        },
        {
          'user': '/api/v2/users/kobo/',
          'permission': '/api/v2/permissions/change_submissions/'
        },
        {
          'user': '/api/v2/users/kobo/',
          'permission': '/api/v2/permissions/validate_submissions/'
        },
        {
          'user': '/api/v2/users/kobo/',
          'permission': '/api/v2/permissions/view_asset/'
        },
        {
          'user': '/api/v2/users/kobo/',
          'permission': '/api/v2/permissions/view_submissions/'
        },
        {
          'user': '/api/v2/users/leszek/',
          'permission': '/api/v2/permissions/view_asset/'
        },
        {
          'user': '/api/v2/users/leszek/',
          'permission': '/api/v2/permissions/partial_submissions/',
          'partial_permissions': [
            {
              url: '/api/v2/permissions/view_submissions/',
              filters: [
                {'_submitted_by': {'$in': ['john', 'olivier']}}
              ]
            }
          ]
        }
      ]);
    });
  });
});
