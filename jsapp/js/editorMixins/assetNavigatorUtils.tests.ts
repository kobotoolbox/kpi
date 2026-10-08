import { formatTagValue } from './assetNavigatorUtils'

// Every test here must match Backend's query parser logic
describe('formatTagValue', () => {
  it('quotes an ordinary tag name', () => {
    chai.expect(formatTagValue('health')).to.equal('"health"')
  })

  it('double-quotes a name holding an apostrophe', () => {
    chai.expect(formatTagValue("o'brien")).to.equal('"o\'brien"')
  })

  it('single-quotes a name holding a double quote', () => {
    chai.expect(formatTagValue('say "hi"')).to.equal('\'say "hi"\'')
  })

  it('drops the quotes for a name holding both', () => {
    chai.expect(formatTagValue('a"b\'c')).to.equal('a"b\'c')
  })

  it('quotes names holding characters that would end a bare value', () => {
    chai.expect(formatTagValue('has(paren)')).to.equal('"has(paren)"')
    chai.expect(formatTagValue('has:colon')).to.equal('"has:colon"')
    chai.expect(formatTagValue('has space')).to.equal('"has space"')
  })

  it('gives up on a name that rules out every form, rather than breaking the query', () => {
    // Both quote characters, so it can't be quoted, plus something that ends a bare value
    chai.expect(formatTagValue('a"b\'c(d)')).to.equal('""')
    chai.expect(formatTagValue('a"b\'c:d')).to.equal('""')
    // A leading quote would open a quoted value and swallow the query up to the next one
    chai.expect(formatTagValue('"a\'b')).to.equal('""')
  })
})
