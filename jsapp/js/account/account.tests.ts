import chai from 'chai'
import type { EnvironmentResponse } from '#/api/models/environmentResponse'
import { environmentResponse } from '#/endpoints/environment.mocks'
import type { AccountFieldsValues, UserFieldName, UserMetadataField } from './account.constants'
import { ORG_FIELDS } from './account.mocks'
import {
  getAccountFieldsConfig,
  getEditableProfileFieldNames,
  getInitialAccountFieldsValues,
  getProfileFieldsValues,
  getUserMetadataFieldLabel,
  getUserMetadataFieldsByName,
  hasNoOrganizationAffiliation,
} from './account.utils'

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

describe('getAccountFieldsConfig', () => {
  /** A production-like `/environment`, with only the part each case is about overridden. */
  const environment = (overrides: Partial<EnvironmentResponse>): EnvironmentResponse => {
    return {
      ...environmentResponse,
      ...overrides,
    }
  }

  it('keeps the fields in the order the instance lists them', () => {
    const result = getAccountFieldsConfig(
      environment({
        user_metadata_fields: [
          { name: 'country', label: 'Country', required: true },
          { name: 'name', label: 'Full name', required: true },
        ],
      }),
    )

    chai.expect(result.userMetadataFields.map((field) => field.name)).to.deep.equal(['country', 'name'])
  })

  it('reads a field without `required` as not required, the way the serializer does', () => {
    const result = getAccountFieldsConfig(environment({ user_metadata_fields: [{ name: 'city', label: 'City' }] }))

    chai.expect(result.userMetadataFields).to.deep.equal([{ name: 'city', required: false, label: 'City' }])
  })

  it('drops a field this build has no input for, rather than asking for something it cannot show', () => {
    const result = getAccountFieldsConfig(
      environment({
        user_metadata_fields: [
          { name: 'name', label: 'Full name', required: true },
          { name: 'favourite_comet', label: 'Favourite comet', required: true },
        ],
      }),
    )

    chai.expect(result.userMetadataFields.map((field) => field.name)).to.deep.equal(['name'])
  })

  it('keeps one entry for a name the instance lists twice, the last one given', () => {
    const result = getAccountFieldsConfig(
      environment({
        user_metadata_fields: [
          { name: 'name', label: 'Full name', required: false },
          { name: 'city', label: 'City', required: false },
          { name: 'name', label: 'Your name', required: true },
        ],
      }),
    )

    chai.expect(result.userMetadataFields).to.deep.equal([
      { name: 'name', required: true, label: 'Your name' },
      { name: 'city', required: false, label: 'City' },
    ])
  })

  it('turns the choice tuples into dropdown options', () => {
    const result = getAccountFieldsConfig(
      environment({
        country_choices: [['DEU', 'Germany']],
        sector_choices: [['Public Administration', 'Public Administration']],
      }),
    )

    chai.expect(result.countryChoices).to.deep.equal([{ value: 'DEU', label: 'Germany' }])
    chai
      .expect(result.sectorChoices)
      .to.deep.equal([{ value: 'Public Administration', label: 'Public Administration' }])
  })
})

describe('getUserMetadataFieldsByName', () => {
  it('keys the configuration by field name', () => {
    const city: UserMetadataField = { name: 'city', required: false, label: 'City' }

    chai.expect(getUserMetadataFieldsByName([city])).to.deep.equal({ city })
  })

  it('leaves out a field the instance does not ask for, which is how callers tell', () => {
    chai.expect(getUserMetadataFieldsByName([])).to.not.have.property('city')
  })
})

describe('getUserMetadataFieldLabel', () => {
  const fields: UserMetadataField[] = [
    { name: 'name', required: true, label: 'Full name' },
    { name: 'city', required: false, label: '' },
  ]

  it('gives the instance’s own label', () => {
    chai.expect(getUserMetadataFieldLabel(fields, 'name')).to.equal('Full name')
  })

  it('falls back to the field name when the instance configured none', () => {
    chai.expect(getUserMetadataFieldLabel(fields, 'city')).to.equal('city')
  })

  it('falls back to the field name for a field that is not configured at all', () => {
    chai.expect(getUserMetadataFieldLabel(fields, 'bio')).to.equal('bio')
  })

  it('agrees with the editor about a name given twice, so a message cannot name a field the input does not', () => {
    const duplicated: UserMetadataField[] = [
      { name: 'name', required: true, label: 'Full name' },
      { name: 'name', required: true, label: 'Your name' },
    ]

    chai
      .expect(getUserMetadataFieldLabel(duplicated, 'name'))
      .to.equal(getUserMetadataFieldsByName(duplicated).name?.label)
  })
})

describe('hasNoOrganizationAffiliation', () => {
  it('skips them once the type says there is no organization', () => {
    chai.expect(hasNoOrganizationAffiliation({ organization_type: 'none' }, ORG_FIELDS)).to.equal(true)
  })

  it('keeps them for any other type', () => {
    chai.expect(hasNoOrganizationAffiliation({ organization_type: 'non-profit' }, ORG_FIELDS)).to.equal(false)
  })

  it('keeps them while the type is still blank', () => {
    chai.expect(hasNoOrganizationAffiliation({ organization_type: '' }, ORG_FIELDS)).to.equal(false)
  })

  it('ignores a stale value on an instance that does not ask for the type', () => {
    const configuredFieldNames: UserFieldName[] = ['organization', 'organization_website']

    chai.expect(hasNoOrganizationAffiliation({ organization_type: 'none' }, configuredFieldNames)).to.equal(false)
  })
})
