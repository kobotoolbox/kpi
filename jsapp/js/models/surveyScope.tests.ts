// Covers what `addExternalItemAtPosition()` does with the answer it gets back, which the language and save tests
// can't see: they call the merge directly and never go through the dialog.

var mockedAssetsRetrieve: jest.Mock
var mockedOpenImportLanguagesModal: jest.Mock
var mockedLoadDict: jest.Mock
var mockedNotify: jest.Mock

jest.mock('#/api/react-query/manage-projects-and-library-content', () => {
  mockedAssetsRetrieve = jest.fn()
  return { assetsRetrieve: mockedAssetsRetrieve }
})

jest.mock('#/components/formBuilder/ImportLanguagesModals/openImportLanguagesModal', () => {
  mockedOpenImportLanguagesModal = jest.fn()
  return { openImportLanguagesModal: mockedOpenImportLanguagesModal }
})

// The real one drags in Backbone views. What matters here is the content handed to it, and that its result is the
// thing inserted.
jest.mock('../../xlform/src/_xlform.init', () => {
  mockedLoadDict = jest.fn().mockReturnValue({ loaded: 'survey' })
  return { __esModule: true, default: { model: { Survey: { loadDict: mockedLoadDict } } } }
})

// Only `notify` is swapped out - the rest of `#/utils` is used by the merge this flow runs for real
jest.mock('#/utils', () => {
  mockedNotify = jest.fn()
  return { ...jest.requireActual('#/utils'), notify: mockedNotify }
})

import { QuestionTypeName } from '#/constants'
import type { AssetContent } from '#/dataInterface'
import type { Survey } from '../../xlform/src/model.survey'
import SurveyScope from './surveyScope'

const EN = 'English (en)'
const FR = 'Français (fr)'
const PL = 'Polski (pl)'

/** Just enough of an open form for the import path: the languages it knows, and somewhere to insert. */
const buildHostSurvey = (translations: Array<string | null>, translations_0?: string) =>
  ({
    _initialParams: { translations, translations_0 },
    insertSurvey: jest.fn(),
  }) as unknown as Survey & { insertSurvey: jest.Mock }

const buildAssetContent = (translations: Array<string | null>): AssetContent => ({
  survey: [
    {
      $kuid: 'q1',
      type: QuestionTypeName.text,
      name: 'fruit',
      label: translations.map((_language, index) => `label ${index}`),
    },
  ],
  translations,
  translated: ['label'],
})

/** Drops a library asset on the form and waits for the whole flow, dialog answer included. */
const dropAsset = async (host: Survey, content: AssetContent, onManageLanguages?: () => void) => {
  mockedAssetsRetrieve.mockResolvedValue({ data: { content } })
  const scope = new SurveyScope({ survey: host, assetType: null, onManageLanguages })
  await scope.addExternalItemAtPosition(0, 'aUid')
}

describe('SurveyScope.addExternalItemAtPosition', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedLoadDict.mockReturnValue({ loaded: 'survey' })
  })

  it('asks nothing and inserts when the languages already agree', async () => {
    const host = buildHostSurvey([null, PL], EN)

    await dropAsset(host, buildAssetContent([EN, PL]))

    chai.expect(mockedOpenImportLanguagesModal.mock.calls).to.have.length(0)
    chai.expect(host.insertSurvey.mock.calls).to.have.length(1)
  })

  it('inserts nothing when the dialog is dismissed', async () => {
    mockedOpenImportLanguagesModal.mockResolvedValue('cancel')
    const host = buildHostSurvey([null], EN)

    await dropAsset(host, buildAssetContent([FR, PL]))

    chai.expect(mockedOpenImportLanguagesModal.mock.calls).to.have.length(1)
    chai.expect(host.insertSurvey.mock.calls).to.have.length(0)
    chai.expect(mockedLoadDict.mock.calls).to.have.length(0)
  })

  it('hands over to the language settings instead of inserting', async () => {
    mockedOpenImportLanguagesModal.mockResolvedValue('manage-languages')
    const onManageLanguages = jest.fn()
    const host = buildHostSurvey([null], undefined)

    await dropAsset(host, buildAssetContent([FR, PL]), onManageLanguages)

    chai.expect(onManageLanguages.mock.calls).to.have.length(1)
    chai.expect(host.insertSurvey.mock.calls).to.have.length(0)
  })

  it('inserts every language the asset brought when the user continues', async () => {
    mockedOpenImportLanguagesModal.mockResolvedValue('proceed')
    const host = buildHostSurvey([null], EN)

    await dropAsset(host, buildAssetContent([FR, PL]))

    chai.expect(mockedLoadDict.mock.calls[0][0].translations).to.deep.equal([FR, PL])
    chai.expect(host.insertSurvey.mock.calls[0][0]).to.deep.equal({ loaded: 'survey' })
  })

  it('strips the languages the form lacks before inserting a discarded answer', async () => {
    mockedOpenImportLanguagesModal.mockResolvedValue('discard')
    const host = buildHostSurvey([null, FR], EN)

    await dropAsset(host, buildAssetContent([EN, FR, PL]))

    // `PL` was the only one the form didn't have, so only its values and its name go
    const content = mockedLoadDict.mock.calls[0][0]
    chai.expect(content.translations).to.deep.equal([EN, FR])
    chai.expect(content.survey[0].label).to.deep.equal(['label 0', 'label 1'])
    chai.expect(host.insertSurvey.mock.calls).to.have.length(1)
  })

  it('reports a failed fetch instead of rejecting', async () => {
    mockedAssetsRetrieve.mockRejectedValue(new Error('nope'))
    const host = buildHostSurvey([null], EN)
    const scope = new SurveyScope({ survey: host, assetType: null })

    await scope.addExternalItemAtPosition(0, 'aUid')

    chai.expect(mockedNotify.mock.calls).to.have.length(1)
    chai.expect(host.insertSurvey.mock.calls).to.have.length(0)
  })
})
