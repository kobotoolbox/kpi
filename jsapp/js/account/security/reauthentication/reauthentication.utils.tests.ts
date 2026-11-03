import chai from 'chai'
import { ServerError } from '#/api/ServerError'
import { getReauthenticationAsk } from './reauthentication.utils'

function makeServerError(status: number, body: unknown) {
  return new ServerError({ status, statusText: '' } as Response, undefined, body)
}

/** KPI's 403, as `kobo/apps/accounts/reauthentication.py` sends it */
const refusal = (flows: unknown) =>
  makeServerError(403, {
    detail: 'Re-authentication is required for this action.',
    code: 'reauthentication_required',
    flows,
  })

describe('getReauthenticationAsk', () => {
  it('asks for the password alone', () => {
    chai.expect(getReauthenticationAsk(refusal([{ id: 'reauthenticate' }]))).to.deep.equal({
      isPasswordNeeded: true,
      isCodeNeeded: false,
      isAnswerable: true,
    })
  })

  it('asks for both when 2FA is on, since KPI wants every listed step', () => {
    const flows = [{ id: 'reauthenticate' }, { id: 'mfa_reauthenticate', types: ['recovery_codes', 'totp'] }]
    chai.expect(getReauthenticationAsk(refusal(flows))).to.deep.equal({
      isPasswordNeeded: true,
      isCodeNeeded: true,
      isAnswerable: true,
    })
  })

  it('asks SSO-only accounts for a code alone', () => {
    chai.expect(getReauthenticationAsk(refusal([{ id: 'mfa_reauthenticate', types: ['totp'] }]))).to.deep.equal({
      isPasswordNeeded: false,
      isCodeNeeded: true,
      isAnswerable: true,
    })
  })

  it('gives up on a step that cannot be typed in', () => {
    const flows = [{ id: 'reauthenticate' }, { id: 'mfa_reauthenticate', types: ['webauthn'] }]
    chai.expect(getReauthenticationAsk(refusal(flows))?.isAnswerable).to.equal(false)
  })

  it('gives up when no step is named', () => {
    chai.expect(getReauthenticationAsk(refusal([]))?.isAnswerable).to.equal(false)
    chai.expect(getReauthenticationAsk(refusal(undefined))?.isAnswerable).to.equal(false)
  })

  it('ignores other errors', () => {
    chai.expect(getReauthenticationAsk(makeServerError(403, { detail: 'You do not have permission.' }))).to.equal(null)
    chai
      .expect(getReauthenticationAsk(makeServerError(400, { email: ['Enter a valid email address.'] })))
      .to.equal(null)
    chai.expect(getReauthenticationAsk(makeServerError(403, '<html>Forbidden</html>'))).to.equal(null)
    chai.expect(getReauthenticationAsk(new TypeError('Failed to fetch'))).to.equal(null)
  })
})
