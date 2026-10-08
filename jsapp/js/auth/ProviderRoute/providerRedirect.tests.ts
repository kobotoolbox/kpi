import chai from 'chai'
import { getProviderCallbackUrl, getProviderRedirectErrorMessage, readProviderRedirectError } from './providerRedirect'

/** What `ROOT_URL` looks like on an instance behind `KPI_PREFIX`, which is the case worth pinning down. */
const PREFIXED_ROOT = 'https://kf.example.org/kpi'
const NEXT_ENCODED = '%2F%23%2Fprojects%2Fhome'

describe('getProviderCallbackUrl', () => {
  it('keeps the deployment prefix, which the bare origin would drop', () => {
    chai
      .expect(getProviderCallbackUrl('', '', PREFIXED_ROOT))
      .to.equal('https://kf.example.org/kpi/#/auth/provider/signup')
  })

  it('carries the destination Django asked for, which lands outside the fragment', () => {
    chai
      .expect(getProviderCallbackUrl(`?next=${NEXT_ENCODED}`, '', PREFIXED_ROOT))
      .to.equal(`https://kf.example.org/kpi/#/auth/provider/signup?next=${NEXT_ENCODED}`)
  })

  it('carries the destination from the hash route as well', () => {
    chai
      .expect(getProviderCallbackUrl('', `?next=${NEXT_ENCODED}`, PREFIXED_ROOT))
      .to.equal(`https://kf.example.org/kpi/#/auth/provider/signup?next=${NEXT_ENCODED}`)
  })

  it('ignores anything else in the URL, `?error=` from an earlier attempt included', () => {
    chai
      .expect(getProviderCallbackUrl('?error=denied', '?process=login', PREFIXED_ROOT))
      .to.equal('https://kf.example.org/kpi/#/auth/provider/signup')
  })
})

describe('readProviderRedirectError', () => {
  it('reads the parameter allauth writes, which lands outside the fragment', () => {
    // `…/?error=denied#/auth/provider/signup`, so the hash route sees no search at all.
    chai.expect(readProviderRedirectError('?error=denied', '')).to.equal('denied')
  })

  it('reads the parameter from the hash route as well', () => {
    chai.expect(readProviderRedirectError('', '?error=cancelled')).to.equal('cancelled')
  })

  it('prefers the real query string, which is where allauth actually writes', () => {
    chai.expect(readProviderRedirectError('?error=denied', '?error=cancelled')).to.equal('denied')
  })

  it('ignores other parameters, including the one allauth sends alongside', () => {
    chai.expect(readProviderRedirectError('?error_process=login', '?next=%2Fprojects')).to.equal(null)
  })

  it('is null when neither place has one, which is the successful handshake', () => {
    chai.expect(readProviderRedirectError('', '')).to.equal(null)
  })
})

describe('getProviderRedirectErrorMessage', () => {
  it('has its own wording for the codes allauth documents', () => {
    const cancelled = getProviderRedirectErrorMessage('cancelled')
    const denied = getProviderRedirectErrorMessage('denied')

    chai.expect(cancelled).to.equal('The login was cancelled before it finished. You can try again.')
    chai
      .expect(denied)
      .to.equal('Your login provider refused the request. Please contact your administrator if this continues.')
  })

  it('falls back to the generic wording rather than showing an unknown code raw', () => {
    const generic = 'We could not complete the login with your provider. Please try again.'

    chai.expect(getProviderRedirectErrorMessage('unknown')).to.equal(generic)
    // A code allauth grew since this was written, or one from a provider specific error path.
    chai.expect(getProviderRedirectErrorMessage('some_new_allauth_code')).to.equal(generic)
  })
})
