import { QuestionTypeName } from '#/constants'
import type { SubmissionAttachment } from '#/dataInterface'
import assetDataFactory from '#/endpoints/assetData.factory'
import { findAttachmentByQuestionXpath, inferAttachmentQuestionType, stripRepeatIndices } from './submissionMediaUtils'

describe('stripRepeatIndices', () => {
  it('should leave a static xpath unchanged', () => {
    chai.expect(stripRepeatIndices('outer_group/inner_group/question')).to.equal('outer_group/inner_group/question')
  })

  it('should strip a single repeat-instance index', () => {
    chai.expect(stripRepeatIndices('children[1]/audio')).to.equal('children/audio')
  })

  it('should strip multiple repeat-instance indices from nested repeats', () => {
    chai.expect(stripRepeatIndices('outer[2]/inner[10]/question')).to.equal('outer/inner/question')
  })

  it('should leave a bare question name unchanged', () => {
    chai.expect(stripRepeatIndices('question')).to.equal('question')
  })
})

function buildAttachment(overrides: Partial<SubmissionAttachment> = {}): SubmissionAttachment {
  return {
    download_url: 'http://kc.kobo.local/media/original?media_file=photo.jpg',
    mimetype: 'image/jpeg',
    filename: 'kobo/attachments/mock/photo.jpg',
    media_file_basename: 'photo.jpg',
    question_xpath: 'Photo_question',
    uid: 'mock-attachment-uid',
    ...overrides,
  }
}

describe('findAttachmentByQuestionXpath', () => {
  it('should find the attachment recorded for given question path', () => {
    const attachment = buildAttachment()
    const submission = assetDataFactory(1, { Photo_question: 'photo.jpg', _attachments: [attachment] })
    chai.expect(findAttachmentByQuestionXpath(submission, 'Photo_question')).to.deep.equal(attachment)
  })

  // The whole point of matching on `question_xpath`: it is the path as recorded
  // at submission time, so it outlives renames in later form versions.
  it('should find the attachment of a question that was renamed after the submission came in', () => {
    const attachment = buildAttachment({ question_xpath: 'Photo_question_v1' })
    const submission = assetDataFactory(1, { Photo_question_v1: 'photo.jpg', _attachments: [attachment] })
    chai.expect(findAttachmentByQuestionXpath(submission, 'Photo_question_v1')).to.deep.equal(attachment)
  })

  it('should tell apart two questions holding files with the same basename', () => {
    const firstAttachment = buildAttachment({ question_xpath: 'Photo_one', uid: 'first' })
    const secondAttachment = buildAttachment({ question_xpath: 'Photo_two', uid: 'second' })
    const submission = assetDataFactory(1, {
      Photo_one: 'photo.jpg',
      Photo_two: 'photo.jpg',
      _attachments: [firstAttachment, secondAttachment],
    })
    chai.expect(findAttachmentByQuestionXpath(submission, 'Photo_two')).to.deep.equal(secondAttachment)
  })

  it('should return undefined when no attachment was recorded for given path', () => {
    const submission = assetDataFactory(1, { Photo_question: 'photo.jpg', _attachments: [buildAttachment()] })
    chai.expect(findAttachmentByQuestionXpath(submission, 'Some_other_question')).to.equal(undefined)
  })

  it('should return undefined for a submission with no attachments', () => {
    chai.expect(findAttachmentByQuestionXpath(assetDataFactory(1), 'Photo_question')).to.equal(undefined)
  })
})

describe('inferAttachmentQuestionType', () => {
  it('should recognize audio files', () => {
    chai.expect(inferAttachmentQuestionType({ mimetype: 'audio/mp3' })).to.equal(QuestionTypeName.audio)
    chai.expect(inferAttachmentQuestionType({ mimetype: 'audio/x-m4a' })).to.equal(QuestionTypeName.audio)
    // Ogg audio arrives with a generic container mimetype, and we play it as audio.
    chai.expect(inferAttachmentQuestionType({ mimetype: 'application/ogg' })).to.equal(QuestionTypeName.audio)
  })

  it('should recognize image files', () => {
    chai.expect(inferAttachmentQuestionType({ mimetype: 'image/jpeg' })).to.equal(QuestionTypeName.image)
  })

  it('should recognize video files', () => {
    chai.expect(inferAttachmentQuestionType({ mimetype: 'video/mp4' })).to.equal(QuestionTypeName.video)
  })

  it('should treat anything else as a file question response', () => {
    chai.expect(inferAttachmentQuestionType({ mimetype: 'application/pdf' })).to.equal(QuestionTypeName.file)
    chai.expect(inferAttachmentQuestionType({ mimetype: 'text/csv' })).to.equal(QuestionTypeName.file)
  })

  it('should return undefined when there is no mimetype to go by', () => {
    chai.expect(inferAttachmentQuestionType({ mimetype: '' })).to.equal(undefined)
    chai.expect(inferAttachmentQuestionType({ mimetype: undefined as unknown as string })).to.equal(undefined)
  })
})
