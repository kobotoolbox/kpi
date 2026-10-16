import chai from 'chai'
import { surveyToValidJson, unnullifyTranslations } from '#/components/formBuilder/formBuilderUtils'
import { GroupTypeBeginName, GroupTypeEndName, QuestionTypeName } from '#/constants'
import type { AssetContent, SurveyChoice, SurveyRow } from '#/dataInterface'
import { type LangString, getLangAsObject, getLangString } from '#/utils'
import { Survey } from '../../jsapp/xlform/src/model.survey'

/** Languages of an asset, default first (the backend way). */
type TestLanguages = Array<string | null>

/** Asset content as the API returns it. Rows are `Partial` so fixtures can skip generated keys like `$kuid`. */
type TestAssetContent = Omit<AssetContent, 'survey' | 'choices'> & {
  survey: Array<Partial<SurveyRow>>
  choices?: Array<Partial<SurveyChoice>>
}

/** The form as the backend receives it, both XLSForm sheets with their columns already named. */
interface SavedForm {
  survey: Array<Record<string, string>>
  choices?: Array<Record<string, string>>
  settings: Array<{ default_language?: string }>
  translations?: Array<string | null>
}

const LANG_FR = getLangString({ name: 'Francais', code: 'fr' }) as LangString
const LANG_PL = getLangString({ name: 'Polski', code: 'pl' }) as LangString
const LANG_EN = getLangString({ name: 'English', code: 'en' }) as LangString
const LANG_ES = getLangString({ name: 'Espanol', code: 'es' }) as LangString
const LANG_PT = getLangString({ name: 'Portugues', code: 'pt' }) as LangString
const LANG_NONE = null

/** Stands in for a plain `label` column, which belongs to no (named) language. */
const UNNAMED = 'unnamed'

/** One label per language, each just the language code so the expectations stay readable. */
const buildLabels = (languages: TestLanguages) =>
  languages.map((language) => (language ? getLangAsObject(language)!.code : 'no lang'))

/** Content as the API returns it, with the default language set when there is one. */
const buildAssetContent = (
  languages: TestLanguages,
  survey: TestAssetContent['survey'],
  choices?: TestAssetContent['choices'],
) => {
  const content: TestAssetContent = { survey, choices, translations: languages, translated: ['label'] }
  if (languages[0]) {
    content.settings = { default_language: languages[0] }
  }
  return content
}

/** Imitates the form being opened by Formbuilder and returns the "opened" survey */
const openForm = (languages: TestLanguages) =>
  Survey.loadDict(
    buildAssetContent(languages, [{ type: QuestionTypeName.text, name: 'question', label: buildLabels(languages) }]),
  )

/** Builds a block from the Library: a group holding a select, plus its choices, so both sheets carry labels. */
const buildLibraryBlock = (languages: TestLanguages) =>
  buildAssetContent(
    languages,
    [
      { type: GroupTypeBeginName.begin_group, name: 'block', label: buildLabels(languages) },
      {
        type: QuestionTypeName.select_one,
        select_from_list_name: 'fruits',
        name: 'fruit',
        label: buildLabels(languages),
      },
      { type: GroupTypeEndName.end_group },
    ],
    [
      { list_name: 'fruits', name: 'apple', label: buildLabels(languages) },
      { list_name: 'fruits', name: 'pear', label: buildLabels(languages) },
    ],
  )

/**
 * Drags the item in the way `surveyScope.addExternalItemAtPosition()` does and returns what the backend would get.
 * Saving matters: an open form's default language has no column of its own until `unnullifyTranslations` names it.
 */
const importIntoAndSave = (host: Survey, item: TestAssetContent): SavedForm => {
  host.insertSurvey(Survey.loadDict(item, host), 0)
  const surveyJson = surveyToValidJson(host)
  // `EditableForm` reverses the hack only when there is a default language to name the columns after
  if (!host._initialParams.translations_0) {
    return JSON.parse(surveyJson)
  }
  return JSON.parse(unnullifyTranslations(surveyJson, host._initialParams))
}

/**
 * Labels of one saved row, keyed by the language in its `label::Language` column suffix - the way formpack reads
 * them. So `UNNAMED` next to named languages is exactly the state Formbuilder refuses to reopen.
 */
const getLabelsByLanguage = (saved: SavedForm, rowName: string) => {
  const row = [...saved.survey, ...(saved.choices ?? [])].find((candidate) => candidate.name === rowName)!
  return Object.fromEntries(
    Object.entries(row)
      .filter(([column]) => column === 'label' || column.startsWith('label::'))
      .map(([column, label]) => [column === 'label' ? UNNAMED : column.slice('label::'.length), label]),
  )
}

/**
 * Same, minus the languages the row says nothing in. Whether that reaches the backend as a missing column or an empty
 * one depends on the sheet, and only the "writes nothing" case below cares.
 */
const getFilledLabelsByLanguage = (saved: SavedForm, rowName: string) =>
  Object.fromEntries(Object.entries(getLabelsByLanguage(saved, rowName)).filter(([, label]) => label !== null))

// Every case checks a row from both sheets, since choices are indexed by the same language list as survey rows.
describe('importing a library item into a form', () => {
  it("ignores a single item language when the form has none of its own", () => {
    const saved = importIntoAndSave(openForm([LANG_NONE]), buildLibraryBlock([LANG_FR]))

    // An unnamed language beside named ones won't reopen, so the item's values share the unnamed slot and its name
    // for the language is dropped - naming the form's default is the user's call, on the project page.
    chai.expect(getLabelsByLanguage(saved, 'fruit')).to.deep.equal({ [UNNAMED]: 'fr' })
    chai.expect(getLabelsByLanguage(saved, 'apple')).to.deep.equal({ [UNNAMED]: 'fr' })
    chai.expect(getLabelsByLanguage(saved, 'question')).to.deep.equal({ [UNNAMED]: 'no lang' })
    chai.expect(saved.settings[0].default_language).to.be.undefined
  })

  it('degrades to the unnamed slot if a multi-language item reaches a form with no language', () => {
    // Blocked by `resolveImportLanguages` in practice; this only pins that the merge can't produce the bad mix
    const saved = importIntoAndSave(openForm([LANG_NONE]), buildLibraryBlock([LANG_FR, LANG_PL]))

    chai.expect(getLabelsByLanguage(saved, 'fruit')).to.deep.equal({ [UNNAMED]: 'fr' })
    chai.expect(getLabelsByLanguage(saved, 'apple')).to.deep.equal({ [UNNAMED]: 'fr' })
    chai.expect(saved.translations).to.be.undefined
  })

  it('leaves a form with no language alone when the item has none either', () => {
    const saved = importIntoAndSave(openForm([LANG_NONE]), buildLibraryBlock([LANG_NONE]))

    // There is no language to adopt here, so nothing gets named out of thin air
    chai.expect(getLabelsByLanguage(saved, 'fruit')).to.deep.equal({ [UNNAMED]: 'no lang' })
    chai.expect(getLabelsByLanguage(saved, 'apple')).to.deep.equal({ [UNNAMED]: 'no lang' })
    chai.expect(saved.settings[0].default_language).to.be.undefined
    chai.expect(saved.translations).to.be.undefined
  })

  it("puts a language-less item's labels in the form's default language", () => {
    const saved = importIntoAndSave(openForm([LANG_FR]), buildLibraryBlock([LANG_NONE]))

    // Already in the form's default slot - prepending the language would nullify into a second, unnamed one
    chai.expect(getLabelsByLanguage(saved, 'fruit')).to.deep.equal({ [LANG_FR]: 'no lang' })
    chai.expect(getLabelsByLanguage(saved, 'apple')).to.deep.equal({ [LANG_FR]: 'no lang' })
  })

  it("leaves the form's default language blank for an item that doesn't have it", () => {
    const saved = importIntoAndSave(openForm([LANG_FR]), buildLibraryBlock([LANG_PL]))

    // The prompt said those translations would have to be added by hand, so no copy of the item's value is invented
    chai.expect(getFilledLabelsByLanguage(saved, 'fruit')).to.deep.equal({ [LANG_PL]: 'pl' })
    chai.expect(getFilledLabelsByLanguage(saved, 'apple')).to.deep.equal({ [LANG_PL]: 'pl' })
    // The language the item brought along joins the form's own list
    chai.expect(saved.translations).to.deep.equal([LANG_FR, LANG_PL])
  })

  it('puts every item value in the slot its own language holds in the form', () => {
    const saved = importIntoAndSave(
      openForm([LANG_EN, LANG_ES, LANG_PT]),
      buildLibraryBlock([LANG_EN, LANG_ES, LANG_FR, LANG_PL]),
    )

    // Matched by name, not by position - `fr` has to skip the Portugues slot the item says nothing in
    const itemLabels = { [LANG_EN]: 'en', [LANG_ES]: 'es', [LANG_FR]: 'fr', [LANG_PL]: 'pl' }
    chai.expect(getFilledLabelsByLanguage(saved, 'fruit')).to.deep.equal(itemLabels)
    chai.expect(getFilledLabelsByLanguage(saved, 'apple')).to.deep.equal(itemLabels)
    // The form's own rows say nothing in the two languages the item added, and nothing is invented for them
    chai.expect(getFilledLabelsByLanguage(saved, 'question')).to.deep.equal({
      [LANG_EN]: 'en',
      [LANG_ES]: 'es',
      [LANG_PT]: 'pt',
    })
    chai.expect(saved.translations).to.deep.equal([LANG_EN, LANG_ES, LANG_PT, LANG_FR, LANG_PL])
  })

  it('writes no value at all for a language a row says nothing in', () => {
    const saved = importIntoAndSave(openForm([LANG_FR]), buildLibraryBlock([LANG_PL]))

    // Choices keep a null where survey rows drop the column. Same thing to the backend: formpack expands a missing
    // column to `[None] * len(translations)` (`formpack/utils/expand_content.py`).
    chai.expect(getLabelsByLanguage(saved, 'question')).to.deep.equal({ [LANG_FR]: 'fr' })
    chai.expect(getLabelsByLanguage(saved, 'fruit')).to.deep.equal({ [LANG_PL]: 'pl' })
    chai.expect(getLabelsByLanguage(saved, 'apple')).to.deep.equal({ [LANG_FR]: null, [LANG_PL]: 'pl' })
  })

  it("reorders the choices along with the survey when the item's languages are in another order", () => {
    const saved = importIntoAndSave(openForm([LANG_FR, LANG_EN]), buildLibraryBlock([LANG_EN, LANG_FR]))

    // Both sides know both languages, so every label can stay with the language it was written in.
    chai.expect(getLabelsByLanguage(saved, 'fruit')).to.deep.equal({ [LANG_FR]: 'fr', [LANG_EN]: 'en' })
    chai.expect(getLabelsByLanguage(saved, 'apple')).to.deep.equal({ [LANG_FR]: 'fr', [LANG_EN]: 'en' })
  })

  it('inserts an auto-named item that says nothing in the form default language', () => {
    const saved = importIntoAndSave(openForm([LANG_FR]), {
      survey: [
        { type: QuestionTypeName.text, $autoname: 'pytanie', label: buildLabels([LANG_PL]) },
        { type: QuestionTypeName.text, name: 'named_question', label: buildLabels([LANG_PL]) },
      ],
      translations: [LANG_PL],
      translated: ['label'],
      settings: { default_language: LANG_PL },
    })

    // A row with no `name` gets one from its label, and the French slot it leaves blank must not break that - the
    // rows after it in the block are inserted by the same loop.
    chai.expect(saved.survey.map((row) => row.name)).to.deep.equal(['pytanie', 'named_question', 'question'])
  })

  it('names every translated column the item brings along', () => {
    const saved = importIntoAndSave(openForm([LANG_FR]), {
      survey: [
        {
          type: QuestionTypeName.text,
          name: 'notes',
          label: buildLabels([LANG_FR, LANG_PL]),
          guidance_hint: ['Aide', 'Pomoc'],
        },
      ],
      translations: [LANG_FR, LANG_PL],
      translated: ['label', 'guidance_hint'],
      settings: { default_language: LANG_FR },
    })
    const row = saved.survey.find((surveyRow) => surveyRow.name === 'notes')!

    // `translated` has to grow with the item: a bare `guidance_hint` beside `guidance_hint::Polski (pl)` is unnamed
    chai.expect(row.guidance_hint).to.be.undefined
    chai.expect(row[`guidance_hint::${LANG_FR}`]).to.equal('Aide')
    chai.expect(row[`guidance_hint::${LANG_PL}`]).to.equal('Pomoc')
  })
})
