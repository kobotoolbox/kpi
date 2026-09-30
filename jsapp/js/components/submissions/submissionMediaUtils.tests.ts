import { QuestionTypeName } from '#/constants'
import type { SubmissionAttachment } from '#/dataInterface'
import assetDataFactory from '#/endpoints/assetData.factory'
import {
  findAttachmentByQuestionXpath,
  findAttachmentByQuestionXpaths,
  inferAttachmentQuestionType,
} from './submissionMediaUtils'

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

// One column stands for every path a moved question had, and each submission files its file
// under its own version's path, so the column has to look under all of them.
describe('findAttachmentByQuestionXpaths', () => {
  const currentPath = 'a_group/Photo_question'
  const legacyPath = 'Photo_question'

  it('should find the attachment of a submission made against the current form version', () => {
    const attachment = buildAttachment({ question_xpath: currentPath })
    const submission = assetDataFactory(1, { [currentPath]: 'photo.jpg', _attachments: [attachment] })
    chai.expect(findAttachmentByQuestionXpaths(submission, [currentPath, legacyPath])).to.deep.equal(attachment)
  })

  it('should find the attachment of a submission made before the question moved', () => {
    const attachment = buildAttachment({ question_xpath: legacyPath })
    const submission = assetDataFactory(1, { [legacyPath]: 'photo.jpg', _attachments: [attachment] })
    chai.expect(findAttachmentByQuestionXpaths(submission, [currentPath, legacyPath])).to.deep.equal(attachment)
  })

  // Both files stay on a record edited across the move, and the current path is the one
  // the form asks for now, so it is passed first and has to win.
  it('should prefer the earlier path in the list when the submission has files under both', () => {
    const currentAttachment = buildAttachment({ question_xpath: currentPath, uid: 'current' })
    const legacyAttachment = buildAttachment({ question_xpath: legacyPath, uid: 'legacy' })
    const submission = assetDataFactory(1, {
      [currentPath]: 'photo.jpg',
      [legacyPath]: 'photo.jpg',
      _attachments: [legacyAttachment, currentAttachment],
    })
    chai.expect(findAttachmentByQuestionXpaths(submission, [currentPath, legacyPath])).to.deep.equal(currentAttachment)
  })

  it('should return undefined when none of the paths has an attachment', () => {
    const submission = assetDataFactory(1, { Other_question: 'photo.jpg', _attachments: [buildAttachment()] })
    chai
      .expect(findAttachmentByQuestionXpaths(submission, ['Other_question', 'a_group/Other_question']))
      .to.equal(undefined)
  })

  it('should return undefined when given no paths at all', () => {
    const submission = assetDataFactory(1, { Photo_question: 'photo.jpg', _attachments: [buildAttachment()] })
    chai.expect(findAttachmentByQuestionXpaths(submission, [])).to.equal(undefined)
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
