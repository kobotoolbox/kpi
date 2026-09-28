import chai from 'chai'
import { surveyToValidJson, unnullifyTranslations } from '#/components/formBuilder/formBuilderUtils'
import { GroupTypeBeginName, GroupTypeEndName, QuestionTypeName } from '#/constants'
import type { AssetContent, SurveyChoice, SurveyRow } from '#/dataInterface'
import { type LangString, getLangAsObject, getLangString } from '#/utils'
import { Survey } from '../../jsapp/xlform/src/model.survey'

/** Languages of an asset, default first (the backend way). */
type TestLanguages = Array<string | null>

/**
 * Asset content as the API returns it, before `inputParser` gets to it. Rows are `Partial` so the fixtures below can
 * leave out the keys the parser generates for itself, like `$kuid`.
 */
type TestAssetContent = Omit<AssetContent, 'survey' | 'choices'> & {
  survey: Array<Partial<SurveyRow>>
  choices?: Array<Partial<SurveyChoice>>
}

/** The form as the backend receives it, both XLSForm sheets with their columns already named. */
interface SavedForm {
  survey: Array<Record<string, string>>
  choices?: Array<Record<string, string>>
  settings: Array<{ default_language?: string }>
}

const LANG_FR = getLangString({ name: 'Francais', code: 'fr' }) as LangString
const LANG_PL = getLangString({ name: 'Polski', code: 'pl' }) as LangString
const LANG_EN = getLangString({ name: 'English', code: 'en' }) as LangString
const LANG_NONE = null

/** Stands in for a plain `label` column, which belongs to no (named) language. */
const UNNAMED = 'unnamed'

/** Generates one label per language. Each label is just the language code to make it easier to test things. */
const buildLabels = (languages: TestLanguages) =>
  languages.map((language) => (language ? getLangAsObject(language)!.code : 'no lang'))

/** Builds a content the API returns, setting the default language if there is one */
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
 * Drags the item into the form, the way `surveyScope.addExternalItemAtPosition()` does, and returns what the backend
 * would receive. The save matters because while a form is open its default language has no column of its own - its
 * labels sit in a plain `label`. Only `unnullifyTranslations` renames that to `label::<default language>`, so the
 * columns say which language each label is in only after saving.
 */
const importIntoAndSave = (host: Survey, item: TestAssetContent): SavedForm => {
  host.insertSurvey(Survey.loadDict(item, host), 0)
  return JSON.parse(unnullifyTranslations(surveyToValidJson(host), host._initialParams))
}

/**
 * Labels of one row of the saved form, keyed by the language whose column holds them. Languages come from the
 * `label::Language` column suffixes, the way formpack derives them, so `UNNAMED` alongside named ones is exactly the
 * state Formbuilder refuses to reopen.
 */
const getLabelsByLanguage = (saved: SavedForm, rowName: string) => {
  const row = [...saved.survey, ...(saved.choices ?? [])].find((candidate) => candidate.name === rowName)!
  return Object.fromEntries(
    Object.entries(row)
      .filter(([column]) => column === 'label' || column.startsWith('label::'))
      .map(([column, label]) => [column === 'label' ? UNNAMED : column.slice('label::'.length), label]),
  )
}

// A user dragging an item out of the Library into an open form. Every case checks a row from both sheets, because
// choices are indexed by the same language list as the survey rows.
describe('importing a library item into a form', () => {
  it('keeps the labels of a multi-language item in a form that has no language', () => {
    const saved = importIntoAndSave(openForm([LANG_NONE]), buildLibraryBlock([LANG_FR, LANG_PL]))

    // The form's labels sit in a plain `label`, and an unnamed language beside named ones is what Formbuilder refuses
    // to reopen - so the item's languages cannot come along, only its default label.
    chai.expect(getLabelsByLanguage(saved, 'fruit')).to.deep.equal({ [UNNAMED]: 'fr' })
    chai.expect(getLabelsByLanguage(saved, 'apple')).to.deep.equal({ [UNNAMED]: 'fr' })
    chai.expect(saved.settings[0].default_language).to.be.undefined
  })

  it("puts a language-less item's labels in the form's default language", () => {
    const saved = importIntoAndSave(openForm([LANG_FR]), buildLibraryBlock([LANG_NONE]))

    // The item's labels already sit in the slot the form's default language uses. Prepending that language here would
    // nullify into a second, unnamed one.
    chai.expect(getLabelsByLanguage(saved, 'fruit')).to.deep.equal({ [LANG_FR]: 'no lang' })
    chai.expect(getLabelsByLanguage(saved, 'apple')).to.deep.equal({ [LANG_FR]: 'no lang' })
  })

  it("stands the item's own label in for the form language it doesn't have", () => {
    const saved = importIntoAndSave(openForm([LANG_FR]), buildLibraryBlock([LANG_PL]))

    // Formbuilder renders the form's default language, so that slot cannot be left blank - in either sheet.
    chai.expect(getLabelsByLanguage(saved, 'fruit')).to.deep.equal({ [LANG_FR]: 'pl', [LANG_PL]: 'pl' })
    chai.expect(getLabelsByLanguage(saved, 'apple')).to.deep.equal({ [LANG_FR]: 'pl', [LANG_PL]: 'pl' })
  })

  it("reorders the choices along with the survey when the item's languages are in another order", () => {
    const saved = importIntoAndSave(openForm([LANG_FR, LANG_EN]), buildLibraryBlock([LANG_EN, LANG_FR]))

    // Both sides know both languages, so every label can stay with the language it was written in.
    chai.expect(getLabelsByLanguage(saved, 'fruit')).to.deep.equal({ [LANG_FR]: 'fr', [LANG_EN]: 'en' })
    chai.expect(getLabelsByLanguage(saved, 'apple')).to.deep.equal({ [LANG_FR]: 'fr', [LANG_EN]: 'en' })
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

    // Only columns in the form's `translated` list get a language on save, so that list has to grow with the item. A
    // bare `guidance_hint` next to `guidance_hint::Polski (pl)` would be an unnamed language.
    chai.expect(row.guidance_hint).to.be.undefined
    chai.expect(row[`guidance_hint::${LANG_FR}`]).to.equal('Aide')
    chai.expect(row[`guidance_hint::${LANG_PL}`]).to.equal('Pomoc')
  })
})
