import { QuestionTypeName, SUPPLEMENTAL_DETAILS_PROP } from '#/constants'
import type { SubmissionResponse } from '#/dataInterface'
import {
  getAllDataColumns,
  getColumnLabel,
  isTableColumnFilterableByTextInput,
  selectNestedRow,
  shouldDropLegacyAttachmentColumn,
} from './tableUtils'
import { assetWithBgAudioAndNLP, assetWithNestedGroupsAndNLP } from './tableUtils.mocks'

describe('tableUtils', () => {
  describe('getColumnLabel', () => {
    it('should return proper label for background-audio question', () => {
      const test = getColumnLabel(assetWithBgAudioAndNLP, 'background-audio', true)
      chai.expect(test).to.equal('Background audio')
    })

    it('should return proper label for qualitative analysis question (id e59a3552-c06c-43f2-92f1-8e3607052624) for background-audio question', () => {
      const test = getColumnLabel(
        assetWithBgAudioAndNLP,
        '_supplementalDetails/background-audio/e59a3552-c06c-43f2-92f1-8e3607052624',
        true,
      )
      chai.expect(test).to.equal('Is this bg audio? | Background audio')
    })

    it('should return proper label for transcript of background-audio question', () => {
      const test = getColumnLabel(assetWithBgAudioAndNLP, '_supplementalDetails/background-audio/transcript_en', true)
      chai.expect(test).to.equal('transcript (en) | Background audio')
    })

    it('should return proper label for translation of background-audio question', () => {
      const test = getColumnLabel(assetWithBgAudioAndNLP, '_supplementalDetails/background-audio/translation_fr', true)
      chai.expect(test).to.equal('translation (fr) | Background audio')
    })

    it('should return provided key (row name) as a fallback', () => {
      const test = getColumnLabel(assetWithBgAudioAndNLP, 'i_have_no_mouth_and_i_must_scream', true)
      chai.expect(test).to.equal('i_have_no_mouth_and_i_must_scream')
    })

    it('should return proper label for nested group audio question', () => {
      const test = getColumnLabel(
        assetWithNestedGroupsAndNLP,
        'outer_group/middle_group/inner_group/What_did_you_hear',
        true,
      )
      chai.expect(test).to.equal('Outer group / Middle group / Inner group / What did you hear?')
    })

    it('should return proper label for transcript of a nested group audio question', () => {
      const test = getColumnLabel(
        assetWithNestedGroupsAndNLP,
        '_supplementalDetails/outer_group/middle_group/inner_group/What_did_you_hear/transcript_pl',
        true,
      )
      chai.expect(test).to.equal('transcript (pl) | Outer group / Middle group / Inner group / What did you hear?')
    })

    it('should return proper no-groups label for transcript of a nested group audio question', () => {
      const test = getColumnLabel(
        assetWithNestedGroupsAndNLP,
        '_supplementalDetails/outer_group/middle_group/inner_group/What_did_you_hear/transcript_pl',
        false,
      )
      chai.expect(test).to.equal('transcript (pl) | What did you hear?')
    })

    // TODO: write more tests here… I haven't got enough time to go over all
    // possible cases, just added one that I was fixing a bug for and a couple
    // that came to my mind.
  })

  describe('isTableColumnFilterableByTextInput', () => {
    it('should return true for hidden question type', () => {
      const test = isTableColumnFilterableByTextInput(QuestionTypeName.hidden, 'my_hidden_question')
      chai.expect(test).to.equal(true)
    })

    it('should return false for a non-filterable question type', () => {
      const test = isTableColumnFilterableByTextInput(QuestionTypeName.audio, 'my_audio_question')
      chai.expect(test).to.equal(false)
    })
  })

  describe('getAllDataColumns', () => {
    const attachmentCases = [
      {
        title: 'audio',
        currentKey: 'Secret_password_as_an_audio_file',
        legacyKey: 'old_group/Secret_password_as_an_audio_file',
        mirroredValue: 'secret-password.mp3',
        currentOnlyValue: 'new-secret-password.mp3',
        legacyOnlyValue: 'old-secret-password.mp3',
      },
      {
        title: 'background-audio',
        currentKey: 'background-audio',
        legacyKey: 'old_group/background-audio',
        mirroredValue: 'ambient.mp3',
        currentOnlyValue: 'new-ambient.mp3',
        legacyOnlyValue: 'old-ambient.mp3',
      },
      {
        title: 'image',
        currentKey: 'Your_selfie_goes_here',
        legacyKey: 'old_group/Your_selfie_goes_here',
        mirroredValue: 'selfie.jpg',
        currentOnlyValue: 'new-selfie.jpg',
        legacyOnlyValue: 'old-selfie.jpg',
      },
      {
        title: 'video',
        currentKey: 'A_video_WTF',
        legacyKey: 'old_group/A_video_WTF',
        mirroredValue: 'clip.mp4',
        currentOnlyValue: 'new-clip.mp4',
        legacyOnlyValue: 'old-clip.mp4',
      },
      {
        title: 'file',
        currentKey: 'Document_upload',
        legacyKey: 'old_group/Document_upload',
        mirroredValue: 'report.pdf',
        currentOnlyValue: 'new-report.pdf',
        legacyOnlyValue: 'old-report.pdf',
      },
    ]

    const assetWithFileAttachment = (() => {
      const clonedAsset = JSON.parse(JSON.stringify(assetWithBgAudioAndNLP))
      clonedAsset.content.survey.push({
        name: 'Document_upload',
        type: 'file',
        $kuid: 'file-row-kuid',
        label: ['Document upload'],
        $xpath: 'Document_upload',
        required: false,
        $autoname: 'Document_upload',
      })
      return clonedAsset
    })()

    const getAssetForCase = (questionType: string) => {
      if (questionType === 'file') {
        return assetWithFileAttachment
      }
      return assetWithBgAudioAndNLP
    }

    attachmentCases.forEach(({ title, currentKey, legacyKey, mirroredValue, currentOnlyValue, legacyOnlyValue }) => {
      it(`should keep current ${title} key and drop legacy path duplicate`, () => {
        const submissions = [
          {
            _attachments: [
              {
                question_xpath: legacyKey,
                media_file_basename: mirroredValue,
                is_deleted: false,
              },
            ],
            [currentKey]: mirroredValue,
            [legacyKey]: mirroredValue,
          },
        ] as unknown as SubmissionResponse[]

        const columns = getAllDataColumns(getAssetForCase(title), submissions)

        chai.expect(columns).to.include(currentKey)
        chai.expect(columns).to.not.include(legacyKey)
      })

      it(`should keep both ${title} columns when same leaf points to distinct fields`, () => {
        const submissions = [
          {
            _attachments: [
              {
                question_xpath: currentKey,
                media_file_basename: currentOnlyValue,
                is_deleted: false,
              },
              {
                question_xpath: legacyKey,
                media_file_basename: legacyOnlyValue,
                is_deleted: false,
              },
            ],
            [currentKey]: currentOnlyValue,
            [legacyKey]: legacyOnlyValue,
          },
        ] as unknown as SubmissionResponse[]

        const columns = getAllDataColumns(getAssetForCase(title), submissions)

        chai.expect(columns).to.include(currentKey)
        chai.expect(columns).to.include(legacyKey)
      })

      it(`should keep both ${title} columns when both paths have attachments with same basename`, () => {
        const submissions = [
          {
            _attachments: [
              {
                question_xpath: currentKey,
                media_file_basename: mirroredValue,
                is_deleted: false,
              },
              {
                question_xpath: legacyKey,
                media_file_basename: mirroredValue,
                is_deleted: false,
              },
            ],
            [currentKey]: mirroredValue,
            [legacyKey]: mirroredValue,
          },
        ] as unknown as SubmissionResponse[]

        const columns = getAllDataColumns(getAssetForCase(title), submissions)

        chai.expect(columns).to.include(currentKey)
        chai.expect(columns).to.include(legacyKey)
      })

      it(`should keep legacy ${title} column when some submissions have only legacy values`, () => {
        const submissions = [
          {
            _attachments: [
              {
                question_xpath: legacyKey,
                media_file_basename: mirroredValue,
                is_deleted: false,
              },
            ],
            [legacyKey]: mirroredValue,
          },
          {
            _attachments: [
              {
                question_xpath: legacyKey,
                media_file_basename: mirroredValue,
                is_deleted: false,
              },
            ],
            [currentKey]: mirroredValue,
            [legacyKey]: mirroredValue,
          },
        ] as unknown as SubmissionResponse[]

        const columns = getAllDataColumns(getAssetForCase(title), submissions)

        chai.expect(columns).to.include(currentKey)
        chai.expect(columns).to.include(legacyKey)
      })
    })

    it('should keep legacy when one of several matching current paths has no value in a submission', () => {
      const legacyKey = 'old_group/Secret_password_as_an_audio_file'
      const currentPaths = ['Secret_password_as_an_audio_file', 'another_group/Secret_password_as_an_audio_file']
      const submissions = [
        {
          _attachments: [
            {
              question_xpath: legacyKey,
              media_file_basename: 'secret-password.mp3',
              is_deleted: false,
            },
          ],
          [legacyKey]: 'secret-password.mp3',
          Secret_password_as_an_audio_file: 'secret-password.mp3',
        },
        {
          _attachments: [
            {
              question_xpath: legacyKey,
              media_file_basename: 'secret-password.mp3',
              is_deleted: false,
            },
          ],
          [legacyKey]: 'secret-password.mp3',
        },
      ] as unknown as SubmissionResponse[]

      const shouldDrop = shouldDropLegacyAttachmentColumn(submissions, legacyKey, currentPaths)

      chai.expect(shouldDrop).to.equal(false)
    })
  })

  describe('selectNestedRow', () => {
    it('should return exact key value when present', () => {
      const row = {
        'group_a/group_b/question': 'value-from-exact-key',
      } as unknown as SubmissionResponse

      const test = selectNestedRow(row, 'group_a/group_b/question', 'group_a')

      chai.expect(test).to.equal('value-from-exact-key')
    })

    it('should always use exact key for supplemental details', () => {
      const supplementalKey = `${SUPPLEMENTAL_DETAILS_PROP}/audio/transcript_en`
      const row = {
        [supplementalKey]: 'bonjour',
        audio: {
          transcript_en: 'should-not-be-used',
        },
      } as unknown as SubmissionResponse

      const test = selectNestedRow(row, supplementalKey, 'audio')

      chai.expect(test).to.equal('bonjour')
    })

    it('should return nearest parent container when exact nested key is missing', () => {
      const parentContainer = [{ 'group_a/group_b/question': 'a' }, { 'group_a/group_b/question': 'b' }]
      const row = {
        'group_a/group_b': parentContainer,
      } as unknown as SubmissionResponse

      const test = selectNestedRow(row, 'group_a/group_b/question', 'group_a')

      chai.expect(test).to.equal(parentContainer)
    })

    it('should ignore scalar parent fallback and keep searching for valid container', () => {
      const rootContainer = [{ 'group_a/question': 'a' }]
      const row = {
        'group_a/group_b': 'scalar-value',
        group_a: rootContainer,
      } as unknown as SubmissionResponse

      const test = selectNestedRow(row, 'group_a/group_b/question', 'group_a')

      chai.expect(test).to.equal(rootContainer)
    })

    it('should return undefined when neither exact key nor valid parent containers exist', () => {
      const row = {
        group_a: 'not-a-container',
      } as unknown as SubmissionResponse

      const test = selectNestedRow(row, 'group_a/group_b/question', 'group_a')

      chai.expect(test).to.equal(undefined)
    })
  })
})
