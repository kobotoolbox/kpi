import chai from 'chai'
import { MAX_AUTOMATIC_TRANSCRIPTION_AUDIO_MINUTES } from '../../common/constants'
import { isAudioTooLongForAutomaticTranscription } from './transcript.utils'

const LIMIT_SECONDS = MAX_AUTOMATIC_TRANSCRIPTION_AUDIO_MINUTES * 60

describe('isAudioTooLongForAutomaticTranscription', () => {
  it('passes audio shorter than the limit', () => {
    chai.expect(isAudioTooLongForAutomaticTranscription(LIMIT_SECONDS - 1)).to.equal(false)
  })

  it('passes audio exactly at the limit', () => {
    chai.expect(isAudioTooLongForAutomaticTranscription(LIMIT_SECONDS)).to.equal(false)
  })

  it('rejects audio over the limit', () => {
    chai.expect(isAudioTooLongForAutomaticTranscription(LIMIT_SECONDS + 1)).to.equal(true)
    chai.expect(isAudioTooLongForAutomaticTranscription(60 * 61)).to.equal(true)
  })

  it('passes a length of zero, so an audio we could not measure does not block anyone', () => {
    chai.expect(isAudioTooLongForAutomaticTranscription(0)).to.equal(false)
  })
})
