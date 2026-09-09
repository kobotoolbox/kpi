import chai from 'chai'
import type { SocialApp } from '#/api/models/socialApp'
import { EMPTY_SIGNUP_METADATA_VALUES, type SignupMetadataValues } from './registerMetadataFields'
import {
  findManagedSsoProvider,
  getMetadataValidators,
  validateEmail,
  validatePasswordConfirm,
  validateUsername,
} from './registerValidation'

const USERNAME_MESSAGE =
  'Usernames must be between 2 and 30 characters in length, and may only consist of lowercase letters, numbers, and underscores, where the first character must be a letter.'

const managedApp: SocialApp = {
  provider: 'openid_connect',
  name: 'Example Org',
  client_id: 'example',
  provider_id: 'openid_connect',
  managed: true,
  // Mixed case on purpose: an administrator types these in, and matching has to survive that.
  domains: ['Example.ORG', 'example.net'],
}

const unmanagedApp: SocialApp = { ...managedApp, name: 'Other Org', managed: false, domains: ['other.org'] }

describe('validateUsername', () => {
  it('accepts a lowercase name starting with a letter', () => {
    chai.expect(validateUsername('kobo_user1')).to.equal(null)
  })

  it('rejects an empty value as a required field', () => {
    chai.expect(validateUsername('  ')).to.equal('Required field')
  })

  it('rejects a single character, uppercase, a leading digit and forbidden characters', () => {
    chai.expect(validateUsername('a')).to.equal(USERNAME_MESSAGE)
    chai.expect(validateUsername('Kobo')).to.equal(USERNAME_MESSAGE)
    chai.expect(validateUsername('1kobo')).to.equal(USERNAME_MESSAGE)
    chai.expect(validateUsername('kobo-user')).to.equal(USERNAME_MESSAGE)
  })

  it('rejects more than 30 characters', () => {
    chai.expect(validateUsername('k'.repeat(30))).to.equal(null)
    chai.expect(validateUsername('k'.repeat(31))).to.equal(USERNAME_MESSAGE)
  })
})

describe('validateEmail', () => {
  it('accepts a dotted domain', () => {
    chai.expect(validateEmail('someone@example.com', [])).to.equal(null)
  })

  it('rejects an empty value as a required field', () => {
    chai.expect(validateEmail('', [])).to.equal('Required field')
  })

  it('rejects an address with no @, no dotted domain or whitespace', () => {
    const message = 'Please enter a valid email address'
    chai.expect(validateEmail('someone', [])).to.equal(message)
    chai.expect(validateEmail('someone@example', [])).to.equal(message)
    chai.expect(validateEmail('some one@example.com', [])).to.equal(message)
  })

  it('rejects a domain owned by a managed SSO provider', () => {
    chai
      .expect(validateEmail('someone@example.org', [managedApp]))
      .to.equal('Your organization has restricted the use of passwords. Please sign up using SSO instead.')
  })

  it('accepts a domain owned by an unmanaged provider', () => {
    chai.expect(validateEmail('someone@other.org', [unmanagedApp])).to.equal(null)
  })
})

describe('findManagedSsoProvider', () => {
  it('matches case insensitively on either side', () => {
    chai.expect(findManagedSsoProvider('Someone@EXAMPLE.org', [unmanagedApp, managedApp])).to.equal(managedApp)
  })

  it('returns undefined for an address with no domain, and when there are no social apps', () => {
    chai.expect(findManagedSsoProvider('someone', [managedApp])).to.equal(undefined)
    chai.expect(findManagedSsoProvider('someone@example.org', undefined)).to.equal(undefined)
  })
})

describe('getMetadataValidators', () => {
  /** The rules read the other metadata values, for the organization skip logic. */
  const formValues = (overrides: Partial<SignupMetadataValues> = {}) => ({
    metadata: { ...EMPTY_SIGNUP_METADATA_VALUES, ...overrides },
  })

  const configured = (name: string, required: boolean) => ({ [name]: { name, label: name, required } })

  it('passes a blank field the instance does not ask for', () => {
    chai.expect(getMetadataValidators({}).country('', formValues())).to.equal(null)
  })

  it('passes a blank field the instance asks for but does not require', () => {
    chai.expect(getMetadataValidators(configured('country', false)).country('', formValues())).to.equal(null)
  })

  it('rejects a blank required field, whitespace included', () => {
    const validators = getMetadataValidators(configured('name', true))
    chai.expect(validators.name('   ', formValues())).to.equal('Required field')
    chai.expect(validators.name('Caroline Herschel', formValues({ name: 'Caroline Herschel' }))).to.equal(null)
  })

  it('rejects an unticked required checkbox', () => {
    const validators = getMetadataValidators(configured('newsletter_subscription', true))
    chai.expect(validators.newsletter_subscription(false, formValues())).to.equal('Required field')
    chai.expect(validators.newsletter_subscription(true, formValues())).to.equal(null)
  })

  it('stops requiring the organization fields once there is no organization', () => {
    const validators = getMetadataValidators({
      ...configured('organization_type', true),
      ...configured('organization', true),
      ...configured('organization_website', true),
    })

    chai.expect(validators.organization('', formValues({ organization_type: 'non-profit' }))).to.equal('Required field')
    chai.expect(validators.organization('', formValues({ organization_type: 'none' }))).to.equal(null)
    chai.expect(validators.organization_website('', formValues({ organization_type: 'none' }))).to.equal(null)
  })

  it('keeps requiring the organization when the type dropdown is not configured', () => {
    // Without the dropdown there is no way to say "no organization", so there is nothing to skip.
    const validators = getMetadataValidators(configured('organization', true))
    chai.expect(validators.organization('', formValues({ organization_type: 'none' }))).to.equal('Required field')
  })
})

describe('validatePasswordConfirm', () => {
  it('accepts a matching password', () => {
    chai.expect(validatePasswordConfirm('secret', 'secret')).to.equal(null)
  })

  it('rejects an empty value as a required field', () => {
    chai.expect(validatePasswordConfirm('', 'secret')).to.equal('Required field')
  })

  it('rejects a mismatch', () => {
    chai.expect(validatePasswordConfirm('secret', 'other')).to.equal('You must type the same password each time.')
  })
})
