import chai from 'chai'
import { maskEmail } from './maskEmail'

describe('maskEmail', () => {
  it('keeps the first character and the domain', () => {
    chai.expect(maskEmail('kobo.person@gmail.com')).to.equal('k******@gmail.com')
  })

  it('masks a one character local part to the same width as any other', () => {
    // The whole point of a fixed run of asterisks: the mask must not hint at the real length.
    chai.expect(maskEmail('t@gmail.com')).to.equal('t******@gmail.com')
  })

  it('splits on the last @, which is the one separating the domain', () => {
    chai.expect(maskEmail('"odd@local"@example.org')).to.equal('"******@example.org')
  })

  it('masks a value with no domain at all', () => {
    chai.expect(maskEmail('kobo.person')).to.equal('k******')
  })

  it('leaves a value with nothing to mask alone', () => {
    chai.expect(maskEmail('')).to.equal('')
    chai.expect(maskEmail('@example.org')).to.equal('@example.org')
  })
})
