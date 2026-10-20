import chai from 'chai'
import { getLoginCredential, getLoginCredentialParam } from './loginCredential'

describe('getLoginCredential', () => {
  it('asks for a username when that is the only method, which is the allauth default', () => {
    chai.expect(getLoginCredential(['username'])).to.equal('username')
  })

  it('asks for an address when usernames are not accepted', () => {
    chai.expect(getLoginCredential(['email'])).to.equal('email')
  })

  it('asks for either when the server takes both', () => {
    chai.expect(getLoginCredential(['username', 'email'])).to.equal('usernameOrEmail')
    chai.expect(getLoginCredential(['email', 'username'])).to.equal('usernameOrEmail')
  })

  it('has nothing to ask for until the methods arrive', () => {
    chai.expect(getLoginCredential(undefined)).to.equal(null)
  })

  it('has nothing to ask for when no accepted method has a field here', () => {
    chai.expect(getLoginCredential([])).to.equal(null)
  })
})

describe('getLoginCredentialParam', () => {
  it('names the credential after the single method the server accepts', () => {
    chai.expect(getLoginCredentialParam('username')).to.equal('username')
    chai.expect(getLoginCredentialParam('email')).to.equal('email')
  })

  it('sends either kind as `username`, which allauth resolves by address first', () => {
    chai.expect(getLoginCredentialParam('usernameOrEmail')).to.equal('username')
  })
})
