import type { AssetContent, SurveyChoice, SurveyRow } from '#/dataInterface'

/**
 * What to do with a library asset's languages when it is dropped into an open form, so the modal and the merge read
 * the same answer instead of each deriving its own.
 */
export type ImportLanguagesResolution =
  /** Insert with no questions asked: either the lists already agree, or neither side names a language. */
  | { action: 'merge' }
  /** Refuse the insert. The form has no default language yet, so there is no slot to line the asset's up against. */
  | { action: 'block' }
  /** Nothing the asset says is in a language the form knows. Ask to continue, which adds all of them. */
  | { action: 'confirm-add'; languagesToAdd: string[] }
  /** Some of the asset's languages fit the form and some don't. Ask whether to add the rest or throw them away. */
  | { action: 'add-or-discard'; languagesToAdd: string[] }

const isNamed = (language: string | null): language is string => Boolean(language)

/**
 * The open form's languages, default first, with the nullified first slot filled back in. The input parser keeps
 * `_initialParams` up to date, so languages added earlier in the session are included.
 */
export function getFormLanguages(initialParams: AssetContent | Record<string, never>): Array<string | null> {
  const translations = initialParams.translations ?? []
  return [initialParams.translations_0 ?? null, ...translations.slice(1)]
}

/**
 * Decides how a library asset's languages can join a form's. Both lists are default-first and may carry a `null`
 * first slot for an unnamed language, which can't be matched up: it only ever means "the default slot".
 */
export function resolveImportLanguages(
  formLanguages: Array<string | null>,
  assetLanguages: Array<string | null> | undefined,
): ImportLanguagesResolution {
  const formNamed = formLanguages.filter(isNamed)
  const assetNamed = (assetLanguages ?? []).filter(isNamed)

  if (formNamed.length === 0) {
    // One asset language can quietly share the form's unnamed default slot
    return assetNamed.length > 1 ? { action: 'block' } : { action: 'merge' }
  }

  if (assetNamed.length === 0) {
    // The asset's single unnamed value belongs in whatever the form calls its default language
    return { action: 'merge' }
  }

  const languagesToAdd = assetNamed.filter((language) => !formNamed.includes(language))

  if (languagesToAdd.length === assetNamed.length) {
    // Nothing in common, so the form's own languages stay untranslated for these questions
    return { action: 'confirm-add', languagesToAdd }
  }

  if (languagesToAdd.length > 0) {
    return { action: 'add-or-discard', languagesToAdd }
  }

  return { action: 'merge' }
}

/**
 * Drops the given languages from a fetched asset: their slot in every translated value, and their name in
 * `translations`. What is left only speaks languages the form already has, so the normal merge can take over.
 *
 * Mutates, since callers clone the content anyway (`Survey.loadDict` mutates too).
 */
export function discardAssetLanguages(content: AssetContent, languagesToDiscard: string[]): AssetContent {
  const translations = content.translations ?? []
  const keptIndexes = translations.reduce<number[]>((indexes, language, index) => {
    if (!language || !languagesToDiscard.includes(language)) {
      indexes.push(index)
    }
    return indexes
  }, [])

  const rows: Array<SurveyRow | SurveyChoice> = [...(content.survey ?? []), ...(content.choices ?? [])]
  for (const row of rows) {
    for (const translatedProp of content.translated ?? []) {
      const value = row[translatedProp]
      // A single-language asset stores a plain string - nothing to pick out of
      if (Array.isArray(value)) {
        row[translatedProp] = keptIndexes.map((index) => value[index])
      }
    }
  }

  content.translations = keptIndexes.map((index) => translations[index])
  return content
}
