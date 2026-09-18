import chai from 'chai'
import type { AccountFieldsValues, UserFieldName } from './account.constants'
import {
  areOrganizationFieldsSkipped,
  getEditableProfileFieldNames,
  getInitialAccountFieldsValues,
  getProfileFieldsValues,
} from './account.utils'

/** The set an instance gets when an administrator asks for the organization block. */
const ORG_FIELDS: UserFieldName[] = ['name', 'organization_type', 'organization', 'organization_website']

describe('getProfileFieldsValues', () => {
  it('fills in a blank for every field the account has nothing for', () => {
    chai.expect(getProfileFieldsValues({})).to.deep.equal(getInitialAccountFieldsValues())
  })

  it('keeps the values the account does have', () => {
    const result = getProfileFieldsValues({ name: 'Caroline Herschel', country: 'DEU', newsletter_subscription: true })

    chai.expect(result.name).to.equal('Caroline Herschel')
    chai.expect(result.country).to.equal('DEU')
    chai.expect(result.newsletter_subscription).to.equal(true)
  })

  it('drops the `extra_details` keys that are not profile details', () => {
    // `extra_details` also carries app state, and none of it belongs in a PATCH built from a profile form.
    const result = getProfileFieldsValues({
      name: 'Caroline Herschel',
      last_ui_language: 'de',
      project_views_settings: { kobo_my_projects: { order: {}, filters: [] } },
    } as Partial<AccountFieldsValues>)

    chai.expect(result).to.not.have.property('last_ui_language')
    chai.expect(result).to.not.have.property('project_views_settings')
  })
})

describe('getEditableProfileFieldNames', () => {
  it('offers every configured field, required or not', () => {
    const result = getEditableProfileFieldNames({ configuredFieldNames: ORG_FIELDS, isMmoMember: false })

    chai.expect(result).to.deep.equal(ORG_FIELDS)
  })

  it('hides the organization fields from a member of a multi-member organization', () => {
    const result = getEditableProfileFieldNames({ configuredFieldNames: ORG_FIELDS, isMmoMember: true })

    chai.expect(result).to.deep.equal(['name'])
  })

  it('returns a copy, so the caller cannot edit the array held in the store', () => {
    const configuredFieldNames: UserFieldName[] = ['name']
    const result = getEditableProfileFieldNames({ configuredFieldNames, isMmoMember: false })

    chai.expect(result).to.not.equal(configuredFieldNames)
  })
})

describe('areOrganizationFieldsSkipped', () => {
  it('skips them once the type says there is no organization', () => {
    chai.expect(areOrganizationFieldsSkipped({ organization_type: 'none' }, ORG_FIELDS)).to.equal(true)
  })

  it('keeps them for any other type', () => {
    chai.expect(areOrganizationFieldsSkipped({ organization_type: 'non-profit' }, ORG_FIELDS)).to.equal(false)
  })

  it('keeps them while the type is still blank', () => {
    chai.expect(areOrganizationFieldsSkipped({ organization_type: '' }, ORG_FIELDS)).to.equal(false)
  })

  it('ignores a stale value on an instance that does not ask for the type', () => {
    const configuredFieldNames: UserFieldName[] = ['organization', 'organization_website']

    chai.expect(areOrganizationFieldsSkipped({ organization_type: 'none' }, configuredFieldNames)).to.equal(false)
  })
})
