import chai from 'chai'
import type { AccountFieldsValues, UserFieldName, UserMetadataField } from '#/account/account.constants'
import { ORG_FIELDS } from '#/account/account.mocks'
import { getInitialAccountFieldsValues } from '#/account/account.utils'
import type { AccountResponse } from '#/dataInterface'
import { meMockResponse } from '#/endpoints/me.mocks'
import {
  doBlankFieldsDependOnMmoStatus,
  getBlankRequiredProfileFieldNames,
  getBlankRequiredProfileFieldNamesForAccount,
  getProfileFieldsContext,
  getRequiredProfileFieldErrors,
  splitProfileUpdateErrors,
} from './profileDetails.utils'

const values = (overrides: Partial<AccountFieldsValues> = {}): AccountFieldsValues => {
  return {
    ...getInitialAccountFieldsValues(),
    ...overrides,
  }
}

/** The `/me` mock with profile values swapped in; cast because the generated type is not an `AccountResponse`. */
const account = (extraDetails: Partial<AccountFieldsValues>): AccountResponse =>
  ({ ...meMockResponse, extra_details: extraDetails }) as unknown as AccountResponse

describe('getBlankRequiredProfileFieldNames', () => {
  it('finds nothing to complain about when every required field is filled in', () => {
    const result = getBlankRequiredProfileFieldNames(values({ name: 'Caroline Herschel', city: 'Hanover' }), {
      configuredFieldNames: ['name', 'city'],
      requiredFieldNames: ['name', 'city'],
      isMmoMember: false,
    })

    chai.expect(result).to.deep.equal([])
  })

  it('ignores a blank field that is configured but not required', () => {
    const result = getBlankRequiredProfileFieldNames(values({ name: 'Caroline Herschel' }), {
      configuredFieldNames: ['name', 'city'],
      requiredFieldNames: ['name'],
      isMmoMember: false,
    })

    chai.expect(result).to.deep.equal([])
  })

  it('reports every blank required field', () => {
    const result = getBlankRequiredProfileFieldNames(values({ name: 'Caroline Herschel' }), {
      configuredFieldNames: ORG_FIELDS,
      requiredFieldNames: ORG_FIELDS,
      isMmoMember: false,
    })

    chai.expect(result).to.deep.equal(['organization_type', 'organization', 'organization_website'])
  })

  it('counts an unticked required checkbox as blank, the way Python truthiness does', () => {
    const result = getBlankRequiredProfileFieldNames(values({ newsletter_subscription: false }), {
      configuredFieldNames: ['newsletter_subscription'],
      requiredFieldNames: ['newsletter_subscription'],
      isMmoMember: false,
    })

    chai.expect(result).to.deep.equal(['newsletter_subscription'])
  })

  it('excuses the organization fields for a member of a multi-member organization', () => {
    // They are not this user's to write, so requiring them would be a screen they could never satisfy.
    const result = getBlankRequiredProfileFieldNames(values({ name: 'Caroline Herschel' }), {
      configuredFieldNames: ORG_FIELDS,
      requiredFieldNames: ORG_FIELDS,
      isMmoMember: true,
    })

    chai.expect(result).to.deep.equal([])
  })

  it('excuses the organization name and website once the type says there is no organization', () => {
    const result = getBlankRequiredProfileFieldNames(values({ name: 'Caroline Herschel', organization_type: 'none' }), {
      configuredFieldNames: ORG_FIELDS,
      requiredFieldNames: ORG_FIELDS,
      isMmoMember: false,
    })

    chai.expect(result).to.deep.equal([])
  })

  it('does not excuse them when the instance does not ask for the organization type at all', () => {
    // The server only applies the relaxation when `organization_type` is configured, so a stale `'none'`
    // left in `extra_details` must not let the other two through.
    const result = getBlankRequiredProfileFieldNames(values({ organization_type: 'none' }), {
      configuredFieldNames: ['organization', 'organization_website'],
      requiredFieldNames: ['organization', 'organization_website'],
      isMmoMember: false,
    })

    chai.expect(result).to.deep.equal(['organization', 'organization_website'])
  })

  it('still requires the organization type itself when it is blank', () => {
    const result = getBlankRequiredProfileFieldNames(values(), {
      configuredFieldNames: ORG_FIELDS,
      requiredFieldNames: ['organization_type'],
      isMmoMember: false,
    })

    chai.expect(result).to.deep.equal(['organization_type'])
  })
})

describe('getProfileFieldsContext', () => {
  const fields: UserMetadataField[] = [
    { name: 'name', required: true, label: 'Full name' },
    { name: 'city', required: false, label: 'City' },
    { name: 'country', required: true, label: 'Country' },
  ]

  it('splits the instance configuration into the names and the required ones, in the order given', () => {
    chai.expect(getProfileFieldsContext(fields, false)).to.deep.equal({
      configuredFieldNames: ['name', 'city', 'country'],
      requiredFieldNames: ['name', 'country'],
      isMmoMember: false,
    })
  })

  it('carries who is being asked', () => {
    chai.expect(getProfileFieldsContext(fields, true).isMmoMember).to.equal(true)
  })

  it('answers empty lists for an instance that asks for nothing', () => {
    chai.expect(getProfileFieldsContext([], false)).to.deep.equal({
      configuredFieldNames: [],
      requiredFieldNames: [],
      isMmoMember: false,
    })
  })
})

describe('getBlankRequiredProfileFieldNamesForAccount', () => {
  const fields: UserMetadataField[] = [
    { name: 'name', required: true, label: 'Full name' },
    { name: 'organization', required: true, label: 'Organization name' },
  ]

  it("reads the values out of the account's `extra_details`", () => {
    const result = getBlankRequiredProfileFieldNamesForAccount({
      account: account({ name: 'Caroline Herschel' }),
      userMetadataFields: fields,
    })

    chai.expect(result).to.deep.equal(['organization'])
  })

  it('finds nothing to ask for once the account has it all', () => {
    const result = getBlankRequiredProfileFieldNamesForAccount({
      account: account({ name: 'Caroline Herschel', organization: 'Royal Astronomical Society' }),
      userMetadataFields: fields,
    })

    chai.expect(result).to.deep.equal([])
  })

  it('answers nothing before `/environment` lands, whatever the account is missing', () => {
    const result = getBlankRequiredProfileFieldNamesForAccount({
      account: account({}),
      userMetadataFields: undefined,
    })

    chai.expect(result).to.deep.equal([])
  })

  it('answers nothing with nobody signed in', () => {
    const result = getBlankRequiredProfileFieldNamesForAccount({ account: undefined, userMetadataFields: fields })

    chai.expect(result).to.deep.equal([])
  })

  it("counts the organization's own fields when not told whose organization it is", () => {
    // The widest reading, which is what decides whether the organization is worth asking about at all.
    const result = getBlankRequiredProfileFieldNamesForAccount({
      account: account({ name: 'Caroline Herschel' }),
      userMetadataFields: fields,
    })

    chai.expect(doBlankFieldsDependOnMmoStatus(result)).to.equal(true)
  })

  it('excuses them once the organization says it has more than one member', () => {
    const result = getBlankRequiredProfileFieldNamesForAccount({
      account: account({ name: 'Caroline Herschel' }),
      userMetadataFields: fields,
      isMmoMember: true,
    })

    chai.expect(result).to.deep.equal([])
  })
})

describe('doBlankFieldsDependOnMmoStatus', () => {
  it("says no when everything missing is the user's own to fill in", () => {
    chai.expect(doBlankFieldsDependOnMmoStatus(['name', 'city'])).to.equal(false)
  })

  it('says yes for a field an organization fills in for its members', () => {
    chai.expect(doBlankFieldsDependOnMmoStatus(['name', 'organization_type'])).to.equal(true)
  })

  it('says no when nothing is missing at all', () => {
    chai.expect(doBlankFieldsDependOnMmoStatus([])).to.equal(false)
  })
})

const options = {
  displayedFieldNames: ['name', 'city', 'newsletter_subscription'] as UserFieldName[],
  labelFor: (fieldName: UserFieldName) => `Label for ${fieldName}`,
}

describe('getRequiredProfileFieldErrors', () => {
  it('puts the message under every field that has room for one', () => {
    const result = getRequiredProfileFieldErrors(['name', 'city'], options)

    chai.expect(result.fieldErrors).to.deep.equal({ name: 'Required field', city: 'Required field' })
    chai.expect(result.formErrors).to.deep.equal([])
  })

  it('banners the newsletter checkbox instead, named, since it has no room for one', () => {
    const result = getRequiredProfileFieldErrors(['newsletter_subscription'], options)

    chai.expect(result.fieldErrors).to.deep.equal({})
    chai.expect(result.formErrors).to.deep.equal(['Label for newsletter_subscription: Required field'])
  })

  it('banners a field the editor is not showing, so the message cannot go unseen', () => {
    const result = getRequiredProfileFieldErrors(['organization'], options)

    chai.expect(result.fieldErrors).to.deep.equal({})
    chai.expect(result.formErrors).to.deep.equal(['Label for organization: Required field'])
  })
})

describe('splitProfileUpdateErrors', () => {
  it('puts a message about a displayed field under that field', () => {
    const result = splitProfileUpdateErrors({ extra_details: { name: 'This field may not be blank.' } }, options)

    chai.expect(result.fieldErrors).to.deep.equal({ name: 'This field may not be blank.' })
    chai.expect(result.formErrors).to.deep.equal([])
  })

  it('banners a message about a field the editor has no error slot for, named', () => {
    // `AccountFieldsEditor` renders the newsletter checkbox without anywhere to put a message.
    const result = splitProfileUpdateErrors(
      { extra_details: { newsletter_subscription: 'This field may not be blank.' } },
      options,
    )

    chai.expect(result.fieldErrors).to.deep.equal({})
    chai.expect(result.formErrors).to.deep.equal(['Label for newsletter_subscription: This field may not be blank.'])
  })

  it('banners a message about a field we are not showing, named', () => {
    const result = splitProfileUpdateErrors({ extra_details: { organization: 'This action is not allowed.' } }, options)

    chai.expect(result.fieldErrors).to.deep.equal({})
    chai.expect(result.formErrors).to.deep.equal(['Label for organization: This action is not allowed.'])
  })

  it('banners a message about a field this build has never heard of, unnamed', () => {
    const result = splitProfileUpdateErrors({ extra_details: { favourite_comet: 'Pick one.' } }, options)

    chai.expect(result.fieldErrors).to.deep.equal({})
    chai.expect(result.formErrors).to.deep.equal(['Pick one.'])
  })

  it('banners a top-level message such as `detail`', () => {
    const result = splitProfileUpdateErrors({ detail: 'Authentication credentials were not provided.' }, options)

    chai.expect(result.fieldErrors).to.deep.equal({})
    chai.expect(result.formErrors).to.deep.equal(['Authentication credentials were not provided.'])
  })

  it('reads field messages and general ones out of the same response', () => {
    const result = splitProfileUpdateErrors(
      { extra_details: { city: 'This field may not be blank.' }, detail: 'Some of it went wrong.' },
      options,
    )

    chai.expect(result.fieldErrors).to.deep.equal({ city: 'This field may not be blank.' })
    chai.expect(result.formErrors).to.deep.equal(['Some of it went wrong.'])
  })

  it('flattens a list of messages into one line', () => {
    const result = splitProfileUpdateErrors({ extra_details: { name: ['Too short.', 'Too plain.'] } }, options)

    chai.expect(result.fieldErrors).to.deep.equal({ name: 'Too short. Too plain.' })
  })

  it('flattens a nested dict of messages into one line', () => {
    const result = splitProfileUpdateErrors(
      { extra_details: { name: { first: ['Too short.'], last: 'Missing.' } } },
      options,
    )

    chai.expect(result.fieldErrors).to.deep.equal({ name: 'Too short. Missing.' })
  })

  it('skips a field whose message is empty rather than showing a blank error', () => {
    const result = splitProfileUpdateErrors({ extra_details: { name: [], city: '  ' } }, options)

    chai.expect(result.fieldErrors).to.deep.equal({})
    chai.expect(result.formErrors).to.deep.equal([])
  })

  it('quotes a non-JSON body, which arrives as raw text', () => {
    const result = splitProfileUpdateErrors('<h1>502 Bad Gateway</h1>\n', options)

    chai.expect(result.fieldErrors).to.deep.equal({})
    chai.expect(result.formErrors).to.deep.equal(['<h1>502 Bad Gateway</h1>'])
  })

  it('finds nothing in an empty body, leaving the caller to supply its own wording', () => {
    chai.expect(splitProfileUpdateErrors(undefined, options)).to.deep.equal({ fieldErrors: {}, formErrors: [] })
    chai.expect(splitProfileUpdateErrors('', options)).to.deep.equal({ fieldErrors: {}, formErrors: [] })
    chai.expect(splitProfileUpdateErrors([], options)).to.deep.equal({ fieldErrors: {}, formErrors: [] })
  })
})
