import type { DataResponse } from '#/api/models/dataResponse'
import { GroupTypeBeginName, GroupTypeEndName, QuestionTypeName } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import { getProcessingQuestionType, isInRepeatGroup } from './questionType'

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

/**
 * A form holding a text question at the root, and an audio question inside a repeat group that
 * itself sits inside a regular group.
 */
const ASSET_WITH_REPEATED_AUDIO = {
  content: {
    survey: [
      { name: 'notes', type: QuestionTypeName.text, $xpath: 'notes', $kuid: 'cc1', $autoname: 'notes' },
      { name: 'household', type: GroupTypeBeginName.begin_group, $xpath: 'household', $kuid: 'cc2' },
      { name: 'members', type: GroupTypeBeginName.begin_repeat, $xpath: 'household/members', $kuid: 'cc3' },
      {
        name: 'recording',
        type: QuestionTypeName.audio,
        $xpath: 'household/members/recording',
        $kuid: 'cc4',
        $autoname: 'recording',
      },
      { type: GroupTypeEndName.end_repeat, $kuid: '/cc3' },
      { type: GroupTypeEndName.end_group, $kuid: '/cc2' },
    ],
  },
} as unknown as AssetResponse

describe('isInRepeatGroup', () => {
  it('is true for a question inside a repeat group, whatever its type', () => {
    chai.expect(isInRepeatGroup(ASSET_WITH_REPEATED_AUDIO, 'household/members/recording')).to.equal(true)
  })

  it('is false for a question outside of any repeat group', () => {
    chai.expect(isInRepeatGroup(ASSET_WITH_REPEATED_AUDIO, 'notes')).to.equal(false)
    chai.expect(isInRepeatGroup(ASSET_WITH_GROUPED_AUDIO, 'audio_group/recording')).to.equal(false)
  })

  it('is true for a path holding a repeat-instance index', () => {
    chai.expect(isInRepeatGroup(ASSET_WITH_GROUPED_AUDIO, 'audio_group[2]/recording')).to.equal(true)
  })

  it('is true when the submission holds the answer inside a list of repeat instances', () => {
    // The question has since been moved out of the repeat group, so only the submission knows.
    const submission = buildSubmission({ repeated: [{ 'repeated/notes': 'first' }, { 'repeated/notes': 'second' }] })
    chai.expect(isInRepeatGroup(ASSET_WITH_GROUPED_AUDIO, 'repeated/notes', submission)).to.equal(true)
  })

  it('finds a repeat nested in a regular group stored as an object, after the form made it a regular group', () => {
    // `audio_group/members` is no repeat in the current form, only older submissions know it was one.
    const instances = [{ 'audio_group/members/notes': 'first' }, { 'audio_group/members/notes': 'second' }]
    const byFullPath = buildSubmission({ audio_group: { 'audio_group/members': instances } })
    const byBareName = buildSubmission({ audio_group: { members: instances } })

    chai.expect(isInRepeatGroup(ASSET_WITH_GROUPED_AUDIO, 'audio_group/members/notes', byFullPath)).to.equal(true)
    chai.expect(isInRepeatGroup(ASSET_WITH_GROUPED_AUDIO, 'audio_group/members/notes', byBareName)).to.equal(true)
  })

  it('is false for an answer of a regular group stored as an object', () => {
    const submission = buildSubmission({ audio_group: { 'audio_group/recording': 'clip.mp3' } })
    chai.expect(isInRepeatGroup(ASSET_WITH_GROUPED_AUDIO, 'audio_group/recording', submission)).to.equal(false)
  })

  it('is false when the submission holds a plain answer, even if the question was moved into a repeat since', () => {
    const submission = buildSubmission({ 'household/members/recording': 'old.mp3' })
    chai.expect(isInRepeatGroup(ASSET_WITH_REPEATED_AUDIO, 'household/members/recording', submission)).to.equal(false)
  })

  it('falls back to the form definition when the submission has no answer at that path', () => {
    const submission = buildSubmission()
    chai.expect(isInRepeatGroup(ASSET_WITH_REPEATED_AUDIO, 'household/members/recording', submission)).to.equal(true)
    chai.expect(isInRepeatGroup(ASSET_WITH_REPEATED_AUDIO, 'notes', submission)).to.equal(false)
  })
})
