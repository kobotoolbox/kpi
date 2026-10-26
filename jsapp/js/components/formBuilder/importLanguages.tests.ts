import chai from 'chai'
import type { AssetContent } from '#/dataInterface'
import { discardAssetLanguages, getFormLanguages, resolveImportLanguages } from './importLanguages'

/**
 * Untyped rows, so a fixture can say only what its case is about - including a plain string `label`, which a
 * single-language asset really has but the row types don't model. `libraryImport.tests.ts` has a stricter twin.
 */
type LooseAssetContent = Omit<AssetContent, 'survey' | 'choices'> & {
  survey: Array<Record<string, unknown>>
  choices?: Array<Record<string, unknown>>
}

const EN = 'English (en)'
const ES = 'Español (es)'
const FR = 'Français (fr)'
const PL = 'Polski (pl)'
const PT = 'Português (pt)'

// One case per row of the decision table in the ticket, plus the rows it leaves blank.
describe('resolveImportLanguages', () => {
  it('merges when neither the form nor the asset names a language', () => {
    chai.expect(resolveImportLanguages([null], [null])).to.deep.equal({ action: 'merge' })
  })

  it("merges a single asset language into a form that has none, ignoring the asset's name for it", () => {
    // Both sides keep their values in the one unnamed slot, so they already line up - only the name is dropped
    chai.expect(resolveImportLanguages([null], [FR])).to.deep.equal({ action: 'merge' })
  })

  it('blocks an asset with several languages when the form has none', () => {
    // Which of the asset's languages would become the form's default? Only the user can answer that.
    chai.expect(resolveImportLanguages([null], [FR, PL])).to.deep.equal({ action: 'block' })
  })

  it('asks to continue when the form and the asset each have one language and they differ', () => {
    chai.expect(resolveImportLanguages([EN], [ES])).to.deep.equal({ action: 'confirm-add', languagesToAdd: [ES] })
  })

  it('asks to add or discard when one of several asset languages fits the form', () => {
    chai.expect(resolveImportLanguages([EN], [EN, ES, FR])).to.deep.equal({
      action: 'add-or-discard',
      languagesToAdd: [ES, FR],
    })
  })

  it('asks to add or discard when several asset languages fit a multi-language form', () => {
    chai.expect(resolveImportLanguages([EN, ES], [EN, ES, FR])).to.deep.equal({
      action: 'add-or-discard',
      languagesToAdd: [FR],
    })
  })

  it('asks to continue when a multi-language asset has nothing in common with a multi-language form', () => {
    chai.expect(resolveImportLanguages([EN, ES], [FR, PL])).to.deep.equal({
      action: 'confirm-add',
      languagesToAdd: [FR, PL],
    })
  })

  it('merges silently when the asset brings nothing the form is missing', () => {
    // The ticket leaves this row blank; there is nothing to ask about, so it is a plain merge.
    chai.expect(resolveImportLanguages([EN, ES], [EN])).to.deep.equal({ action: 'merge' })
    chai.expect(resolveImportLanguages([EN], [EN])).to.deep.equal({ action: 'merge' })
    chai.expect(resolveImportLanguages([EN, ES], [ES, EN])).to.deep.equal({ action: 'merge' })
  })

  it("merges a language-less asset into the form's default slot", () => {
    // Not in the table - this is the behavior that was already there, and it stays
    chai.expect(resolveImportLanguages([EN, ES], [null])).to.deep.equal({ action: 'merge' })
    chai.expect(resolveImportLanguages([EN], undefined)).to.deep.equal({ action: 'merge' })
  })
})

describe('getFormLanguages', () => {
  it('fills the nullified first slot back in', () => {
    chai.expect(getFormLanguages({ translations: [null, ES], translations_0: EN })).to.deep.equal([EN, ES])
  })

  it('reports a form that has never named a language as having none', () => {
    chai.expect(getFormLanguages({ translations: [null] })).to.deep.equal([null])
    // A brand new form in the Formbuilder has no `_initialParams` worth speaking of
    chai.expect(getFormLanguages({})).to.deep.equal([null])
  })
})

describe('discardAssetLanguages', () => {
  it('drops the given languages from the list and from every translated value in both sheets', () => {
    const content: LooseAssetContent = {
      survey: [{ name: 'fruit', label: ['en', 'es', 'fr'], hint: ['en hint', 'es hint', 'fr hint'] }],
      choices: [{ list_name: 'fruits', name: 'apple', label: ['en', 'es', 'fr'] }],
      translations: [EN, ES, FR],
      translated: ['label', 'hint'],
    }

    discardAssetLanguages(content as AssetContent, [ES, FR])

    chai.expect(content.translations).to.deep.equal([EN])
    chai.expect(content.survey[0].label).to.deep.equal(['en'])
    chai.expect(content.survey[0].hint).to.deep.equal(['en hint'])
    chai.expect(content.choices?.[0].label).to.deep.equal(['en'])
  })

  it('keeps the values of the languages it was not asked to discard, whatever their order', () => {
    const content: LooseAssetContent = {
      survey: [{ name: 'fruit', label: ['fr', 'en', 'es'] }],
      translations: [FR, EN, ES],
      translated: ['label'],
    }

    discardAssetLanguages(content as AssetContent, [EN])

    chai.expect(content.translations).to.deep.equal([FR, ES])
    chai.expect(content.survey[0].label).to.deep.equal(['fr', 'es'])
  })

  it('leaves a row alone when its translated value is a plain string', () => {
    const content: LooseAssetContent = {
      survey: [{ name: 'fruit', label: 'just one' }],
      translations: [EN],
      translated: ['label'],
    }

    discardAssetLanguages(content as AssetContent, [PT])

    chai.expect(content.survey[0].label).to.equal('just one')
    chai.expect(content.translations).to.deep.equal([EN])
  })
})
