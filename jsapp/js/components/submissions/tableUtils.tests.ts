import { QuestionTypeName, SUPPLEMENTAL_DETAILS_PROP } from '#/constants'
import type { AnyRowTypeName } from '#/constants'
import type { SubmissionResponse, SurveyChoice } from '#/dataInterface'
import {
  getAllDataColumns,
  getColumnLabel,
  getMetadataColumns,
  getSelectResponseLabel,
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

  describe('getSelectResponseLabel', () => {
    // The 'animals' list once had choices 'a', 'b' and 'c', then 'a' and 'b'
    // were renamed to 'a1' and 'b1'. Only the current names are here, as that's
    // all the latest form version gives us, so submissions storing 'a' or 'b'
    // have nothing to match. 'other_list' guards against cross-list matches.
    const animalChoices = [
      { name: 'a1', label: ['archaeopteryx', 'archaeopteryks'], list_name: 'animals', $autovalue: 'a1', $kuid: 'k1' },
      { name: 'b1', label: ['badger', 'borsuk'], list_name: 'animals', $autovalue: 'b1', $kuid: 'k2' },
      { name: 'c', label: ['Crocodile', 'Krokodyl'], list_name: 'animals', $autovalue: 'c', $kuid: 'k3' },
      { name: 'a', label: ['Apple'], list_name: 'other_list', $autovalue: 'a', $kuid: 'k4' },
    ] as const satisfies SurveyChoice[]

    /** Resolves a response against `animalChoices`, as every case here does. */
    const getAnimalsLabel = (value: string, questionType: AnyRowTypeName, translationIndex = 0) =>
      getSelectResponseLabel({
        value,
        questionType,
        listName: 'animals',
        choices: animalChoices,
        translationIndex,
      })

    it('should return labels of all selected select_multiple choices', () => {
      const test = getAnimalsLabel('a1 b1 c', QuestionTypeName.select_multiple)
      chai.expect(test).to.equal('archaeopteryx, badger, Crocodile')
    })

    // Bug fixed: unmatched values were omitted, so this returned only
    // 'Crocodile' with no hint that two more options were selected.
    it('should fall back to raw values for select_multiple choices missing from the form', () => {
      const test = getAnimalsLabel('a b c', QuestionTypeName.select_multiple)
      chai.expect(test).to.equal('a, b, Crocodile')
    })

    it('should use labels of given translation for select_multiple', () => {
      // Mixes a matched and an unmatched value, as the fallback should not
      // depend on which translation was asked for.
      const test = getAnimalsLabel('a b1 c', QuestionTypeName.select_multiple, 1)
      chai.expect(test).to.equal('a, borsuk, Krokodyl')
    })

    it('should fall back to raw value when a translation has no label', () => {
      // 'c' does match a choice, but index 5 is past the end of its labels,
      // like a choice left untranslated in one language.
      const test = getAnimalsLabel('c', QuestionTypeName.select_multiple, 5)
      chai.expect(test).to.equal('c')
    })

    it('should not produce dangling separators for select_multiple stray whitespace', () => {
      const test = getAnimalsLabel(' a1  c ', QuestionTypeName.select_multiple)
      chai.expect(test).to.equal('archaeopteryx, Crocodile')
    })

    it('should only match choices of the question own list', () => {
      // 'a' is labelled 'Apple' in 'other_list' but absent from 'animals', so it
      // must stay raw instead of borrowing that label.
      const test = getAnimalsLabel('a', QuestionTypeName.select_multiple)
      chai.expect(test).to.equal('a')
    })

    it('should return label of selected select_one choice', () => {
      const test = getAnimalsLabel('c', QuestionTypeName.select_one)
      chai.expect(test).to.equal('Crocodile')
    })

    it('should fall back to raw value for a select_one choice missing from the form', () => {
      const test = getAnimalsLabel('a', QuestionTypeName.select_one)
      chai.expect(test).to.equal('a')
    })

    it('should not split select_one values on spaces', () => {
      // A single value may contain spaces. Treating them as separators would
      // mangle this into 'a, b, Crocodile'.
      const test = getAnimalsLabel('a b c', QuestionTypeName.select_one)
      chai.expect(test).to.equal('a b c')
    })
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

    it('should return columns in the canonical order', () => {
      const columns = getAllDataColumns(assetWithBgAudioAndNLP)

      chai.expect(columns).to.deep.equal([
        // `background-audio` (with its supplemental details columns) goes first
        'background-audio',
        '_supplementalDetails/background-audio/transcript_en',
        '_supplementalDetails/background-audio/translation_fr',
        '_supplementalDetails/background-audio/e59a3552-c06c-43f2-92f1-8e3607052624',
        // …then `start` and `end`…
        'start',
        'end',
        // …then all the form questions in the form definition order (note that
        // `today`, `username`, `deviceid` and `phonenumber` are defined before
        // these questions in the form, but they are metadata, so they go last)…
        'audit',
        'Your_name_here',
        'Your_selfie_goes_here',
        'A_video_WTF',
        'Secret_password_as_an_audio_file',
        // …and finally the remaining metadata columns
        'username',
        'deviceid',
        'phonenumber',
        'today',
      ])
    })

    it('should put metadata columns from submissions at the end in the canonical order', () => {
      // Note the reversed order of these properties - we want to make sure the
      // order of the columns doesn't depend on the order of submission props.
      const submissions = [
        {
          'meta/rootUuid': 'aaa',
          _submitted_by: 'kobo',
          _submission_time: '2026-08-04T12:00:00',
          _uuid: 'bbb',
          _id: 1,
          __version__: 'vABC',
        },
      ] as unknown as SubmissionResponse[]

      const columns = getAllDataColumns(assetWithBgAudioAndNLP, submissions)

      chai
        .expect(columns.slice(-10))
        .to.deep.equal([
          'username',
          'deviceid',
          'phonenumber',
          'today',
          '__version__',
          '_id',
          '_uuid',
          '_submission_time',
          '_submitted_by',
          'meta/rootUuid',
        ])
    })

    it('should keep the order of questions from a nested group', () => {
      const columns = getAllDataColumns(assetWithNestedGroupsAndNLP)

      chai
        .expect(columns)
        .to.deep.equal([
          'outer_group/middle_group/inner_group/What_did_you_hear',
          '_supplementalDetails/outer_group/middle_group/inner_group/What_did_you_hear/transcript_pl',
          '_supplementalDetails/outer_group/middle_group/inner_group/What_did_you_hear/translation_de',
        ])
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

  describe('getMetadataColumns', () => {
    it('should return only the metadata columns the form defines', () => {
      const test = getMetadataColumns(assetWithBgAudioAndNLP)

      // `audit` is included because this form defines it. Single Submission
      // modal used to show it for every form, which was a bug.
      chai.expect(test).to.deep.equal(['start', 'end', 'audit', 'username', 'deviceid', 'phonenumber', 'today'])
    })

    it('should not return meta questions that the form does not define', () => {
      const test = getMetadataColumns(assetWithNestedGroupsAndNLP)

      chai.expect(test).to.deep.equal([])
    })

    it('should return additional submission properties found in submissions', () => {
      const submissions = [
        {
          _id: 1,
          _uuid: 'aaa',
          _submission_time: '2026-08-04T12:00:00',
          // These two are in `EXCLUDED_COLUMNS`, so they must not come through
          _status: 'submitted_via_web',
          'meta/instanceID': 'uuid:aaa',
        },
      ] as unknown as SubmissionResponse[]

      const test = getMetadataColumns(assetWithNestedGroupsAndNLP, submissions)

      chai.expect(test).to.deep.equal(['_id', '_uuid', '_submission_time'])
    })
  })
})
