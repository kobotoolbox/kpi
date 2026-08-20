import { EXPORT_FORMATS } from '#/components/projectDownloads/exportsConstants'
import type { AssetResponse, ExportDataLang, ExportSettingSettings } from '#/dataInterface'
import { recordEntries } from '#/utils'

export interface ExportFormatOption {
  value: ExportDataLang
  label: string
  /** Present only for languages (not for `EXPORT_FORMATS`). */
  langIndex?: number
}

/**
 * Every export setting that the exports creator form builds on its own (see
 * `onSubmit` in `ProjectExportsCreator`). The form sends some of them only for
 * some export types - `flatten` for GeoJSON, `xls_types_as_text` for XLS - so
 * when one of these keys is missing from a payload, it means "the selected
 * export type doesn't take it".
 */
const FORM_MANAGED_EXPORT_SETTINGS: ReadonlyArray<keyof ExportSettingSettings> = [
  'fields',
  'fields_from_all_versions',
  'flatten',
  'group_sep',
  'hierarchy_in_labels',
  'include_media_url',
  'lang',
  'multiple_select',
  'query',
  'type',
  'xls_types_as_text',
]

/**
 * Returns the settings the form built, plus any setting from an existing saved
 * export setting that the form has no field for (`submission_ids`, for example).
 *
 * Needed because saving overwrites the whole `export_settings` object: without
 * copying those over, exporting from this form would delete options that were
 * set up through the API.
 *
 * Settings from `FORM_MANAGED_EXPORT_SETTINGS` are never copied - the form is
 * the only source of truth for them. Example: you export GeoJSON, so
 * `flatten: true` lands in the payload and gets saved. Then you switch to KML
 * and export again; this payload has no `flatten`, because KML doesn't support
 * it. Copying the saved `flatten` back in would make the API reject the export.
 */
export function preserveApiOnlySettings(
  formSettings: ExportSettingSettings,
  savedSettings: ExportSettingSettings,
): ExportSettingSettings {
  const mergedSettings = { ...formSettings }

  recordEntries(savedSettings).forEach(([key, value]) => {
    if (FORM_MANAGED_EXPORT_SETTINGS.includes(key) || Object.prototype.hasOwnProperty.call(mergedSettings, key)) {
      return
    }
    mergedSettings[key] = value
  })

  return mergedSettings
}

/**
 * Returns one of export format options, either the asset's default language
 * or `_default` (or more precisely: the first option)
 */
export function getContextualDefaultExportFormat(asset: AssetResponse): ExportFormatOption {
  const exportFormatOptions = getExportFormatOptions(asset)
  const defaultAssetLanguage = asset.summary?.default_translation
  const defaultAssetLanguageOption = exportFormatOptions.find((option) => defaultAssetLanguage === option.value)
  return defaultAssetLanguageOption || exportFormatOptions[0]
}

/**
 * Returns a list of options available as formats for given asset.
 */
export function getExportFormatOptions(asset: AssetResponse): ExportFormatOption[] {
  const options: ExportFormatOption[] = []

  // Step 1: add all defined languages as options (both named and unnamed)
  if (asset.summary?.languages && asset.summary.languages.length >= 1) {
    asset.summary.languages.forEach((language, index) => {
      // unnamed language gives the `_default` option
      if (language === null) {
        options.push(EXPORT_FORMATS._default)
      } else {
        options.push({
          value: language,
          label: language,
          langIndex: index,
        })
      }
    })
  }

  // Step 2: if for some reason nothing was added yet, add `_default`
  if (options.length === 0) {
    options.push(EXPORT_FORMATS._default)
  }

  // Step 3: `_xml` is always available and always last
  options.push(EXPORT_FORMATS._xml)

  return options
}
