// Jest hoisting: `var` ensures these are available when mock factories run.
var mockedCurrentAccount
var mockedGetQueryData

jest.mock('#/stores/session', () => {
  mockedCurrentAccount = { username: 'alice' }
  return {
    __esModule: true,
    default: {
      get currentAccount() {
        return mockedCurrentAccount
      },
    },
  }
})

jest.mock('#/api/queryClient', () => {
  mockedGetQueryData = jest.fn()
  return { queryClient: { getQueryData: mockedGetQueryData } }
})

jest.mock('#/api/react-query/user-team-organization-usage', () => ({
  getOrganizationsRetrieveQueryKey: (uid) => ['orgs', uid],
}))

import { MemberRoleEnum } from '#/api/models/memberRoleEnum'
import { getApiV2AssetsRetrieveResponseMock } from '#/api/react-query/manage-projects-and-library-content'
import { DeleteBlockerReason, getSurveyFlatPaths, userCanDeleteAssets } from '#/assetUtils'
import { surveyWithAllPossibleGroups, surveyWithGroups } from '#/assetUtils.mocks'

describe('getSurveyFlatPaths', () => {
  it('should return a list of paths for all questions', () => {
    const test = getSurveyFlatPaths(surveyWithGroups)
    const target = {
      Your_place: 'Your_place',
      Your_name: 'Your_name',
      When_did_you_eat: 'group_breakfast/When_did_you_eat',
      What_did_you_eat: 'group_breakfast/What_did_you_eat',
      Snack_name: 'group_snacks/Snack_name',
      Time_of_consumption: 'group_snacks/Time_of_consumption',
      How_much_protein_was_it: 'group_snacks/group_nutrients/How_much_protein_was_it',
      How_much_H2O_was_it: 'group_snacks/group_nutrients/How_much_H2O_was_it',
      Favourite_food: 'group_favs/Favourite_food',
      Favourite_fruit: 'group_favs/group_favplant/Favourite_fruit',
      Favourite_carrot: 'group_favs/group_favplant/group_favveg/Favourite_carrot',
      Favourite_potato: 'group_favs/group_favplant/group_favveg/Favourite_potato',
      Favourite_vegan_hummus: 'group_favs/group_favvegan/Favourite_vegan_hummus',
      Favourite_spiece: 'group_favs/Favourite_spiece',
      Comments: 'Comments',
    }
    expect(test).to.deep.equal(target)
  })

  it('should work with all possible group types', () => {
    const test = getSurveyFlatPaths(surveyWithAllPossibleGroups)
    const target = {
      First_name: 'group_people/First_name',
      Original_location: 'group_location/Original_location',
      Current_location: 'group_location/Current_location',
      Killing_humans: 'Are_you_vegan/Killing_humans',
      Killing_nonhumans: 'Are_you_vegan/Killing_nonhumans',
      _1st_choice: 'Best_things_in_life/_1st_choice',
      _2nd_choice: 'Best_things_in_life/_2nd_choice',
      _3rd_choice: 'Best_things_in_life/_3rd_choice',
      human: 'group_crossbreeding/human',
      nonhuman: 'group_crossbreeding/nonhuman',
    }
    expect(test).to.deep.equal(target)
  })

  it('should work with all possible group types with groups included', () => {
    const test = getSurveyFlatPaths(surveyWithAllPossibleGroups, true)
    const target = {
      group_people: 'group_people',
      First_name: 'group_people/First_name',
      group_location: 'group_location',
      Original_location: 'group_location/Original_location',
      Current_location: 'group_location/Current_location',
      Are_you_vegan: 'Are_you_vegan',
      Killing_humans: 'Are_you_vegan/Killing_humans',
      Killing_nonhumans: 'Are_you_vegan/Killing_nonhumans',
      Best_things_in_life: 'Best_things_in_life',
      _1st_choice: 'Best_things_in_life/_1st_choice',
      _2nd_choice: 'Best_things_in_life/_2nd_choice',
      _3rd_choice: 'Best_things_in_life/_3rd_choice',
      group_crossbreeding: 'group_crossbreeding',
      human: 'group_crossbreeding/human',
      nonhuman: 'group_crossbreeding/nonhuman',
    }
    expect(test).to.deep.equal(target)
  })

  it('should include groups in the output if asked to', () => {
    const test = getSurveyFlatPaths(surveyWithGroups, true)
    const target = {
      Your_place: 'Your_place',
      Your_name: 'Your_name',
      group_breakfast: 'group_breakfast',
      When_did_you_eat: 'group_breakfast/When_did_you_eat',
      What_did_you_eat: 'group_breakfast/What_did_you_eat',
      group_snacks: 'group_snacks',
      Snack_name: 'group_snacks/Snack_name',
      Time_of_consumption: 'group_snacks/Time_of_consumption',
      group_nutrients: 'group_snacks/group_nutrients',
      How_much_protein_was_it: 'group_snacks/group_nutrients/How_much_protein_was_it',
      How_much_H2O_was_it: 'group_snacks/group_nutrients/How_much_H2O_was_it',
      group_favs: 'group_favs',
      Favourite_food: 'group_favs/Favourite_food',
      group_favplant: 'group_favs/group_favplant',
      Favourite_fruit: 'group_favs/group_favplant/Favourite_fruit',
      group_favveg: 'group_favs/group_favplant/group_favveg',
      Favourite_carrot: 'group_favs/group_favplant/group_favveg/Favourite_carrot',
      Favourite_potato: 'group_favs/group_favplant/group_favveg/Favourite_potato',
      group_favvegan: 'group_favs/group_favvegan',
      Favourite_vegan_hummus: 'group_favs/group_favvegan/Favourite_vegan_hummus',
      Favourite_spiece: 'group_favs/Favourite_spiece',
      Comments: 'Comments',
    }
    expect(test).to.deep.equal(target)
  })
})

// ---------------------------------------------------------------------------
// userCanDeleteAssets
// ---------------------------------------------------------------------------

function makeOrgResponse(overrides = {}) {
  return {
    status: 200,
    data: {
      id: 'org-1',
      url: '',
      name: 'Test Org',
      website: '',
      organization_type: 'none',
      created: '',
      modified: '',
      is_owner: false,
      is_mmo: true,
      request_user_role: MemberRoleEnum.member,
      members: '',
      assets: '',
      service_usage: '',
      asset_usage: '',
      ...overrides,
    },
  }
}

function setAccount(username, orgUid) {
  mockedCurrentAccount = orgUid ? { username, organization: { uid: orgUid, url: '', name: '' } } : { username }
}

describe('userCanDeleteAssets', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setAccount('alice', 'org-1')
  })

  describe('admin user', () => {
    beforeEach(() => {
      mockedGetQueryData.mockReturnValue(makeOrgResponse({ is_mmo: true, request_user_role: MemberRoleEnum.admin }))
    })

    it('can delete any asset regardless of ownership or submissions', () => {
      const assets = [
        getApiV2AssetsRetrieveResponseMock({ created_by: 'bob', deployment__submission_count: 100 }),
        getApiV2AssetsRetrieveResponseMock({ created_by: null, deployment__submission_count: 0 }),
      ]
      const results = userCanDeleteAssets(assets)
      expect(results.every((r) => r.canDelete)).to.be.true
    })

    it('returns canDelete: true even when the project was created by someone else', () => {
      const asset = getApiV2AssetsRetrieveResponseMock({ created_by: 'carol', deployment__submission_count: 999 })
      const [result] = userCanDeleteAssets([asset])
      expect(result.canDelete).to.be.true
    })
  })

  describe('MMO member', () => {
    beforeEach(() => {
      mockedGetQueryData.mockReturnValue(makeOrgResponse({ is_mmo: true, request_user_role: MemberRoleEnum.member }))
    })

    it('can delete own project with no submissions', () => {
      const asset = getApiV2AssetsRetrieveResponseMock({ created_by: 'alice', deployment__submission_count: 0 })
      const [result] = userCanDeleteAssets([asset])
      expect(result.canDelete).to.be.true
    })

    it('is blocked from deleting own project that has submissions', () => {
      const asset = getApiV2AssetsRetrieveResponseMock({ created_by: 'alice', deployment__submission_count: 5 })
      const [result] = userCanDeleteAssets([asset])
      expect(result.canDelete).to.be.false
      if (!result.canDelete) {
        expect(result.reason).to.equal(DeleteBlockerReason.submissions)
      }
    })

    it("is blocked from deleting another member's project (no submissions)", () => {
      const asset = getApiV2AssetsRetrieveResponseMock({ created_by: 'bob', deployment__submission_count: 0 })
      const [result] = userCanDeleteAssets([asset])
      expect(result.canDelete).to.be.false
      if (!result.canDelete) {
        expect(result.reason).to.equal(DeleteBlockerReason.permissions)
      }
    })

    it('permissions blocker takes priority when project belongs to another member and has submissions', () => {
      const asset = getApiV2AssetsRetrieveResponseMock({ created_by: 'bob', deployment__submission_count: 10 })
      const [result] = userCanDeleteAssets([asset])
      expect(result.canDelete).to.be.false
      if (!result.canDelete) {
        expect(result.reason).to.equal(DeleteBlockerReason.permissions)
      }
    })

    it('is blocked when created_by is null', () => {
      const asset = getApiV2AssetsRetrieveResponseMock({ created_by: null, deployment__submission_count: 0 })
      const [result] = userCanDeleteAssets([asset])
      expect(result.canDelete).to.be.false
      if (!result.canDelete) {
        expect(result.reason).to.equal(DeleteBlockerReason.permissions)
      }
    })

    it('returns per-asset results in input order for a mixed set', () => {
      const assets = [
        getApiV2AssetsRetrieveResponseMock({ uid: 'a1', created_by: 'alice', deployment__submission_count: 0 }), // ok
        getApiV2AssetsRetrieveResponseMock({ uid: 'a2', created_by: 'alice', deployment__submission_count: 3 }), // submissions
        getApiV2AssetsRetrieveResponseMock({ uid: 'a3', created_by: 'bob', deployment__submission_count: 0 }), // permissions
        getApiV2AssetsRetrieveResponseMock({ uid: 'a4', created_by: 'alice', deployment__submission_count: 0 }), // ok
      ]
      const results = userCanDeleteAssets(assets)

      expect(results).to.have.length(4)
      expect(results[0].canDelete).to.be.true
      expect(results[1].canDelete).to.be.false
      if (!results[1].canDelete) expect(results[1].reason).to.equal(DeleteBlockerReason.submissions)
      expect(results[2].canDelete).to.be.false
      if (!results[2].canDelete) expect(results[2].reason).to.equal(DeleteBlockerReason.permissions)
      expect(results[3].canDelete).to.be.true
    })

    it('preserves the original asset reference in each result', () => {
      const asset = getApiV2AssetsRetrieveResponseMock({ uid: 'unique-uid', created_by: 'alice' })
      const [result] = userCanDeleteAssets([asset])
      expect(result.asset).to.equal(asset)
    })
  })

  describe('MMO owner', () => {
    it('can delete any asset (owner is not subject to MMO member restrictions)', () => {
      mockedGetQueryData.mockReturnValue(makeOrgResponse({ is_mmo: true, request_user_role: MemberRoleEnum.owner }))
      const asset = getApiV2AssetsRetrieveResponseMock({ created_by: 'bob', deployment__submission_count: 50 })
      const [result] = userCanDeleteAssets([asset])
      expect(result.canDelete).to.be.true
    })
  })

  describe('non-MMO user', () => {
    it('can delete all assets regardless of ownership or submissions', () => {
      mockedGetQueryData.mockReturnValue(makeOrgResponse({ is_mmo: false, request_user_role: MemberRoleEnum.member }))
      const assets = [
        getApiV2AssetsRetrieveResponseMock({ created_by: 'bob', deployment__submission_count: 10 }),
        getApiV2AssetsRetrieveResponseMock({ created_by: null }),
      ]
      const results = userCanDeleteAssets(assets)
      expect(results.every((r) => r.canDelete)).to.be.true
    })
  })

  describe('edge cases', () => {
    it('treats missing org cache data as no restrictions', () => {
      mockedGetQueryData.mockReturnValue(undefined)
      const asset = getApiV2AssetsRetrieveResponseMock({ created_by: 'bob', deployment__submission_count: 99 })
      const [result] = userCanDeleteAssets([asset])
      expect(result.canDelete).to.be.true
    })

    it('treats a non-200 org response as no restrictions', () => {
      mockedGetQueryData.mockReturnValue({ status: 404, data: { detail: 'Not found' } })
      const asset = getApiV2AssetsRetrieveResponseMock({ created_by: 'bob', deployment__submission_count: 5 })
      const [result] = userCanDeleteAssets([asset])
      expect(result.canDelete).to.be.true
    })

    it('treats an account with no organization property as no restrictions', () => {
      setAccount('alice')
      const asset = getApiV2AssetsRetrieveResponseMock({ created_by: 'bob' })
      const [result] = userCanDeleteAssets([asset])
      expect(result.canDelete).to.be.true
    })

    it('returns an empty array when given an empty array', () => {
      mockedGetQueryData.mockReturnValue(makeOrgResponse({ is_mmo: true, request_user_role: MemberRoleEnum.admin }))
      const results = userCanDeleteAssets([])
      expect(results).to.have.length(0)
    })
  })
})
