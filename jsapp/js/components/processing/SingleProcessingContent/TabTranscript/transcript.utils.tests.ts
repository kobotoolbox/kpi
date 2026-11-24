import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import { getEstimatedTranscriptionDurationSeconds } from '#/utils'
import { buildAutomaticTranscriptSupplement, buildAutomaticTranscriptVersion } from './transcript.mocks'
import { getTranscriptionProgress, secondsToTranscriptionEstimate } from './transcript.utils'

const XPATH = 'audio_question'
// Transcribing these is estimated at 53 s and 449 s.
const TEN_MINUTES = 600
const TWO_HOURS = 7200

describe('secondsToTranscriptionEstimate', () => {
  const cases = [
    { audioSeconds: 0, estimateSeconds: 17, wording: 'about a minute' },
    { audioSeconds: TEN_MINUTES, estimateSeconds: 53, wording: 'about a minute' },
    { audioSeconds: 767, estimateSeconds: 63, wording: 'about 2 minutes' },
    { audioSeconds: TWO_HOURS, estimateSeconds: 449, wording: 'about 8 minutes' },
  ]

  for (const { audioSeconds, estimateSeconds, wording } of cases) {
    it(`rounds a ${estimateSeconds} s estimate up to "${wording}"`, () => {
      chai.expect(getEstimatedTranscriptionDurationSeconds(audioSeconds)).to.equal(estimateSeconds)
      chai.expect(secondsToTranscriptionEstimate(audioSeconds)).to.equal(wording)
    })
  }
})

describe('getTranscriptionProgress', () => {
  const started = buildAutomaticTranscriptVersion('2026-01-01T10:00:00Z')

  it('reports the percentage from the elapsed backend time', () => {
    chai
      .expect(
        getTranscriptionProgress(
          buildAutomaticTranscriptSupplement(XPATH, '2026-01-01T10:00:30Z', [started]),
          XPATH,
          TEN_MINUTES,
        ),
      )
      .to.deep.equal({ percent: 56, isOverdue: false })
    chai
      .expect(
        getTranscriptionProgress(
          buildAutomaticTranscriptSupplement(XPATH, '2026-01-01T10:05:00Z', [started]),
          XPATH,
          TWO_HOURS,
        ),
      )
      .to.deep.equal({ percent: 66, isOverdue: false })
    chai
      .expect(
        getTranscriptionProgress(
          buildAutomaticTranscriptSupplement(XPATH, '2026-01-01T10:08:00Z', [started]),
          XPATH,
          TWO_HOURS,
        ),
      )
      .to.deep.equal({ percent: 99, isOverdue: true })
  })

  it('never reaches 100% at exactly the estimate', () => {
    chai
      .expect(
        getTranscriptionProgress(
          buildAutomaticTranscriptSupplement(XPATH, '2026-01-01T10:00:53Z', [started]),
          XPATH,
          TEN_MINUTES,
        ),
      )
      .to.deep.equal({ percent: 99, isOverdue: false })
  })

  it('counts from the latest version, not the action or older versions', () => {
    const older = buildAutomaticTranscriptVersion('2026-01-01T09:00:00Z', 'complete')
    const supplement = buildAutomaticTranscriptSupplement(
      XPATH,
      '2026-01-01T10:00:30Z',
      [older, started],
      '2026-01-01T08:00:00Z',
    )
    chai.expect(getTranscriptionProgress(supplement, XPATH, TEN_MINUTES)?.percent).to.equal(56)
  })

  it('returns undefined without an automatic transcript', () => {
    chai.expect(getTranscriptionProgress({ _version: '1' } as DataSupplementResponse, XPATH, TEN_MINUTES)).to.be
      .undefined
  })
})
