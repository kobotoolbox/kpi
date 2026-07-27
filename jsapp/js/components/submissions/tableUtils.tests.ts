import { QuestionTypeName, SUPPLEMENTAL_DETAILS_PROP } from '#/constants'
import type { SubmissionResponse } from '#/dataInterface'
import { getAllDataColumns, getColumnLabel, isTableColumnFilterableByTextInput, selectNestedRow } from './tableUtils'
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

  describe('getAllDataColumns', () => {
    it('should keep current audio key and drop legacy path duplicate', () => {
      // In this case, imagine we had a question with path
      // `old_group/Secret_password_as_an_audio_file`, made a submission, and
      // then and we've renamed it to `Secret_password_as_an_audio_file` and
      // now we have both pieces in submission data
      const submissions = [
        {
          _attachments: [
            {
              question_xpath: 'old_group/Secret_password_as_an_audio_file',
              media_file_basename: 'secret_audio.mp3',
            },
          ],
          Secret_password_as_an_audio_file: 'secret_audio.mp3',
          'old_group/Secret_password_as_an_audio_file': 'secret_audio.mp3',
        },
      ] as unknown as SubmissionResponse[]

      const columns = getAllDataColumns(assetWithBgAudioAndNLP, submissions)

      chai.expect(columns).to.include('Secret_password_as_an_audio_file')
      chai.expect(columns).to.not.include('old_group/Secret_password_as_an_audio_file')
    })

    it('should keep both columns when old and current paths are distinct fields', () => {
      const submissions = [
        {
          _attachments: [
            {
              question_xpath: 'old_group/Secret_password_as_an_audio_file',
              media_file_basename: 'legacy_audio.mp3',
            },
            {
              question_xpath: 'Secret_password_as_an_audio_file',
              media_file_basename: 'current_audio.mp3',
            },
          ],
          Secret_password_as_an_audio_file: 'current_audio.mp3',
          'old_group/Secret_password_as_an_audio_file': 'legacy_audio.mp3',
        },
      ] as unknown as SubmissionResponse[]

      const columns = getAllDataColumns(assetWithBgAudioAndNLP, submissions)

      chai.expect(columns).to.include('Secret_password_as_an_audio_file')
      chai.expect(columns).to.include('old_group/Secret_password_as_an_audio_file')
    })
  })
})
