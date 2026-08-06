import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { SupplementalDataManualTranscription } from '#/api/models/supplementalDataManualTranscription'
import type { SupplementalDataVersionItemManual } from '#/api/models/supplementalDataVersionItemManual'
import { getSuggestedLanguages, getTranslationSourceLanguage } from './utils'

// Mock AdvancedFeatureResponse objects for tests
const BASE: AdvancedFeatureResponse = {
  question_xpath: 'some_xpath',
  action: 'automatic_google_translation',
  uid: 'uid-1',
  params: [],
} as const

const EMPTY_PARAMS_RESPONSE: AdvancedFeatureResponse = {
  ...BASE,
  params: [],
}

const SINGLE_LANGUAGE_EN_RESPONSE: AdvancedFeatureResponse = {
  ...BASE,
  params: [{ language: 'en' }],
}

const MULTI_LANGUAGE_EN_FR_RESPONSE: AdvancedFeatureResponse = {
  ...BASE,
  params: [{ language: 'en' }, { language: 'fr' }],
}

const MULTI_LANGUAGE_FR_ES_RESPONSE: AdvancedFeatureResponse = {
  ...BASE,
  params: [{ language: 'fr' }, { language: 'es' }],
}

// Non-language param (e.g. ResponseAutomaticQualActionParams)
const NON_LANGUAGE_PARAM = { uuid: 'some-uuid' }

const PARAMS_WITHOUT_LANGUAGE_RESPONSE: AdvancedFeatureResponse = {
  ...BASE,
  params: [NON_LANGUAGE_PARAM, { language: 'de' }],
}

const PARAMS_EMPTY_OBJECT_RESPONSE: AdvancedFeatureResponse = {
  ...BASE,
  params: [NON_LANGUAGE_PARAM],
}

describe('getSuggestedLanguages', () => {
  it('returns an empty array for empty input', () => {
    chai.expect(getSuggestedLanguages([])).to.deep.equal([])
  })

  it('returns a single language from one AdvancedFeatureResponse', () => {
    chai.expect(getSuggestedLanguages([SINGLE_LANGUAGE_EN_RESPONSE])).to.deep.equal(['en'])
  })

  it('returns unique languages from multiple AdvancedFeatureResponse objects', () => {
    const input = [MULTI_LANGUAGE_EN_FR_RESPONSE, MULTI_LANGUAGE_FR_ES_RESPONSE]
    chai.expect(getSuggestedLanguages(input).sort()).to.deep.equal(['en', 'fr', 'es'].sort())
  })

  it('ignores params without a language property', () => {
    const input = [PARAMS_WITHOUT_LANGUAGE_RESPONSE, PARAMS_EMPTY_OBJECT_RESPONSE]
    chai.expect(getSuggestedLanguages(input)).to.deep.equal(['de'])
  })

  it('handles no params in AdvancedFeatureResponse', () => {
    chai.expect(getSuggestedLanguages([EMPTY_PARAMS_RESPONSE])).to.deep.equal([])
  })
})

const XPATH = 'audio_question'

/** Builds a transcript version. Pass `dateAccepted: ''` for a version still awaiting review. */
function buildTranscriptVersion(options: {
  uuid: string
  language: string
  dateCreated: string
  dateAccepted: string
  value?: string | null
}): SupplementalDataVersionItemManual {
  return {
    _uuid: options.uuid,
    _dateCreated: options.dateCreated,
    _dateAccepted: options.dateAccepted,
    _data: {
      language: options.language,
      value: options.value === undefined ? 'Some transcribed text' : options.value,
    },
  }
}

/**
 * Wraps transcript versions in the `manual_transcription` shape of a supplement response. Pass no versions to get a
 * supplement with no transcription action at all (`_versions` is never legitimately empty - the API requires at least
 * one entry).
 */
function buildSupplement(versions: SupplementalDataVersionItemManual[]): DataSupplementResponse {
  const actions: Record<string, { manual_transcription: SupplementalDataManualTranscription }> = versions.length
    ? {
        [XPATH]: {
          manual_transcription: {
            _dateCreated: '2026-01-01T00:00:00Z',
            _dateModified: '2026-01-01T00:00:00Z',
            _versions: versions,
          },
        },
      }
    : {}

  // `DataSupplementResponse` is `{_version: string} & Record<string, SupplementalDataResponseAction>`, so `_version`
  // would have to be a string *and* an action object at once. No literal can satisfy that, hence the assertion. The
  // parts we actually assert on are fully typed above, so a wrong version or transcription shape still fails to compile.
  return { _version: '1', ...actions } as DataSupplementResponse
}

describe('getTranslationSourceLanguage', () => {
  it('returns undefined when there are no transcripts at all', () => {
    chai.expect(getTranslationSourceLanguage(buildSupplement([]), XPATH)).to.equal(undefined)
  })

  it('returns the language of the only accepted transcript', () => {
    const supplement = buildSupplement([
      buildTranscriptVersion({
        uuid: 'v1',
        language: 'en',
        dateCreated: '2026-01-01T10:00:00Z',
        dateAccepted: '2026-01-01T11:00:00Z',
      }),
    ])
    chai.expect(getTranslationSourceLanguage(supplement, XPATH)).to.equal('en')
  })

  it('ignores transcripts that were never accepted', () => {
    const supplement = buildSupplement([
      buildTranscriptVersion({
        uuid: 'v1',
        language: 'en',
        dateCreated: '2026-01-01T10:00:00Z',
        dateAccepted: '2026-01-01T11:00:00Z',
      }),
      // Newer, but still awaiting review, so the back end would not translate from it.
      buildTranscriptVersion({ uuid: 'v2', language: 'fr', dateCreated: '2026-01-02T10:00:00Z', dateAccepted: '' }),
    ])
    chai.expect(getTranslationSourceLanguage(supplement, XPATH)).to.equal('en')
  })

  it('returns undefined when no transcript has been accepted', () => {
    const supplement = buildSupplement([
      buildTranscriptVersion({ uuid: 'v1', language: 'en', dateCreated: '2026-01-01T10:00:00Z', dateAccepted: '' }),
    ])
    chai.expect(getTranslationSourceLanguage(supplement, XPATH)).to.equal(undefined)
  })

  it('picks the most recently accepted transcript, not the most recently created one', () => {
    const supplement = buildSupplement([
      // Created first but accepted last, which is what the back end translates from.
      buildTranscriptVersion({
        uuid: 'v1',
        language: 'en',
        dateCreated: '2026-01-01T10:00:00Z',
        dateAccepted: '2026-01-03T10:00:00Z',
      }),
      buildTranscriptVersion({
        uuid: 'v2',
        language: 'fr',
        dateCreated: '2026-01-02T10:00:00Z',
        dateAccepted: '2026-01-02T11:00:00Z',
      }),
    ])
    chai.expect(getTranslationSourceLanguage(supplement, XPATH)).to.equal('en')
  })

  it('ignores accepted transcripts that have no value left', () => {
    const supplement = buildSupplement([
      buildTranscriptVersion({
        uuid: 'v1',
        language: 'en',
        dateCreated: '2026-01-01T10:00:00Z',
        dateAccepted: '2026-01-01T11:00:00Z',
      }),
      // Deleted transcripts keep their acceptance date but lose the text.
      buildTranscriptVersion({
        uuid: 'v2',
        language: 'fr',
        dateCreated: '2026-01-02T10:00:00Z',
        dateAccepted: '2026-01-02T11:00:00Z',
        value: null,
      }),
    ])
    chai.expect(getTranslationSourceLanguage(supplement, XPATH)).to.equal('en')
  })
})
