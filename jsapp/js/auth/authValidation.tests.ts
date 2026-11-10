import chai from 'chai'
import { validateEmailFormat, validatePassword, validatePasswordConfirm, validateRequiredField } from './authValidation'

describe('validateRequiredField', () => {
  it('accepts any value with something in it', () => {
    chai.expect(validateRequiredField('kobo_user')).to.equal(null)
  })

  it('rejects an empty value, and one that is only whitespace', () => {
    chai.expect(validateRequiredField('')).to.equal('Required field')
    chai.expect(validateRequiredField(' \t ')).to.equal('Required field')
  })
})

describe('validateEmailFormat', () => {
  it('accepts a dotted domain', () => {
    chai.expect(validateEmailFormat('someone@example.com')).to.equal(null)
  })

  it('accepts an address padded with whitespace, which the forms trim before posting', () => {
    chai.expect(validateEmailFormat('  someone@example.com  ')).to.equal(null)
  })

  it('rejects an empty value as a required field', () => {
    chai.expect(validateEmailFormat('   ')).to.equal('Required field')
  })

  it('rejects an address with no @, no dotted domain or inner whitespace', () => {
    const message = 'Please enter a valid email address'
    chai.expect(validateEmailFormat('someone')).to.equal(message)
    chai.expect(validateEmailFormat('someone@example')).to.equal(message)
    chai.expect(validateEmailFormat('some one@example.com')).to.equal(message)
  })
})

describe('validatePassword', () => {
  it('accepts anything at all, since the server owns the complexity rules', () => {
    chai.expect(validatePassword('a')).to.equal(null)
  })

  it('accepts a password of nothing but spaces, unwise as that is', () => {
    chai.expect(validatePassword('   ')).to.equal(null)
  })

  it('rejects an empty value as a required field', () => {
    chai.expect(validatePassword('')).to.equal('Required field')
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
