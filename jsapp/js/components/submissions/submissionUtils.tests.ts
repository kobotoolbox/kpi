import assetDataFactory from '#/endpoints/assetData.factory'
import {
  getMediaAttachment,
  getRepeatGroupAnswers,
  getSubmissionDisplayData,
  getSupplementalDetailsContent,
  hasUnacceptedAutomaticContent,
  removeEmptyFromSupplementalDetails,
  removeEmptyObjects,
} from './submissionUtils'
import {
  allQualSurveyDisplayData,
  assetWithAllQual,
  assetWithNestedSupplementalDetails,
  assetWithSupplementalDetails,
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
  nestedSupplementalDetailsSurveyDisplayData,
  repeatSurveyAsset,
  repeatSurveyDisplayData,
  repeatSurveySubmission,
  simpleSurveyAsset,
  simpleSurveyDisplayData,
  simpleSurveyDisplayDataEmpty,
  simpleSurveySubmission,
  simpleSurveySubmissionEmpty,
  submissionWithAllQual,
  submissionWithAttachmentsWithUnicode,
  submissionWithNestedSupplementalDetails,
  submissionWithSupplementalDetails,
  supplementalDetailsSurveyDisplayData,
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
import type { SubmissionResponse, SubmissionSupplementalDetails } from '#/dataInterface'
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

  it('should return a valid data for a submission with supplemental details', () => {
    const test = getSubmissionDisplayData(assetWithSupplementalDetails, 0, submissionWithSupplementalDetails)
    const target = supplementalDetailsSurveyDisplayData
    chai.expect(test).excludingEvery(['__proto__']).to.deepEqualIgnoreUndefined(target)
  })

  it('should return a valid data for a submission with a nested supplemental details', () => {
    const test = getSubmissionDisplayData(
      assetWithNestedSupplementalDetails,
      0,
      submissionWithNestedSupplementalDetails,
    )
    const target = nestedSupplementalDetailsSurveyDisplayData
    chai.expect(test).excludingEvery(['__proto__']).to.deepEqualIgnoreUndefined(target)
  })

  it('should return a valid data for a project with all qualitative analysis questions', () => {
    const test = getSubmissionDisplayData(assetWithAllQual, 0, submissionWithAllQual)
    const target = allQualSurveyDisplayData
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

describe('getRepeatGroupAnswers', () => {
  it('should return values for a repeat group in root', () => {
    const rootRepeatSubmission = {
      _attachments: [],
      children: [
        {
          'children/name': 'Ada',
        },
        {
          'children/name': 'Grace',
        },
      ],
    } as unknown as SubmissionResponse

    const test = getRepeatGroupAnswers(rootRepeatSubmission, 'children/name')

    chai.expect(test).to.deep.equal(['Ada', 'Grace'])
  })

  it('should return values for a repeat group nested inside a regular group', () => {
    const groupedRepeatSubmission = {
      _attachments: [],
      family: {
        'family/children': [
          {
            'family/children/name': 'Ada',
          },
          {
            'family/children/name': 'Grace',
          },
        ],
      },
    } as unknown as SubmissionResponse

    const test = getRepeatGroupAnswers(groupedRepeatSubmission, 'family/children/name')

    chai.expect(test).to.deep.equal(['Ada', 'Grace'])
  })

  it('should return no values when repeat group does not exist in submission', () => {
    const submissionWithoutRepeat = {
      _attachments: [],
      other_group: {
        'other_group/name': 'Nope',
      },
    } as unknown as SubmissionResponse

    const test = getRepeatGroupAnswers(submissionWithoutRepeat, 'children/name')

    chai.expect(test).to.deep.equal([])
  })

  it('should skip unanswered iterations and keep answered values', () => {
    const partiallyAnsweredRepeatSubmission = {
      _attachments: [],
      children: [
        {
          'children/name': 'Ada',
        },
        {
          'children/age': '11',
        },
        {
          'children/name': 'Grace',
        },
      ],
    } as unknown as SubmissionResponse

    const test = getRepeatGroupAnswers(partiallyAnsweredRepeatSubmission, 'children/name')

    chai.expect(test).to.deep.equal(['Ada', 'Grace'])
  })

  it('should ignore invalid repeat items and return values from valid objects', () => {
    const mixedRepeatSubmission = {
      _attachments: [],
      children: [
        {
          'children/name': 'Ada',
        },
        null,
        'unexpected-string-item',
        {
          'children/name': 'Grace',
        },
      ],
    } as unknown as SubmissionResponse

    const test = getRepeatGroupAnswers(mixedRepeatSubmission, 'children/name')

    chai.expect(test).to.deep.equal(['Ada', 'Grace'])
  })

  it('should return values for a repeat group nested inside another repeat group', () => {
    const test = getRepeatGroupAnswers(nestedRepeatSurveySubmission, 'group_people/group_items/Item_name')

    chai.expect(test).to.deep.equal(['(Notebook, Pen, Shoe)', 'Computer'])
  })

  it('should return values for repeat inside regular group when repeat key is flat at root level', () => {
    const rootLevelGroupedRepeatSubmission = {
      _attachments: [],
      'regular_group/nested_repeat': [
        {
          'regular_group/nested_repeat/nested_text': 'c',
        },
        {
          'regular_group/nested_repeat/nested_text': 'd',
        },
      ],
    } as unknown as SubmissionResponse

    const test = getRepeatGroupAnswers(rootLevelGroupedRepeatSubmission, 'regular_group/nested_repeat/nested_text')

    chai.expect(test).to.deep.equal(['c', 'd'])
  })

  it('should group nested repeat answers by outer repeat iteration for readability', () => {
    const nestedRepeatForTableDisplay = {
      _attachments: [],
      outer_repeat: [
        {
          'outer_repeat/inner_repeat': [
            {
              'outer_repeat/inner_repeat/item_name': 'e',
            },
            {
              'outer_repeat/inner_repeat/item_name': 'f',
            },
          ],
        },
        {
          'outer_repeat/inner_repeat': [
            {
              'outer_repeat/inner_repeat/item_name': 'g',
            },
            {
              'outer_repeat/inner_repeat/item_name': 'h',
            },
          ],
        },
      ],
    } as unknown as SubmissionResponse

    const test = getRepeatGroupAnswers(nestedRepeatForTableDisplay, 'outer_repeat/inner_repeat/item_name')

    chai.expect(test).to.deep.equal(['(e, f)', '(g, h)'])
  })

  it('should return values from repeat groups nested 4 levels deep', () => {
    const fourLevelNestedRepeatSubmission = {
      _attachments: [],
      level1_repeat: [
        {
          'level1_repeat/level2_repeat': [
            {
              'level1_repeat/level2_repeat/level3_repeat': [
                {
                  'level1_repeat/level2_repeat/level3_repeat/level4_repeat': [
                    {
                      'level1_repeat/level2_repeat/level3_repeat/level4_repeat/deep_value': 'alpha',
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          'level1_repeat/level2_repeat': [
            {
              'level1_repeat/level2_repeat/level3_repeat': [
                {
                  'level1_repeat/level2_repeat/level3_repeat/level4_repeat': [
                    {
                      'level1_repeat/level2_repeat/level3_repeat/level4_repeat/deep_value': 'beta',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as SubmissionResponse

    const test = getRepeatGroupAnswers(
      fourLevelNestedRepeatSubmission,
      'level1_repeat/level2_repeat/level3_repeat/level4_repeat/deep_value',
    )

    chai.expect(test).to.deep.equal(['alpha', 'beta'])
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
      '_supplementalDetails/level_a/level_b/level_c/sound/translation_fr',
    )
    chai.expect(test).to.equal('Comment vas-tu mon cher ami?')
  })

  it('should return analysis question value properly for qualSelectMultiple', () => {
    const test = getSupplementalDetailsContent(
      submissionWithSupplementalDetails,
      '_supplementalDetails/Secret_password_as_an_audio_file/1a89e0da-3344-4b5d-b919-ab8b072e0918',
    )
    chai.expect(test).to.equal('First, Third')
  })

  it('should return analysis question value properly for qualTags', () => {
    const test = getSupplementalDetailsContent(
      submissionWithSupplementalDetails,
      '_supplementalDetails/Secret_password_as_an_audio_file/b05f29f7-8b58-4dd7-8695-c29cb04f3f7a',
    )
    chai.expect(test).to.equal('best, things, ever recorder by human, 3')
  })

  it('should return analysis question value properly for qualInteger', () => {
    const test = getSupplementalDetailsContent(
      submissionWithSupplementalDetails,
      '_supplementalDetails/Secret_password_as_an_audio_file/97fd5387-ac2b-4108-b5b4-37fa91ae0e22',
    )
    chai.expect(test).to.equal('12345')
  })

  it('should return analysis question verified value properly', () => {
    const test = getSupplementalDetailsContent(
      submissionWithSupplementalDetails,
      '_supplementalDetails/Secret_password_as_an_audio_file/ab0e40e1-fbcc-43e9-9d00-b9b3314089cb/verified',
    )
    chai.expect(test).to.equal('No')
  })

  it('should return analysis question verified value properly for a question inside a group', () => {
    const test = getSupplementalDetailsContent(
      submissionWithNestedSupplementalDetails,
      '_supplementalDetails/level_a/level_b/level_c/sound/9d75988b-7b69-48ec-921d-2ed15b9f5ca7/verified',
    )
    chai.expect(test).to.equal('No')
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
        qual: {
          123: {
            value: '',
            type: 'qualText',
            uuid: '123',
            labels: { _default: 'foo' },
            xpath: '',
            verified: false,
            source: 'manual',
          },
          234: {
            value: 'foo',
            type: 'qualText',
            uuid: '234',
            labels: { _default: 'foo' },
            xpath: '',
            verified: false,
            source: 'manual',
          },
          345: {
            value: 'bar',
            options: { deleted: true },
            type: 'qualText',
            uuid: '345',
            labels: { _default: 'foo' },
            xpath: '345',
            verified: false,
            source: 'manual',
          },
        },
      },
    }

    const result = removeEmptyFromSupplementalDetails(supplementalDetails)

    chai.expect(result).to.eql({
      How_much_can_you_handle: {
        qual: {
          234: {
            value: 'foo',
            type: 'qualText',
            uuid: '234',
            labels: { _default: 'foo' },
            xpath: '',
            verified: false,
            source: 'manual',
          },
        },
      },
    })
  })

  it('should remove qual array if all responses are removed', () => {
    const supplementalDetails: SubmissionSupplementalDetails = {
      How_much_can_you_handle: {
        qual: {
          123: {
            value: '',
            type: 'qualText',
            labels: { _default: 'foo' },
            uuid: '123',
            xpath: '',
            verified: false,
            source: 'manual',
          },
          234: {
            value: 'bar',
            options: { deleted: true },
            type: 'qualText',
            labels: { _default: 'foo' },
            uuid: '234',
            xpath: '',
            verified: false,
            source: 'manual',
          },
        },
      },
    }

    const result = removeEmptyFromSupplementalDetails(supplementalDetails)

    chai.expect(result).to.eql({})
  })

  it('should remove nested empty objects', () => {
    const supplementalDetails: SubmissionSupplementalDetails = {
      How_much_can_you_handle: {
        qual: {},
      },
      question2: {},
    }

    const result = removeEmptyFromSupplementalDetails(supplementalDetails)

    chai.expect(result).to.eql({})
  })

  it('should handle already clean supplemental details', () => {
    const supplementalDetails: SubmissionSupplementalDetails = {
      How_much_can_you_handle: {
        qual: {
          123: {
            value: 'foo',
            type: 'qualText',
            labels: { _default: 'foo' },
            uuid: '123',
            xpath: '',
            verified: false,
            source: 'manual',
          },
        },
      },
    }

    const result = removeEmptyFromSupplementalDetails(supplementalDetails)

    chai.expect(result).to.eql(supplementalDetails)
  })

  it('should handle multiple kinds of empty responses', () => {
    const supplementalDetails: SubmissionSupplementalDetails = {
      How_much_can_you_handle: {
        qual: {
          123: {
            value: '',
            type: 'qualText',
            labels: { _default: 'foo' },
            uuid: '123',
            xpath: '',
            verified: false,
            source: 'manual',
          },
          234: {
            value: [],
            type: 'qualText',
            labels: { _default: 'foo' },
            uuid: '234',
            xpath: '',
            verified: false,
            source: 'manual',
          },
          345: {
            value: null,
            type: 'qualText',
            labels: { _default: 'foo' },
            uuid: '345',
            xpath: '',
            verified: false,
            source: 'manual',
          },
          456: {
            value: 'foo',
            options: { deleted: true },
            type: 'qualText',
            labels: { _default: 'foo' },
            uuid: '456',
            xpath: '',
            verified: false,
            source: 'manual',
          },
          567: {
            value: 'bar',
            type: 'qualText',
            labels: { _default: 'foo' },
            uuid: '567',
            xpath: '',
            verified: false,
            source: 'manual',
          },
        },
      },
    }

    const result = removeEmptyFromSupplementalDetails(supplementalDetails)

    chai.expect(result).to.eql({
      How_much_can_you_handle: {
        qual: {
          567: {
            value: 'bar',
            type: 'qualText',
            labels: { _default: 'foo' },
            uuid: '567',
            xpath: '',
            verified: false,
            source: 'manual',
          },
        },
      },
    })
  })

  it('should handle empty input', () => {
    const supplementalDetails: SubmissionSupplementalDetails = {}

    const result = removeEmptyFromSupplementalDetails(supplementalDetails)

    chai.expect(result).to.eql({})
  })
})

describe('hasUnacceptedAutomaticContent', () => {
  it('should return true for transcript with pendingReview flag', () => {
    const submission = assetDataFactory(1, {
      _supplementalDetails: {
        audio_question: {
          transcript: {
            languageCode: 'en',
            pendingReview: true,
          },
        },
      },
    })

    const result = hasUnacceptedAutomaticContent(submission, '_supplementalDetails/audio_question/transcript_en')

    chai.expect(result).to.be.true
  })

  it('should return false for accepted transcript (no pendingReview flag)', () => {
    const submission = assetDataFactory(1, {
      _supplementalDetails: {
        audio_question: {
          transcript: {
            value: 'Hello world',
            languageCode: 'en',
          },
        },
      },
    })

    const result = hasUnacceptedAutomaticContent(submission, '_supplementalDetails/audio_question/transcript_en')

    chai.expect(result).to.be.false
  })

  it('should return true for translation with pendingReview flag', () => {
    const submission = assetDataFactory(1, {
      _supplementalDetails: {
        audio_question: {
          translation: {
            es: {
              languageCode: 'es',
              pendingReview: true,
            },
          },
        },
      },
    })

    const result = hasUnacceptedAutomaticContent(submission, '_supplementalDetails/audio_question/translation_es')

    chai.expect(result).to.be.true
  })

  it('should return false for accepted translation (no pendingReview flag)', () => {
    const submission = assetDataFactory(1, {
      _supplementalDetails: {
        audio_question: {
          translation: {
            fr: {
              value: 'Bonjour le monde',
              languageCode: 'fr',
            },
          },
        },
      },
    })

    const result = hasUnacceptedAutomaticContent(submission, '_supplementalDetails/audio_question/translation_fr')

    chai.expect(result).to.be.false
  })

  it('should return false for qual questions (not transcript/translation)', () => {
    const submission = assetDataFactory(1, {
      _supplementalDetails: {
        audio_question: {
          qual: {
            '123-uuid': {
              value: 'Some analysis',
              type: 'qualText',
              uuid: '123-uuid',
              labels: { _default: 'Analysis' },
              xpath: 'audio_question',
              verified: false,
              source: 'manual',
            },
          },
        },
      },
    })

    const result = hasUnacceptedAutomaticContent(submission, '_supplementalDetails/audio_question/123-uuid')

    chai.expect(result).to.be.false
  })

  it('should return false for non-supplemental-details columns', () => {
    const submission = assetDataFactory(1, {
      regular_question: 'some answer',
    })

    const result = hasUnacceptedAutomaticContent(submission, 'regular_question')

    chai.expect(result).to.be.false
  })

  it('should return false when supplemental details are missing', () => {
    const submission = assetDataFactory(1)

    const result = hasUnacceptedAutomaticContent(submission, '_supplementalDetails/audio_question/transcript_en')

    chai.expect(result).to.be.false
  })

  it('should return false when source row data is missing', () => {
    const submission = assetDataFactory(1, {
      _supplementalDetails: {},
    })

    const result = hasUnacceptedAutomaticContent(submission, '_supplementalDetails/audio_question/transcript_en')

    chai.expect(result).to.be.false
  })

  it('should return false when transcript data is missing', () => {
    const submission = assetDataFactory(1, {
      _supplementalDetails: {
        audio_question: {},
      },
    })

    const result = hasUnacceptedAutomaticContent(submission, '_supplementalDetails/audio_question/transcript_en')

    chai.expect(result).to.be.false
  })

  it('should return false when translation language is missing', () => {
    const submission = assetDataFactory(1, {
      _supplementalDetails: {
        audio_question: {
          translation: {
            es: {
              value: 'Hola',
              languageCode: 'es',
            },
          },
        },
      },
    })

    const result = hasUnacceptedAutomaticContent(submission, '_supplementalDetails/audio_question/translation_fr')

    chai.expect(result).to.be.false
  })
})
