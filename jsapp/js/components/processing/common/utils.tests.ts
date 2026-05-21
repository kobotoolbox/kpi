import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import { getSuggestedLanguages } from './utils'

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
