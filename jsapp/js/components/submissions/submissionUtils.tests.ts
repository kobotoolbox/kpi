import { getRowName } from '#/assetUtils'
import { QuestionTypeName } from '#/constants'
import assetDataFactory from '#/endpoints/assetData.factory'
import {
  DisplayGroup,
  DisplayResponse,
  getMediaAttachment,
  getSubmissionDisplayData,
  getSupplementalDetailsContent,
  hasAnyUnacceptedAutomaticContent,
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
import type { AssetResponse, SubmissionSupplementalDetails } from '#/dataInterface'
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

/**
 * Renames one row of a copy of the asset, the way deploying a new form version
 * would - leaving earlier submissions with keys the form no longer accounts for.
 */
function withRenamedRow(asset: AssetResponse, oldName: string, newName: string): AssetResponse {
  // Fixtures are plain JSON, and this test environment has no `structuredClone`.
  const renamedAsset: AssetResponse = JSON.parse(JSON.stringify(asset))
  const row = renamedAsset.content?.survey?.find((surveyRow) => getRowName(surveyRow) === oldName)
  if (!row) {
    throw new Error(`There is no row named "${oldName}" to rename`)
  }

  if (row.name !== undefined) {
    row.name = newName
  }
  if (row.$autoname !== undefined) {
    row.$autoname = newName
  }
  if (row.$xpath !== undefined) {
    row.$xpath = [...row.$xpath.split('/').slice(0, -1), newName].join('/')
  }
  return renamedAsset
}

/** The responses displayed directly in a group, i.e. without its subgroups. */
function getResponses(group: DisplayGroup) {
  return group.children.filter((child): child is DisplayResponse => child instanceof DisplayResponse)
}

/** The responses displayed in a named group; throws when there is no such group. */
function getGroupResponses(displayData: DisplayGroup, groupName: string) {
  const group = displayData.children.find(
    (child): child is DisplayGroup => child instanceof DisplayGroup && child.name === groupName,
  )
  if (!group) {
    throw new Error(`There is no group named "${groupName}" in the display data`)
  }
  return getResponses(group)
}

describe('getSubmissionDisplayData for answers the current form does not account for', () => {
  it('should keep the answer of a renamed question, alongside the empty row of its new name', () => {
    const asset = withRenamedRow(simpleSurveyAsset, 'First_name', 'First_name_v2')
    const responses = getResponses(getSubmissionDisplayData(asset, 0, simpleSurveySubmission))

    chai.expect(responses.find((response) => response.name === 'First_name_v2')?.data).to.equal(null)
    // Nothing is left to say what kind of question asked for this, hence `null` type.
    chai.expect(responses.find((response) => response.name === 'First_name')).to.deep.include({
      type: null,
      label: 'First_name',
      xpath: 'First_name',
      data: 'Leszek',
    })
  })

  it('should keep the answer of a question renamed inside a group, in that group', () => {
    const displayData = getSubmissionDisplayData(
      withRenamedRow(simpleSurveyAsset, 'Favourite_color', 'Favourite_color_v2'),
      0,
      simpleSurveySubmission,
    )

    // The key still names the group it was given in, and the form still has it.
    chai
      .expect(getGroupResponses(displayData, 'group_favourites').find((response) => response.data === 'pink'))
      .to.deep.include({
        label: 'Favourite_color',
        name: 'group_favourites/Favourite_color',
        xpath: 'group_favourites/Favourite_color',
      })
    chai.expect(getResponses(displayData).map((response) => response.name)).to.deep.equal(['First_name'])
  })

  it('should keep the answers of a renamed group, in the group as it is named now', () => {
    const displayData = getSubmissionDisplayData(
      withRenamedRow(simpleSurveyAsset, 'group_favourites', 'group_favourites_v2'),
      0,
      simpleSurveySubmission,
    )
    const groupResponses = getGroupResponses(displayData, 'group_favourites_v2')

    // The questions kept their own names, so these rows come out as complete as
    // the ones the traversal builds - and the group is not left standing empty.
    chai.expect(groupResponses).to.have.lengthOf(2)
    chai.expect(groupResponses[0]).to.deep.include({
      type: QuestionTypeName.select_one,
      label: 'Favourite color',
      xpath: 'group_favourites/Favourite_color',
      listName: 'fav_col_list',
      data: 'pink',
    })
    chai.expect(groupResponses[1]).to.deep.include({
      type: QuestionTypeName.integer,
      label: 'Favourite number',
      data: '24',
    })
    chai.expect(getResponses(displayData).map((response) => response.name)).to.deep.equal(['First_name'])
  })

  it('should fall back to the root when a group and its question were both renamed', () => {
    const displayData = getSubmissionDisplayData(
      withRenamedRow(
        withRenamedRow(simpleSurveyAsset, 'group_favourites', 'group_favourites_v2'),
        'Favourite_color',
        'Favourite_color_v2',
      ),
      0,
      simpleSurveySubmission,
    )

    // Both names are gone, so nothing ties this answer to a group - no guessing.
    // Its sibling, whose name survived, still goes into the group.
    chai
      .expect(getResponses(displayData).map((response) => response.name))
      .to.deep.equal(['First_name', 'group_favourites/Favourite_color'])
    chai
      .expect(getGroupResponses(displayData, 'group_favourites_v2').map((response) => response.name))
      .to.deep.equal(['group_favourites/Favourite_number'])
  })

  it('should read the type of a renamed media question from its attachment', () => {
    const asset = withRenamedRow(
      withRenamedRow(everythingSurveyAsset, 'Voice_password', 'Voice_password_v2'),
      'Selfportrait',
      'Selfportrait_v2',
    )
    const responses = getResponses(getSubmissionDisplayData(asset, 0, everythingSurveySubmission))

    // Only the mimetype is left to tell these apart, and the type is what gets the
    // modal to render a player or a thumbnail instead of a filename.
    const voicePassword = responses.find((response) => response.name === 'Voice_password')
    chai.expect(voicePassword).to.deep.include({
      type: QuestionTypeName.audio,
      xpath: 'Voice_password',
      data: '07. Crazy Love-13_32_31.mp3',
    })
    chai.expect(responses.find((response) => response.name === 'Selfportrait')?.type).to.equal(QuestionTypeName.image)

    // The row is only worth anything if the modal can reach the file from it,
    // which it does by xpath (see `renderAttachment`).
    chai
      .expect(getMediaAttachment(everythingSurveySubmission, String(voicePassword?.data), voicePassword?.xpath ?? ''))
      .to.deep.include({ question_xpath: 'Voice_password' })
  })

  it('should not add rows for submission properties that are not answers', () => {
    // No question asked for any of these: a property Front end doesn't model
    // (`_index`), deprecated meta questions (`simserial`), and meta questions this
    // form doesn't have (`today`).
    const submission = {
      ...simpleSurveySubmission,
      _index: 3,
      simserial: 'simserial not found',
      subscriberid: 'subscriberid not found',
      today: '2020-04-06',
    }
    const responses = getResponses(getSubmissionDisplayData(simpleSurveyAsset, 0, submission))

    chai.expect(responses.map((response) => response.name)).to.deep.equal(['First_name'])
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

  it('should return false for a pending transcript in another language', () => {
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

    const result = hasUnacceptedAutomaticContent(submission, '_supplementalDetails/audio_question/transcript_tr')

    chai.expect(result).to.be.false
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

  it('should return false for qual verification columns', () => {
    const submission = assetDataFactory(1, {
      _supplementalDetails: {
        audio_question: {
          transcript: {
            languageCode: 'en',
            pendingReview: true,
          },
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

    const result = hasUnacceptedAutomaticContent(submission, '_supplementalDetails/audio_question/123-uuid/verified')

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

describe('hasAnyUnacceptedAutomaticContent', () => {
  const pendingTranscriptSubmission = assetDataFactory(1, {
    _supplementalDetails: {
      audio_question: {
        transcript: {
          languageCode: 'en',
          pendingReview: true,
        },
      },
    },
  })

  const acceptedTranscriptSubmission = assetDataFactory(2, {
    _supplementalDetails: {
      audio_question: {
        transcript: {
          languageCode: 'en',
          value: 'Hello world',
        },
      },
    },
  })

  const pendingTranslationSubmission = assetDataFactory(3, {
    _supplementalDetails: {
      audio_question: {
        translation: {
          fr: {
            languageCode: 'fr',
            pendingReview: true,
          },
        },
      },
    },
  })

  const acceptedTranslationSubmission = assetDataFactory(4, {
    _supplementalDetails: {
      audio_question: {
        translation: {
          fr: {
            languageCode: 'fr',
            value: 'Bonjour le monde',
          },
        },
      },
    },
  })

  it('should return false for no submissions', () => {
    const result = hasAnyUnacceptedAutomaticContent([], '_supplementalDetails/audio_question/transcript_en')

    chai.expect(result).to.be.false
  })

  it('should return false when all transcripts are already accepted', () => {
    const result = hasAnyUnacceptedAutomaticContent(
      [acceptedTranscriptSubmission, acceptedTranscriptSubmission],
      '_supplementalDetails/audio_question/transcript_en',
    )

    chai.expect(result).to.be.false
  })

  it('should return true when at least one transcript awaits approval', () => {
    const result = hasAnyUnacceptedAutomaticContent(
      [acceptedTranscriptSubmission, pendingTranscriptSubmission],
      '_supplementalDetails/audio_question/transcript_en',
    )

    chai.expect(result).to.be.true
  })

  it('should ignore transcripts awaiting approval in another language', () => {
    const result = hasAnyUnacceptedAutomaticContent(
      [acceptedTranscriptSubmission, pendingTranscriptSubmission],
      '_supplementalDetails/audio_question/transcript_tr',
    )

    chai.expect(result).to.be.false
  })

  it('should return false when all translations are already accepted', () => {
    const result = hasAnyUnacceptedAutomaticContent(
      [acceptedTranslationSubmission],
      '_supplementalDetails/audio_question/translation_fr',
    )

    chai.expect(result).to.be.false
  })

  it('should return true when at least one translation awaits approval', () => {
    const result = hasAnyUnacceptedAutomaticContent(
      [acceptedTranslationSubmission, pendingTranslationSubmission],
      '_supplementalDetails/audio_question/translation_fr',
    )

    chai.expect(result).to.be.true
  })

  it('should only consider the language of the given column', () => {
    const result = hasAnyUnacceptedAutomaticContent(
      [pendingTranslationSubmission],
      '_supplementalDetails/audio_question/translation_es',
    )

    chai.expect(result).to.be.false
  })

  it('should return false for submissions without any supplemental details', () => {
    const result = hasAnyUnacceptedAutomaticContent(
      [assetDataFactory(5), assetDataFactory(6)],
      '_supplementalDetails/audio_question/transcript_en',
    )

    chai.expect(result).to.be.false
  })
})
