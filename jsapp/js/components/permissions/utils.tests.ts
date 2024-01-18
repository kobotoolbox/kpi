import type {
  PartialPermission,
  PermissionResponse,
  PartialPermissionFilter,
} from 'js/dataInterface';
import {
  hasPartialByUsers,
  hasPartialByResponses,
  isPartialByUsersFilter,
  getPartialByUsersFilterList,
  isPartialByResponsesFilter,
  getPartialByResponsesFilter,
} from './utils';

// single partial "by users"
const PARTIAL_BY_USERS_FILTERS: PartialPermissionFilter[] = [
  {_submitted_by: {$in: ['john', 'olivier']}},
];
const PARTIAL_PERM_BY_USERS: PartialPermission = {
  url: '/api/v2/permissions/view_submissions/',
  filters: PARTIAL_BY_USERS_FILTERS,
};
const GENERAL_PERM_BY_USERS: PermissionResponse = {
  url: '/api/v2/assets/abc123/permission-assignments/def456/',
  user: '/api/v2/users/leszek/',
  permission: '/api/v2/permissions/partial_submissions/',
  label: 'Partial submissions',
  partial_permissions: [PARTIAL_PERM_BY_USERS],
};

// single partial "by responses"
const PARTIAL_BY_RESPONSES_FILTERS: PartialPermissionFilter[] = [
  {Where_are_you_from: 'Poland'},
];
const PARTIAL_PERM_BY_RESPONSES: PartialPermission = {
  url: '/api/v2/permissions/view_submissions/',
  filters: PARTIAL_BY_RESPONSES_FILTERS,
};
const GENERAL_PERM_BY_RESPONSES: PermissionResponse = {
  url: '/api/v2/assets/abc123/permission-assignments/def456/',
  user: '/api/v2/users/leszek/',
  permission: '/api/v2/permissions/partial_submissions/',
  label: 'Partial submissions',
  partial_permissions: [PARTIAL_PERM_BY_RESPONSES],
};

// both partial in single filter (AND)
const PARTIAL_BY_BOTH_AND_FILTERS: PartialPermissionFilter[] = [
  {What_do_you_love: 'Chaos', _submitted_by: {$in: ['zoe', 'xavier']}},
];
const PARTIAL_PERM_BY_BOTH_AND: PartialPermission = {
  url: '/api/v2/permissions/view_submissions/',
  filters: PARTIAL_BY_BOTH_AND_FILTERS,
};
const GENERAL_PERM_BY_BOTH_AND: PermissionResponse = {
  url: '/api/v2/assets/abc123/permission-assignments/def456/',
  user: '/api/v2/users/leszek/',
  permission: '/api/v2/permissions/partial_submissions/',
  label: 'Partial submissions',
  partial_permissions: [PARTIAL_PERM_BY_BOTH_AND],
};

// both partial in separate filters (OR)
const PARTIAL_BY_BOTH_OR_FILTERS: PartialPermissionFilter[] = [
  {Your_fav_animal: 'Racoon'},
  {_submitted_by: {$in: ['phil', 'vanessa']}},
];
const PARTIAL_PERM_BY_BOTH_OR: PartialPermission = {
  url: '/api/v2/permissions/view_submissions/',
  filters: PARTIAL_BY_BOTH_OR_FILTERS,
};
const GENERAL_PERM_BY_BOTH_OR: PermissionResponse = {
  url: '/api/v2/assets/abc123/permission-assignments/def456/',
  user: '/api/v2/users/leszek/',
  permission: '/api/v2/permissions/partial_submissions/',
  label: 'Partial submissions',
  partial_permissions: [PARTIAL_PERM_BY_BOTH_OR],
};

// no partial
const GENERAL_PERM_NON_PARTIAL: PermissionResponse = {
  url: '/api/v2/assets/zxc123/permission-assignments/vbn789/',
  user: '/api/v2/users/leszek/',
  permission: '/api/v2/permissions/view_asset/',
  label: 'View asset',
};

describe('permissions utils', () => {
  describe('hasPartialByUsers', () => {
    it('should recognize a partial "by users" permission', () => {
      chai.expect(hasPartialByUsers(GENERAL_PERM_BY_USERS)).to.equal(true);
    });

    it('should recognize that partial "by responses" permission is not partial "by users" permission', () => {
      chai.expect(hasPartialByUsers(GENERAL_PERM_BY_RESPONSES)).to.equal(false);
    });

    it('should recognize that non-partial permission is not "by users"', () => {
      chai.expect(hasPartialByUsers(GENERAL_PERM_NON_PARTIAL)).to.equal(false);
    });
  });

  describe('hasPartialByResponses', () => {
    it('should recognize a partial "by responses" permission', () => {
      chai
        .expect(hasPartialByResponses(GENERAL_PERM_BY_RESPONSES))
        .to.equal(true);
    });

    it('should recognize that partial "by users" permission is not partial "by responses" permission', () => {
      chai.expect(hasPartialByResponses(GENERAL_PERM_BY_USERS)).to.equal(false);
    });

    it('should recognize that non-partial permission is not "by users"', () => {
      chai
        .expect(hasPartialByResponses(GENERAL_PERM_NON_PARTIAL))
        .to.equal(false);
    });
  });

  describe('isPartialByUsersFilter', () => {
    it('should match partial "by users" filter', () => {
      chai
        .expect(isPartialByUsersFilter(PARTIAL_BY_USERS_FILTERS[0]))
        .to.equal(true);
    });

    it('should not match other partial filter', () => {
      chai
        .expect(isPartialByUsersFilter(PARTIAL_BY_RESPONSES_FILTERS[0]))
        .to.equal(false);
    });
  });

  describe('getPartialByUsersFilterList', () => {
    it('should find partial "by users" filter in filters with one', () => {
      chai
        .expect(getPartialByUsersFilterList(PARTIAL_PERM_BY_USERS))
        .to.deep.equal(['john', 'olivier']);
    });

    it('should not find partial "by users" filter in filters with single different filter', () => {
      chai
        .expect(getPartialByUsersFilterList(PARTIAL_PERM_BY_RESPONSES))
        .to.equal(undefined);
    });

    it('should find partial "by users" filter in filters with multiple AND filters', () => {
      chai
        .expect(getPartialByUsersFilterList(PARTIAL_PERM_BY_BOTH_AND))
        .to.deep.equal(['zoe', 'xavier']);
    });

    it('should find partial "by users" filter in filters with multiple OR filters', () => {
      chai
        .expect(getPartialByUsersFilterList(PARTIAL_PERM_BY_BOTH_OR))
        .to.deep.equal(['phil', 'vanessa']);
    });
  });

  describe('isPartialByResponsesFilter', () => {
    it('should match partial "by responses" filter', () => {
      chai
        .expect(isPartialByResponsesFilter(PARTIAL_BY_RESPONSES_FILTERS[0]))
        .to.equal(true);
    });

    it('should not match other partial filter', () => {
      chai
        .expect(isPartialByResponsesFilter(PARTIAL_BY_USERS_FILTERS[0]))
        .to.equal(false);
    });
  });

  describe('getPartialByResponsesFilter', () => {
    it('should find partial "by responses" filter in filters with one', () => {
      chai
        .expect(getPartialByResponsesFilter(PARTIAL_PERM_BY_RESPONSES))
        .to.deep.equal({Where_are_you_from: 'Poland'});
    });

    it('should not find partial "by responses" filter in filters with single different filter', () => {
      chai
        .expect(getPartialByResponsesFilter(PARTIAL_PERM_BY_USERS))
        .to.equal(undefined);
    });

    it('should find partial "by responses" filter in filters with multiple AND filters', () => {
      chai
        .expect(getPartialByResponsesFilter(PARTIAL_PERM_BY_BOTH_AND))
        .to.deep.equal({What_do_you_love: 'Chaos'});
    });

    it('should find partial "by responses" filter in filters with multiple OR filters', () => {
      chai
        .expect(getPartialByResponsesFilter(PARTIAL_PERM_BY_BOTH_OR))
        .to.deep.equal({Your_fav_animal: 'Racoon'});
    });
  });
});
