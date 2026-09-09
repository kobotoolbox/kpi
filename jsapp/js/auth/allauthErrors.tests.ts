import chai from 'chai'
import { isPendingEmailVerification, splitAllauthErrors } from './allauthErrors'

/** Mirrors what `fetchAllauth` hands to react-query: the parsed body, plus the status it came with. */
function allauthResponse(status: number, data: unknown) {
  return { status, data }
}

const FORM_FIELDS = ['name', 'email', 'username', 'password', 'passwordConfirm'] as const

describe('splitAllauthErrors', () => {
  it('puts an error with a known `param` under that field', () => {
    const { fieldErrors, formErrors } = splitAllauthErrors(
      allauthResponse(400, {
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
      allauthResponse(400, { status: 400, errors: [{ code: 'invalid', message: 'Please try again later.' }] }),
      FORM_FIELDS,
    )

    chai.expect(fieldErrors).to.deep.equal({})
    chai.expect(formErrors).to.deep.equal(['Please try again later.'])
  })

  it('sends an error naming a field we do not render to the banner', () => {
    const { fieldErrors, formErrors } = splitAllauthErrors(
      allauthResponse(400, {
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
      allauthResponse(400, {
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
    const { fieldErrors, formErrors } = splitAllauthErrors(allauthResponse(403, { status: 403 }), FORM_FIELDS)

    chai.expect(fieldErrors).to.deep.equal({})
    chai.expect(formErrors).to.deep.equal(['Account registration is not available on this server.'])
  })

  it('supplies copy for a 409, which allauth answers without any message', () => {
    const { formErrors } = splitAllauthErrors(allauthResponse(409, { status: 409 }), FORM_FIELDS)

    chai
      .expect(formErrors)
      .to.deep.equal(['You are already logged in. Please log out before creating another account.'])
  })

  it('falls back to a generic message when the body carries no errors', () => {
    // What a 204 or a non-JSON answer leaves behind: the mutator returns `{}` for the body.
    const { formErrors } = splitAllauthErrors(allauthResponse(400, {}), FORM_FIELDS)

    chai.expect(formErrors).to.deep.equal(['Something went wrong. Please try again later.'])
  })

  it('ignores malformed entries in `errors`', () => {
    const { fieldErrors, formErrors } = splitAllauthErrors(
      allauthResponse(400, { status: 400, errors: [{ code: 'invalid' }, null] }),
      FORM_FIELDS,
    )

    chai.expect(fieldErrors).to.deep.equal({})
    chai.expect(formErrors).to.deep.equal(['Something went wrong. Please try again later.'])
  })
})

describe('isPendingEmailVerification', () => {
  it('recognises the 401 a successful signup answers with', () => {
    const response = allauthResponse(401, {
      status: 401,
      data: { flows: [{ id: 'login' }, { id: 'verify_email', is_pending: true }] },
      meta: { is_authenticated: false },
    })

    chai.expect(isPendingEmailVerification(response)).to.equal(true)
  })

  it('rejects a 401 whose `verify_email` flow is merely offered, not pending', () => {
    const response = allauthResponse(401, { status: 401, data: { flows: [{ id: 'verify_email' }] } })

    chai.expect(isPendingEmailVerification(response)).to.equal(false)
  })

  it('rejects a 400', () => {
    const response = allauthResponse(400, { status: 400, errors: [{ code: 'invalid', message: 'Nope.' }] })

    chai.expect(isPendingEmailVerification(response)).to.equal(false)
  })

  it('rejects a 401 with nothing readable in it', () => {
    chai.expect(isPendingEmailVerification(allauthResponse(401, {}))).to.equal(false)
  })
})
