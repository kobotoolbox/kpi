import chai from 'chai'
import { ServerError } from '#/api/ServerError'
import { isPendingEmailVerification, isVerifiedWithoutSession, splitAllauthErrors } from './allauthErrors'

/** Mirrors what `ServerError.new()` builds from a response body. */
function makeServerError(status: number, body: unknown) {
  const response = { status, statusText: '' } as Response
  return new ServerError(response, undefined, body)
}

const FORM_FIELDS = ['name', 'email', 'username', 'password', 'passwordConfirm'] as const

describe('splitAllauthErrors', () => {
  it('puts an error with a known `param` under that field', () => {
    const { fieldErrors, formErrors } = splitAllauthErrors(
      makeServerError(400, {
        status: 400,
        errors: [{ code: 'username_taken', param: 'username', message: 'A user with that username already exists.' }],
      }),
      FORM_FIELDS,
    )

    chai.expect(fieldErrors).to.deep.equal({ username: 'A user with that username already exists.' })
    chai.expect(formErrors).to.deep.equal([])
  })

  it('sends an error with no `param` to the banner', () => {
    const { fieldErrors, formErrors } = splitAllauthErrors(
      makeServerError(400, { status: 400, errors: [{ code: 'invalid', message: 'Please try again later.' }] }),
      FORM_FIELDS,
    )

    chai.expect(fieldErrors).to.deep.equal({})
    chai.expect(formErrors).to.deep.equal(['Please try again later.'])
  })

  it('sends an error naming a field we do not render to the banner', () => {
    const { fieldErrors, formErrors } = splitAllauthErrors(
      makeServerError(400, {
        status: 400,
        errors: [{ code: 'password_mismatch', param: 'password2', message: 'Passwords do not match.' }],
      }),
      FORM_FIELDS,
    )

    chai.expect(fieldErrors).to.deep.equal({})
    chai.expect(formErrors).to.deep.equal(['Passwords do not match.'])
  })

  it('keeps the first error per field and banners the rest', () => {
    const { fieldErrors, formErrors } = splitAllauthErrors(
      makeServerError(400, {
        status: 400,
        errors: [
          { code: 'too_short', param: 'password', message: 'Too short.' },
          { code: 'too_common', param: 'password', message: 'Too common.' },
        ],
      }),
      FORM_FIELDS,
    )

    chai.expect(fieldErrors).to.deep.equal({ password: 'Too short.' })
    chai.expect(formErrors).to.deep.equal(['Too common.'])
  })

  it('supplies copy for a 403, which allauth answers without any message', () => {
    const { fieldErrors, formErrors } = splitAllauthErrors(makeServerError(403, { status: 403 }), FORM_FIELDS)

    chai.expect(fieldErrors).to.deep.equal({})
    chai.expect(formErrors).to.deep.equal(['Account registration is not available on this server.'])
  })

  it('supplies copy for a 409, which allauth answers without any message', () => {
    const { formErrors } = splitAllauthErrors(makeServerError(409, { status: 409 }), FORM_FIELDS)

    chai
      .expect(formErrors)
      .to.deep.equal(['You are already logged in. Please log out before creating another account.'])
  })

  it('falls back to a generic message for a non-allauth failure', () => {
    // A network error never reaches us as a `ServerError` at all.
    const { formErrors } = splitAllauthErrors(new TypeError('Failed to fetch'), FORM_FIELDS)

    chai.expect(formErrors).to.deep.equal(['Something went wrong. Please try again later.'])
  })

  it('ignores malformed entries in `errors`', () => {
    const { fieldErrors, formErrors } = splitAllauthErrors(
      makeServerError(400, { status: 400, errors: [{ code: 'invalid' }, null] }),
      FORM_FIELDS,
    )

    chai.expect(fieldErrors).to.deep.equal({})
    chai.expect(formErrors).to.deep.equal(['Something went wrong. Please try again later.'])
  })
})

describe('isPendingEmailVerification', () => {
  it('recognises the 401 a successful signup answers with', () => {
    const error = makeServerError(401, {
      status: 401,
      data: { flows: [{ id: 'login' }, { id: 'verify_email', is_pending: true }] },
      meta: { is_authenticated: false },
    })

    chai.expect(isPendingEmailVerification(error)).to.equal(true)
  })

  it('rejects a 401 whose `verify_email` flow is merely offered, not pending', () => {
    const error = makeServerError(401, { status: 401, data: { flows: [{ id: 'verify_email' }] } })

    chai.expect(isPendingEmailVerification(error)).to.equal(false)
  })

  it('rejects a 400', () => {
    const error = makeServerError(400, { status: 400, errors: [{ code: 'invalid', message: 'Nope.' }] })

    chai.expect(isPendingEmailVerification(error)).to.equal(false)
  })

  it('rejects anything that is not a `ServerError`', () => {
    chai.expect(isPendingEmailVerification(new TypeError('Failed to fetch'))).to.equal(false)
  })
})

describe('isVerifiedWithoutSession', () => {
  it('recognises the 401 a verification answers with when it does not sign the account in', () => {
    const error = makeServerError(401, { status: 401, data: { flows: [{ id: 'login' }] } })

    chai.expect(isVerifiedWithoutSession(error)).to.equal(true)
  })

  it('rejects the 400 an expired key answers with', () => {
    const error = makeServerError(400, {
      status: 400,
      errors: [{ code: 'invalid', message: 'Invalid or expired key.' }],
    })

    chai.expect(isVerifiedWithoutSession(error)).to.equal(false)
  })

  it('rejects anything that is not a `ServerError`', () => {
    chai.expect(isVerifiedWithoutSession(new TypeError('Failed to fetch'))).to.equal(false)
  })
})
