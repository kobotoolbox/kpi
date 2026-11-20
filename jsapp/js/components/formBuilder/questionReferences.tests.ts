import chai from 'chai'
import { hasQuestionReference, renameQuestionReferences } from './questionReferences'

describe('renameQuestionReferences', () => {
  it('renames every reference to a renamed question', () => {
    const renamed = renameQuestionReferences("${gender} = 'x' or ${age} > ${gender}", {
      gender: 'gender_001',
      age: 'age_001',
    })
    chai.expect(renamed).to.equal("${gender_001} = 'x' or ${age_001} > ${gender_001}")
  })

  it('leaves other references and plain text alone', () => {
    const renamed = renameQuestionReferences('${household} + gender', { gender: 'gender_001' })
    chai.expect(renamed).to.equal('${household} + gender')
  })

  it('swaps names in one go, so a new name is never renamed again', () => {
    const renamed = renameQuestionReferences('${a} ${a_001}', { a: 'a_001', a_001: 'a_002' })
    chai.expect(renamed).to.equal('${a_001} ${a_002}')
  })

  it('renames last-saved references too', () => {
    const renamed = renameQuestionReferences('${last-saved#gender}', { gender: 'gender_001' })
    chai.expect(renamed).to.equal('${last-saved#gender_001}')
  })

  it('ignores names inherited from Object', () => {
    chai.expect(renameQuestionReferences('${constructor}', {})).to.equal('${constructor}')
  })
})

describe('hasQuestionReference', () => {
  it('finds plain and last-saved references', () => {
    chai.expect(hasQuestionReference("${gender} = 'x'", 'gender')).to.equal(true)
    chai.expect(hasQuestionReference('${last-saved#gender}', 'gender')).to.equal(true)
  })

  it('needs an exact name match', () => {
    chai.expect(hasQuestionReference('${gender_001} + gender', 'gender')).to.equal(false)
  })
})
