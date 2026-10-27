import chai from 'chai'
import type { ProviderAccount } from '#/api/models/providerAccount'
import type { EnvStoreData, SocialApp } from '#/envStore'
import { findAppForProviderAccount, getSsoConnectErrorMessage } from './sso.utils'

const socialApp = (override: Partial<SocialApp> = {}): SocialApp => ({
  name: 'Example Organization',
  provider: 'openid_connect',
  provider_id: 'example-org',
  client_id: 'example-client-id',
  managed: false,
  domains: ['example.org'],
  ...override,
})

/** Only `social_apps` is read, so the rest of the store does not need standing up. */
const envDataWith = (social_apps: SocialApp[]) => ({ social_apps }) as EnvStoreData

const providerAccount = (providerId: string): ProviderAccount => ({
  uid: 'provider-account-uid',
  display: 'sallyride@nasa.com',
  provider: { id: providerId, name: 'Example Organization', flows: ['provider_redirect'] },
})

describe('findAppForProviderAccount', () => {
  it("matches allauth's provider id against the `provider_id` the app was configured with", () => {
    const app = socialApp()
    chai.expect(findAppForProviderAccount(envDataWith([app]), providerAccount('example-org'))).to.equal(app)
  })

  it('finds nothing for a provider kept off `/environment`, rather than mismatching the first one', () => {
    chai
      .expect(findAppForProviderAccount(envDataWith([socialApp()]), providerAccount('enterprise-sso')))
      .to.equal(undefined)
  })
})

describe('getSsoConnectErrorMessage', () => {
  it('names the real cause of the likeliest failure, rather than blaming the login', () => {
    chai
      .expect(getSsoConnectErrorMessage('connected_other'))
      .to.equal(
        'That account is already connected to a different KoboToolbox account.' +
          ' Please disconnect it there first, or use a different one.',
      )
  })

  it('words a cancelled handshake as a cancelled connection', () => {
    chai.expect(getSsoConnectErrorMessage('cancelled')).to.contain('Connecting was cancelled')
  })

  it("words allauth's own refusal like a provider refusing the login", () => {
    chai.expect(getSsoConnectErrorMessage('permission_denied')).to.contain('refused the request')
  })

  it('says to disable the current connection when KPI refuses a second one', () => {
    chai.expect(getSsoConnectErrorMessage('multiple_sso_not_allowed')).to.contain('only connect one')
  })

  it('falls back to generic copy for a code it does not know, rather than showing it raw', () => {
    const message = getSsoConnectErrorMessage('something_new')
    chai.expect(message).to.equal('We could not connect your account to that provider. Please try again.')
    chai.expect(message).not.to.contain('something_new')
  })
})
