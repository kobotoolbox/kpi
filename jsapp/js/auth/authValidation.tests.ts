import chai from 'chai'
import { validateRequiredField } from './authValidation'

describe('validateRequiredField', () => {
  it('accepts any value with something in it', () => {
    chai.expect(validateRequiredField('kobo_user')).to.equal(null)
  })

  it('rejects an empty value, and one that is only whitespace', () => {
    chai.expect(validateRequiredField('')).to.equal('Required field')
    chai.expect(validateRequiredField(' \t ')).to.equal('Required field')
  })
})
