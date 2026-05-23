import chai from 'chai'

import { buildSupplementalPath, getSupplementalPathParts, type SupplementalPathParts } from './processingUtils'

describe('getSupplementalPathParts', () => {
  it('should return proper path parts for transcript', () => {
    const path = '_supplementalDetails/your_name/transcript_de'
    const test = getSupplementalPathParts(path)
    chai.expect(test).to.deep.equal({
      sourceRowName: 'your_name',
      sourceRowPath: 'your_name',
      type: 'transcript',
      languageCode: 'de',
    })
  })

  it('should return proper path parts for translation', () => {
    const path = '_supplementalDetails/your_name/translation_pl'
    const test = getSupplementalPathParts(path)
    chai.expect(test).to.deep.equal({
      sourceRowName: 'your_name',
      sourceRowPath: 'your_name',
      type: 'translation',
      languageCode: 'pl',
    })
  })

  it('should return proper path parts for translation of a nested question', () => {
    const path = '_supplementalDetails/outer_group/middle_group/inner_group/What_did_you_hear/transcript_fr'
    const test = getSupplementalPathParts(path)
    chai.expect(test).to.deep.equal({
      sourceRowName: 'What_did_you_hear',
      sourceRowPath: 'outer_group/middle_group/inner_group/What_did_you_hear',
      type: 'transcript',
      languageCode: 'fr',
    })
  })

  it('should return proper path parts for analysis question', () => {
    const path = '_supplementalDetails/your_name/a1234567-a123-123a-12a3-123aaaa45678'
    const test = getSupplementalPathParts(path)
    chai.expect(test).to.deep.equal({
      sourceRowName: 'your_name',
      sourceRowPath: 'your_name',
      type: 'qual',
      analysisQuestionUuid: 'a1234567-a123-123a-12a3-123aaaa45678',
    })
  })

  it('should return proper path parts for analysis question verification', () => {
    const path = '_supplementalDetails/your_name/a1234567-a123-123a-12a3-123aaaa45678/verified'
    const test = getSupplementalPathParts(path)
    chai.expect(test).to.deep.equal({
      sourceRowName: 'your_name',
      sourceRowPath: 'your_name',
      type: 'qualVerification',
      analysisQuestionUuid: 'a1234567-a123-123a-12a3-123aaaa45678',
    })
  })

  it('should return proper path parts for analysis question verification of a nested question', () => {
    const path =
      '_supplementalDetails/outer_group/middle_group/inner_group/What_did_you_hear/a1234567-a123-123a-12a3-123aaaa45678/verified'
    const test = getSupplementalPathParts(path)
    chai.expect(test).to.deep.equal({
      sourceRowName: 'What_did_you_hear',
      sourceRowPath: 'outer_group/middle_group/inner_group/What_did_you_hear',
      type: 'qualVerification',
      analysisQuestionUuid: 'a1234567-a123-123a-12a3-123aaaa45678',
    })
  })

  it('should return proper path parts for analysis question of a nested question', () => {
    const path =
      '_supplementalDetails/outer_group/middle_group/inner_group/What_did_you_hear/a1234567-a123-123a-12a3-123aaaa45678'
    const test = getSupplementalPathParts(path)
    chai.expect(test).to.deep.equal({
      sourceRowName: 'What_did_you_hear',
      sourceRowPath: 'outer_group/middle_group/inner_group/What_did_you_hear',
      type: 'qual',
      analysisQuestionUuid: 'a1234567-a123-123a-12a3-123aaaa45678',
    })
  })

  it('should return null type for unrecognized (as supplemental) path', () => {
    const path = 'outer_group/middle_group/inner_group/What_did_you_hear'
    const test = getSupplementalPathParts(path)
    chai.expect(test).to.deep.equal({
      sourceRowName: 'outer_group/middle_group/inner_group/What_did_you_hear',
      sourceRowPath: 'outer_group/middle_group/inner_group/What_did_you_hear',
      type: null,
    })
  })

  describe('buildSupplementalPath', () => {
    it('should build path for transcript', () => {
      const path = buildSupplementalPath({
        sourceRowPath: 'your_name',
        type: 'transcript',
        languageCode: 'de',
        sourceRowName: 'your_name',
      })
      chai.expect(path).to.equal('_supplementalDetails/your_name/transcript_de')
    })

    it('should build path for translation', () => {
      const path = buildSupplementalPath({
        sourceRowPath: 'your_name',
        type: 'translation',
        languageCode: 'pl',
        sourceRowName: 'your_name',
      })
      chai.expect(path).to.equal('_supplementalDetails/your_name/translation_pl')
    })

    it('should build path for transcript of a nested question', () => {
      const path = buildSupplementalPath({
        sourceRowPath: 'outer_group/middle_group/inner_group/What_did_you_hear',
        type: 'transcript',
        languageCode: 'fr',
        sourceRowName: 'What_did_you_hear',
      })
      chai
        .expect(path)
        .to.equal('_supplementalDetails/outer_group/middle_group/inner_group/What_did_you_hear/transcript_fr')
    })

    it('should round-trip with getSupplementalPathParts for transcript', () => {
      const input: SupplementalPathParts = {
        sourceRowPath: 'foo/bar',
        type: 'transcript',
        languageCode: 'en',
        sourceRowName: 'bar',
      }
      const path = buildSupplementalPath(input)
      const parsed = getSupplementalPathParts(path)
      chai.expect(parsed).to.include({
        sourceRowPath: 'foo/bar',
        type: 'transcript',
        languageCode: 'en',
      })
    })

    it('should round-trip with getSupplementalPathParts for translation', () => {
      const input: SupplementalPathParts = {
        sourceRowPath: 'foo/bar',
        type: 'translation',
        languageCode: 'es',
        sourceRowName: 'bar',
      }
      const path = buildSupplementalPath(input)
      const parsed = getSupplementalPathParts(path)
      chai.expect(parsed).to.include({
        sourceRowPath: 'foo/bar',
        type: 'translation',
        languageCode: 'es',
      })
    })
  })
})
