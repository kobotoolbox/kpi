import {EXPORT_FORMATS} from 'js/components/projectDownloads/exportsConstants';
import {type ExportDataLang, type AssetResponse} from 'jsapp/js/dataInterface';

export interface ExportFormatOption {
  value: ExportDataLang;
  label: string;
  /** Present only for languages (not for `EXPORT_FORMATS`). */
  langIndex?: number;
}

/**
 * Returns one of export format options, either the asset's default language
 * or `_default` (or more precisely: the first option)
 */
export function getContextualDefaultExportFormat(asset: AssetResponse): ExportFormatOption {
  const exportFormatOptions = getExportFormatOptions(asset);
  const defaultAssetLanguage = asset.summary?.default_translation;
  const defaultAssetLanguageOption = exportFormatOptions.find((option) =>
    defaultAssetLanguage === option.value
  );
  return defaultAssetLanguageOption || exportFormatOptions[0];
}

/**
 * Returns a list of options available as formats for given asset.
 */
export function getExportFormatOptions(asset: AssetResponse): ExportFormatOption[] {
  const options: ExportFormatOption[] = [];

  // Step 1: add all defined languages as options (both named and unnamed)
  if (asset.summary?.languages && asset.summary.languages.length >= 1) {
    asset.summary.languages.forEach((language, index) => {
      // unnamed language gives the `_default` option
      if (language === null) {
        options.push(EXPORT_FORMATS._default);
      } else {
        options.push({
          value: language,
          label: language,
          langIndex: index,
        });
      }
    });
  }

  // Step 2: if for some reason nothing was added yet, add `_default`
  if (options.length === 0) {
    options.push(EXPORT_FORMATS._default);
  }

  // Step 3: `_xml` is always available and always last
  options.push(EXPORT_FORMATS._xml);

  return options;
}
