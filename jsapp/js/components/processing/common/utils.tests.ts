import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { SupplementalDataManualTranscription } from '#/api/models/supplementalDataManualTranscription'
import type { SupplementalDataVersionItemManual } from '#/api/models/supplementalDataVersionItemManual'
import { getBlockedTargetLanguages, getSuggestedLanguages, getTranslationSourceLanguages } from './utils'

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
  locale?: string
  value?: string | null
}): SupplementalDataVersionItemManual {
  return {
    _uuid: options.uuid,
    _dateCreated: options.dateCreated,
    _dateAccepted: options.dateAccepted,
    _data: {
      language: options.language,
      locale: options.locale,
      value: options.value === undefined ? 'Some transcribed text' : options.value,
    },
  }
}

/**
 * Wraps transcript versions in the `manual_transcription` shape of a supplement response. Pass no versions to get a
 * supplement with no transcription action at all, rather than one holding an empty `_versions` - the API requires at
 * least one entry there, so an empty list is a state that never occurs.
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

  // `DataSupplementResponse` is `{_version: string} & Record<string, SupplementalDataResponseAction>`, which asks
  // `_version` to be a string *and* an action object at the same time. No literal can satisfy that, hence the
  // assertion. Everything the tests read is typed above it, so a wrong transcription shape still fails to compile.
  return { _version: '1', ...actions } as DataSupplementResponse
}

describe('getBlockedTargetLanguages', () => {
  it('blocks just the language when there is no locale', () => {
    chai.expect(getBlockedTargetLanguages('en')).to.deep.equal(['en'])
  })

  it('blocks both a locale and its base language', () => {
    chai.expect(getBlockedTargetLanguages('en', 'en-CA')).to.deep.equal(['en-CA', 'en'])
  })

  it('blocks the locale over the language, since the back end translates from the locale', () => {
    // Nothing checks `locale` against `language`, so this mismatched pair can be stored and would be translated from
    // French. Blocking only `es` would leave `fr` pickable and bring the empty column back.
    chai.expect(getBlockedTargetLanguages('es', 'fr-CA')).to.deep.equal(['fr-CA', 'fr'])
  })

  it('treats an empty locale as absent', () => {
    chai.expect(getBlockedTargetLanguages('en', '')).to.deep.equal(['en'])
    chai.expect(getBlockedTargetLanguages('en', null)).to.deep.equal(['en'])
  })
})

describe('getTranslationSourceLanguages', () => {
  it('returns nothing when there are no transcripts at all', () => {
    chai.expect(getTranslationSourceLanguages(buildSupplement([]), XPATH)).to.deep.equal([])
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
    chai.expect(getTranslationSourceLanguages(supplement, XPATH)).to.deep.equal(['en'])
  })

  it('ignores transcripts that were never accepted', () => {
    const supplement = buildSupplement([
      buildTranscriptVersion({
        uuid: 'v1',
        language: 'en',
        dateCreated: '2026-01-01T10:00:00Z',
        dateAccepted: '2026-01-01T11:00:00Z',
      }),
      // Newer, but still awaiting review, so the back end would not translate from it yet.
      buildTranscriptVersion({ uuid: 'v2', language: 'fr', dateCreated: '2026-01-02T10:00:00Z', dateAccepted: '' }),
    ])
    chai.expect(getTranslationSourceLanguages(supplement, XPATH)).to.deep.equal(['en'])
  })

  it('returns nothing when no transcript has been accepted', () => {
    const supplement = buildSupplement([
      buildTranscriptVersion({ uuid: 'v1', language: 'en', dateCreated: '2026-01-01T10:00:00Z', dateAccepted: '' }),
    ])
    chai.expect(getTranslationSourceLanguages(supplement, XPATH)).to.deep.equal([])
  })

  it('picks the most recently accepted transcript, not the most recently created one', () => {
    const supplement = buildSupplement([
      // Created first but accepted last, so this is the one the back end translates from.
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
    chai.expect(getTranslationSourceLanguages(supplement, XPATH)).to.deep.equal(['en'])
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
    chai.expect(getTranslationSourceLanguages(supplement, XPATH)).to.deep.equal(['en'])
  })

  it("blocks the source transcript's locale and its base language", () => {
    const supplement = buildSupplement([
      buildTranscriptVersion({
        uuid: 'v1',
        language: 'en',
        locale: 'en-CA',
        dateCreated: '2026-01-01T10:00:00Z',
        dateAccepted: '2026-01-01T11:00:00Z',
      }),
    ])
    chai.expect(getTranslationSourceLanguages(supplement, XPATH)).to.deep.equal(['en-CA', 'en'])
  })

  it('blocks the locale even when it disagrees with the language', () => {
    const supplement = buildSupplement([
      buildTranscriptVersion({
        uuid: 'v1',
        language: 'es',
        locale: 'fr-CA',
        dateCreated: '2026-01-01T10:00:00Z',
        dateAccepted: '2026-01-01T11:00:00Z',
      }),
    ])
    chai.expect(getTranslationSourceLanguages(supplement, XPATH)).to.deep.equal(['fr-CA', 'fr'])
  })
})
