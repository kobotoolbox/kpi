import {
  isPartialByUsers,
  isPartialByResponses,
} from './utils';

const PARTIAL_BY_USERS_PERM = {
  url: '/api/v2/assets/abc123/permission-assignments/def456/',
  user: '/api/v2/users/leszek/',
  permission: '/api/v2/permissions/partial_submissions/',
  label: 'Partial submissions',
  partial_permissions: [
    {
      url: '/api/v2/permissions/view_submissions/',
      filters: [{_submitted_by: {$in: ['john', 'olivier']}}],
    },
  ],
};

const PARTIAL_BY_RESPONSES_PERM = {
  url: '/api/v2/assets/abc123/permission-assignments/def456/',
  user: '/api/v2/users/leszek/',
  permission: '/api/v2/permissions/partial_submissions/',
  label: 'Partial submissions',
  partial_permissions: [
    {
      url: '/api/v2/permissions/view_submissions/',
      filters: [{Where_are_you_from: {$eq: 'Poland'}}],
    },
  ],
};

const NON_PARTIAL_PERM = {
  url: '/api/v2/assets/zxc123/permission-assignments/vbn789/',
  user: '/api/v2/users/leszek/',
  permission: '/api/v2/permissions/view_asset/',
  label: 'View asset',
};

describe('permissions utils', () => {
  describe('isPartialByUsers', () => {
    it('should recognize a partial "by users" permission', () => {
      chai.expect(isPartialByUsers(PARTIAL_BY_USERS_PERM)).to.equal(true);
    });

    it('should recognize that partial "by responses" permission is not partial "by users" permission', () => {
      chai.expect(isPartialByUsers(PARTIAL_BY_RESPONSES_PERM)).to.equal(false);
    });

    it('should recognize that non-partial permission is not "by users"', () => {
      chai.expect(isPartialByUsers(NON_PARTIAL_PERM)).to.equal(false);
    });
  });

  describe('isPartialByResponses', () => {
    it('should recognize a partial "by responses" permission', () => {
      chai.expect(isPartialByResponses(PARTIAL_BY_RESPONSES_PERM)).to.equal(true);
    });

    it('should recognize that partial "by users" permission is not partial "by responses" permission', () => {
      chai.expect(isPartialByResponses(PARTIAL_BY_USERS_PERM)).to.equal(false);
    });

    it('should recognize that non-partial permission is not "by users"', () => {
      chai.expect(isPartialByResponses(NON_PARTIAL_PERM)).to.equal(false);
    });
  });
});
