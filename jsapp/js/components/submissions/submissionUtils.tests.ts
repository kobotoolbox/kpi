import {
  getMediaAttachment,
  getSubmissionDisplayData,
  getSupplementalDetailsContent,
  removeEmptyFromSupplementalDetails,
  removeEmptyObjects,
} from './submissionUtils'
import {
  everythingSurveyAsset,
  everythingSurveyDisplayData,
  everythingSurveySubmission,
  groupsSurveyAsset,
  groupsSurveyDisplayData,
  groupsSurveySubmission,
  matrixRepeatSurveyAsset,
  matrixRepeatSurveyDisplayData,
  matrixRepeatSurveySubmission,
  matrixSurveyAsset,
  matrixSurveyDisplayData,
  matrixSurveySubmission,
  nestedRepeatSurveyAsset,
  nestedRepeatSurveyDisplayData,
  nestedRepeatSurveySubmission,
  repeatSurveyAsset,
  repeatSurveyDisplayData,
  repeatSurveySubmission,
  simpleSurveyAsset,
  simpleSurveyDisplayData,
  simpleSurveyDisplayDataEmpty,
  simpleSurveySubmission,
  simpleSurveySubmissionEmpty,
  submissionWithAttachmentsWithUnicode,
  submissionWithNestedSupplementalDetails,
  submissionWithSupplementalDetails,
} from './submissionUtils.mocks'

// getSubmissionDisplayData() returns objects that have prototype chains, while
// the simple mock objects do not. Be able to exclude __proto__ when comparing
// the two
import chai from 'chai'
import chaiExclude from 'chai-exclude'
chai.use(chaiExclude)

// getSubmissionDisplayData might return objects with declared, undefined key:
//    {... "label": "hi", "listName": undefined, "name": "hi" ...}
// Assuming this is correct, test fixtures like this are equivalent enough:
//    {... "label": "hi", "name": "hi" ...}
// After a recent chai / deep-eql update, tests relying on this behavior would
// fail. Hence, use this looser comparison function.
import chaiDeepEqualIgnoreUndefined from 'chai-deep-equal-ignore-undefined'
import type { SubmissionSupplementalDetails } from '#/dataInterface'
chai.use(chaiDeepEqualIgnoreUndefined)

describe('getSubmissionDisplayData', () => {
  it('should return a valid data for a survey with a group', () => {
    const test = getSubmissionDisplayData(simpleSurveyAsset, 1, simpleSurveySubmission)
    const target = simpleSurveyDisplayData
    chai.expect(test).excludingEvery(['__proto__']).to.deepEqualIgnoreUndefined(target)
  })

  it('should return a null data entries for a survey with no answers', () => {
    const test = getSubmissionDisplayData(simpleSurveyAsset, 0, simpleSurveySubmissionEmpty)
    const target = simpleSurveyDisplayDataEmpty
    chai.expect(test).excludingEvery(['__proto__']).to.deepEqualIgnoreUndefined(target)
  })

  it('should return a valid data for a survey with a repeat group', () => {
    const test = getSubmissionDisplayData(repeatSurveyAsset, 0, repeatSurveySubmission)
    const target = repeatSurveyDisplayData
    chai.expect(test).excludingEvery(['__proto__']).to.deepEqualIgnoreUndefined(target)
  })

  it('should return a valid data for a survey with nested repeat groups', () => {
    const test = getSubmissionDisplayData(nestedRepeatSurveyAsset, 0, nestedRepeatSurveySubmission)
    const target = nestedRepeatSurveyDisplayData
    chai.expect(test).excludingEvery(['__proto__']).to.deepEqualIgnoreUndefined(target)
  })

  it('should return a valid data for a survey with a matrix', () => {
    const test = getSubmissionDisplayData(matrixSurveyAsset, 0, matrixSurveySubmission)
    const target = matrixSurveyDisplayData
    chai.expect(test).excludingEvery(['__proto__']).to.deepEqualIgnoreUndefined(target)
  })

  it('should return a valid data for a survey with all kinds of groups', () => {
    const test = getSubmissionDisplayData(groupsSurveyAsset, 0, groupsSurveySubmission)
    const target = groupsSurveyDisplayData
    chai.expect(test).excludingEvery(['__proto__']).to.deepEqualIgnoreUndefined(target)
  })

  it('should return a valid data for every possible question type', () => {
    const test = getSubmissionDisplayData(everythingSurveyAsset, 0, everythingSurveySubmission)
    const target = everythingSurveyDisplayData
    chai.expect(test).excludingEvery(['__proto__']).to.deepEqualIgnoreUndefined(target)
  })

  it('should return a valid data for a matrix group inside repeat group', () => {
    const test = getSubmissionDisplayData(matrixRepeatSurveyAsset, 0, matrixRepeatSurveySubmission)
    const target = matrixRepeatSurveyDisplayData
    chai.expect(test).excludingEvery(['__proto__']).to.deepEqualIgnoreUndefined(target)
  })
})

describe('getMediaAttachment', () => {
  it('should return an attachment object', () => {
    const test = getMediaAttachment(
      submissionWithAttachmentsWithUnicode,
      'kobo/attachments/45748fd461814880bd9545c8c8827d78/4cfa16e8-f29b-41a9-984c-2bf7fe05064b/Un_ete_au_Quebec_Canada-19_41_32.jpg',
      'A_picture',
    )
    const target = submissionWithAttachmentsWithUnicode._attachments[0]
    chai.expect(test).to.deep.equal(target)
  })
})

describe('getSupplementalDetailsContent', () => {
  it('should return transcript value properly', () => {
    const test = getSupplementalDetailsContent(
      submissionWithSupplementalDetails,
      '_supplementalDetails/Secret_password_as_an_audio_file/transcript_fr',
    )
    chai.expect(test).to.equal('This is french transcript text.')
  })

  it('should return translation value properly', () => {
    const test = getSupplementalDetailsContent(
      submissionWithSupplementalDetails,
      '_supplementalDetails/Secret_password_as_an_audio_file/translation_pl',
    )
    chai.expect(test).to.equal('This is polish translation text.')
  })

  it('should return translation value properly for a question inside a group', () => {
    const test = getSupplementalDetailsContent(
      submissionWithNestedSupplementalDetails,
      '_supplementalDetails/level_a/level_b/level_c/sounds/translation_fr',
    )
    chai.expect(test).to.equal('Comment vas-tu mon cher ami?')
  })

  it('should return analysis question value properly for qual_select_multiple', () => {
    const test = getSupplementalDetailsContent(
      submissionWithSupplementalDetails,
      '_supplementalDetails/Secret_password_as_an_audio_file/1a89e0da-3344-4b5d-b919-ab8b072e0918',
    )
    chai.expect(test).to.equal('First, Third')
  })

  it('should return analysis question value properly for qual_tags', () => {
    const test = getSupplementalDetailsContent(
      submissionWithSupplementalDetails,
      '_supplementalDetails/Secret_password_as_an_audio_file/b05f29f7-8b58-4dd7-8695-c29cb04f3f7a',
    )
    chai.expect(test).to.equal('best, things, ever recorder by human, 3')
  })

  it('should return analysis question value properly for qual_integer', () => {
    const test = getSupplementalDetailsContent(
      submissionWithSupplementalDetails,
      '_supplementalDetails/Secret_password_as_an_audio_file/97fd5387-ac2b-4108-b5b4-37fa91ae0e22',
    )
    chai.expect(test).to.equal('12345')
  })
})

describe('removeEmptyObjects', () => {
  it('should remove empty objects from a flat object', () => {
    const input = { a: 1, b: {}, c: 'foo' }
    const expected = { a: 1, c: 'foo' }
    chai.expect(removeEmptyObjects(input)).to.eql(expected)
  })

  it('should remove nested empty objects', () => {
    const input = { a: { b: {}, c: { d: {} } }, e: 2038 }
    const expected = { e: 2038 }
    chai.expect(removeEmptyObjects(input)).to.eql(expected)
  })

  it('should handle deeply nested objects with mixed content', () => {
    const input = {
      a: { b: { c: {}, d: 1 }, e: {} },
      f: { g: { h: {}, i: 2 } },
      j: {},
    }
    const expected = {
      a: { b: { d: 1 } },
      f: { g: { i: 2 } },
    }
    chai.expect(removeEmptyObjects(input)).to.eql(expected)
  })

  it('should not modify objects with no empty objects', () => {
    const input = { a: 1, b: { c: 2 }, d: 'test' }
    const expected = { a: 1, b: { c: 2 }, d: 'test' }
    chai.expect(removeEmptyObjects(input)).to.eql(expected)
  })

  it('should handle empty arrays inside objects by removing them', () => {
    const input = { a: [], b: { c: [1, 2, 3] }, d: {} }
    const expected = { b: { c: [1, 2, 3] } }
    chai.expect(removeEmptyObjects(input)).to.eql(expected)
  })

  it('should handle nested empty arrays', () => {
    const input = { a: [], b: {}, c: { d: [] } }
    const expected = {}
    chai.expect(removeEmptyObjects(input)).to.eql(expected)
  })

  it('should handle empty objects inside arrays', () => {
    const input = { a: [{}], b: [{}, {}], c: { d: [{ e: [] }] } }
    const expected = {}
    chai.expect(removeEmptyObjects(input)).to.eql(expected)
  })
})

describe('removeEmptyFromSupplementalDetails', () => {
  it('should remove empty strings and deleted qual responses', () => {
    const supplementalDetails: SubmissionSupplementalDetails = {
      How_much_can_you_handle: {
        qual: [
          {
            val: '',
            type: 'qual_text',
            uuid: '',
            labels: { _default: 'foo' },
            xpath: '',
          },
          {
            val: 'foo',
            type: 'qual_text',
            uuid: '',
            labels: { _default: 'foo' },
            xpath: '',
          },
          {
            val: 'bar',
            options: { deleted: true },
            type: 'qual_text',
            uuid: '',
            labels: { _default: 'foo' },
            xpath: '',
          },
        ],
      },
    }

    const result = removeEmptyFromSupplementalDetails(supplementalDetails)

    chai.expect(result).to.eql({
      How_much_can_you_handle: {
        qual: [
          {
            val: 'foo',
            type: 'qual_text',
            uuid: '',
            labels: { _default: 'foo' },
            xpath: '',
          },
        ],
      },
    })
  })

  it('should remove qual array if all responses are removed', () => {
    const supplementalDetails: SubmissionSupplementalDetails = {
      How_much_can_you_handle: {
        qual: [
          {
            val: '',
            type: 'qual_text',
            labels: { _default: 'foo' },
            uuid: '',
            xpath: '',
          },
          {
            val: 'bar',
            options: { deleted: true },
            type: 'qual_text',
            labels: { _default: 'foo' },
            uuid: '',
            xpath: '',
          },
        ],
      },
    }

    const result = removeEmptyFromSupplementalDetails(supplementalDetails)

    chai.expect(result).to.eql({})
  })

  it('should remove nested empty objects', () => {
    const supplementalDetails: SubmissionSupplementalDetails = {
      How_much_can_you_handle: {
        qual: [],
      },
      question2: {},
    }

    const result = removeEmptyFromSupplementalDetails(supplementalDetails)

    chai.expect(result).to.eql({})
  })

  it('should handle already clean supplemental details', () => {
    const supplementalDetails: SubmissionSupplementalDetails = {
      How_much_can_you_handle: {
        qual: [
          {
            val: 'foo',
            type: 'qual_text',
            labels: { _default: 'foo' },
            uuid: '',
            xpath: '',
          },
        ],
      },
    }

    const result = removeEmptyFromSupplementalDetails(supplementalDetails)

    chai.expect(result).to.eql(supplementalDetails)
  })

  it('should handle multiple kinds of empty responses', () => {
    const supplementalDetails: SubmissionSupplementalDetails = {
      How_much_can_you_handle: {
        qual: [
          {
            val: '',
            type: 'qual_text',
            labels: { _default: 'foo' },
            uuid: '',
            xpath: '',
          },
          {
            val: [],
            type: 'qual_text',
            labels: { _default: 'foo' },
            uuid: '',
            xpath: '',
          },
          {
            val: null,
            type: 'qual_text',
            labels: { _default: 'foo' },
            uuid: '',
            xpath: '',
          },
          {
            val: 'foo',
            options: { deleted: true },
            type: 'qual_text',
            labels: { _default: 'foo' },
            uuid: '',
            xpath: '',
          },
          {
            val: 'bar',
            type: 'qual_text',
            labels: { _default: 'foo' },
            uuid: '',
            xpath: '',
          },
        ],
      },
    }

    const result = removeEmptyFromSupplementalDetails(supplementalDetails)

    chai.expect(result).to.eql({
      How_much_can_you_handle: {
        qual: [
          {
            val: 'bar',
            type: 'qual_text',
            labels: { _default: 'foo' },
            uuid: '',
            xpath: '',
          },
        ],
      },
    })
  })

  it('should handle empty input', () => {
    const supplementalDetails: SubmissionSupplementalDetails = {}

    const result = removeEmptyFromSupplementalDetails(supplementalDetails)

    chai.expect(result).to.eql({})
  })
})
