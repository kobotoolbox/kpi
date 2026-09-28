import type { DataResponse } from '#/api/models/dataResponse'
import { GroupTypeBeginName, GroupTypeEndName, QuestionTypeName } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import { getProcessingQuestionType } from './questionType'

/**
 * A form holding a text question at the root and an audio question inside a group. The group
 * rows are here so the paths below are ones this form could actually produce.
 */
const ASSET_WITH_GROUPED_AUDIO = {
  content: {
    survey: [
      { name: 'notes', type: QuestionTypeName.text, $xpath: 'notes', $kuid: 'aa1', $autoname: 'notes' },
      {
        name: 'audio_group',
        type: GroupTypeBeginName.begin_group,
        $xpath: 'audio_group',
        $kuid: 'aa2',
        $autoname: 'audio_group',
      },
      {
        name: 'recording',
        type: QuestionTypeName.audio,
        $xpath: 'audio_group/recording',
        $kuid: 'aa3',
        $autoname: 'recording',
      },
      { type: GroupTypeEndName.end_group, $kuid: '/aa2' },
    ],
  },
} as unknown as AssetResponse

/** A submission holding the given answers, with a file of the given mimetype at each path of `attachments`. */
function buildSubmission(
  answers: Record<string, unknown> = {},
  attachments: Array<{ question_xpath: string; mimetype: string }> = [],
): DataResponse {
  return { ...answers, _attachments: attachments } as unknown as DataResponse
}

describe('getProcessingQuestionType', () => {
  it('reads the type off the form definition, before any submission has loaded', () => {
    chai
      .expect(getProcessingQuestionType(ASSET_WITH_GROUPED_AUDIO, 'audio_group/recording'))
      .to.equal(QuestionTypeName.audio)
    chai.expect(getProcessingQuestionType(ASSET_WITH_GROUPED_AUDIO, 'notes')).to.equal(QuestionTypeName.text)
  })

  it('prefers the form definition over the submission', () => {
    // A `file` question can hold audio: the mimetype describes what one submission put in it,
    // not what the question is.
    const asset = {
      content: { survey: [{ name: 'upload', type: QuestionTypeName.file, $xpath: 'upload', $kuid: 'bb1' }] },
    } as unknown as AssetResponse
    const submission = buildSubmission({ upload: 'song.mp3' }, [{ question_xpath: 'upload', mimetype: 'audio/mpeg' }])

    chai.expect(getProcessingQuestionType(asset, 'upload', submission)).to.equal(QuestionTypeName.file)
  })

  it('only matches the whole path, not a namesake question of another group', () => {
    // `recording` is the audio question's name, but its path is `audio_group/recording`.
    // Matching by name would hand out `audio` for a path this form has no question at.
    chai.expect(getProcessingQuestionType(ASSET_WITH_GROUPED_AUDIO, 'recording', buildSubmission())).to.equal(undefined)
  })

  describe('for a question the current form no longer has', () => {
    // Renamed, moved or deleted since the submission came in, so there is no row left to read
    // a type from.
    it("takes the type from the attachment's mimetype", () => {
      const submission = buildSubmission({ old_recording: 'song.mp3' }, [
        { question_xpath: 'old_recording', mimetype: 'audio/mpeg' },
      ])

      chai
        .expect(getProcessingQuestionType(ASSET_WITH_GROUPED_AUDIO, 'old_recording', submission))
        .to.equal(QuestionTypeName.audio)
    })

    it('takes the type from the mimetype rather than from the file name', () => {
      // `.dat` says nothing, and a question named like an audio one can hold a photo.
      const submission = buildSubmission({ old_audio_question: 'mystery.dat' }, [
        { question_xpath: 'old_audio_question', mimetype: 'image/jpeg' },
      ])

      chai
        .expect(getProcessingQuestionType(ASSET_WITH_GROUPED_AUDIO, 'old_audio_question', submission))
        .to.equal(QuestionTypeName.image)
    })

    it('reads a plain string with no file under it as a text question', () => {
      const submission = buildSubmission({ old_notes: 'Some typed answer' })

      chai
        .expect(getProcessingQuestionType(ASSET_WITH_GROUPED_AUDIO, 'old_notes', submission))
        .to.equal(QuestionTypeName.text)
    })

    it('gives no type when the submission has nothing under the path either', () => {
      chai
        .expect(getProcessingQuestionType(ASSET_WITH_GROUPED_AUDIO, 'old_notes', buildSubmission()))
        .to.equal(undefined)
    })

    it('gives no type for a path holding something other than a string', () => {
      // A repeat group's answers, i.e. not a question at all.
      const submission = buildSubmission({ old_group: [{ 'old_group/name': 'Leszek' }] })

      chai.expect(getProcessingQuestionType(ASSET_WITH_GROUPED_AUDIO, 'old_group', submission)).to.equal(undefined)
    })

    it('gives no type while the submission has not loaded yet', () => {
      chai.expect(getProcessingQuestionType(ASSET_WITH_GROUPED_AUDIO, 'old_recording')).to.equal(undefined)
    })
  })
})
