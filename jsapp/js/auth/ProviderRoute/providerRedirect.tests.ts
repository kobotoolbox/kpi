import chai from 'chai'
import { getProviderRedirectErrorMessage, readProviderRedirectError } from './providerRedirect'

describe('readProviderRedirectError', () => {
  it('reads the parameter allauth writes, which lands outside the fragment', () => {
    // `…/?error=denied#/accounts/provider/signup` - allauth parses the callback URL as a URL, so the
    // parameter goes in the real query string and the hash route sees no search at all.
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
