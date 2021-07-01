import clonedeep from 'lodash.clonedeep';
import {ASSET_TYPES} from 'js/constants';

/**
 * Asset type could be either the loaded asset type (editing an existing form)
 * or the desired asset type (creating a new form)
 *
 * @returns {object|null} one of ASSET_TYPES
 */
export function getFormBuilderAssetType(assetType, desiredAssetType) {
  if (assetType && ASSET_TYPES[assetType]) {
    return ASSET_TYPES[assetType];
  } else if (desiredAssetType && ASSET_TYPES[desiredAssetType]) {
    return ASSET_TYPES[desiredAssetType];
  }
  return null;
}

export function surveyToValidJson(survey) {
  // HACK: This is done as a fix for https://github.com/kobotoolbox/kpi/pull/735
  // I'm not entirely sure what this is about but definitely BAD CODE™!
  //
  // skip logic references only preserved after initial call
  // to "survey.toFlatJSON()"
  survey.toFlatJSON();
  // returning the result of the second call to "toFlatJSON()"
  return JSON.stringify(survey.toFlatJSON());
}

/**
 * This function reverses what `nullifyTranslations` did to the form data.
 * @param {string} surveyDataJSON
 * @param {object} assetContent
 * @return {string} fixed surveyDataJSON
 */
export function unnullifyTranslations(surveyDataJSON, assetContent) {
  let surveyData = JSON.parse(surveyDataJSON);

  let translatedProps = [];
  if (assetContent.translated) {
     translatedProps = assetContent.translated;
  }

  // TRANSLATIONS HACK (Part 2/2):
  // set default_language
  let defaultLang = assetContent.translations_0;
  if (!defaultLang) {
    defaultLang = null;
  }
  if (!surveyData.settings[0].default_language && defaultLang !== null) {
    surveyData.settings[0].default_language = defaultLang;
  }

  if (defaultLang !== null) {
    // replace every "translatedProp" with "translatedProp::defaultLang"
    if (surveyData.choices) {
      surveyData.choices.forEach((choice) => {
        translatedProps.forEach((translatedProp) => {
          if (typeof choice[translatedProp] !== 'undefined') {
            choice[`${translatedProp}::${defaultLang}`] = choice[translatedProp];
            delete choice[translatedProp];
          }
        });
      });
    }
    if (surveyData.survey) {
      surveyData.survey.forEach((surveyRow) => {
        translatedProps.forEach((translatedProp) => {
          if (typeof surveyRow[translatedProp] !== 'undefined') {
            if (typeof surveyData.settings[0] !== 'undefined'
                && typeof surveyData.settings[0].style === 'string'
                && surveyData.settings[0].style.includes('theme-grid')
                && surveyRow.type === 'begin_group'
                && (surveyRow[translatedProp] === null || surveyRow[translatedProp] === '')) {
              delete surveyRow[translatedProp];
            }
            surveyRow[`${translatedProp}::${defaultLang}`] = surveyRow[translatedProp];
            delete surveyRow[translatedProp];
          }
        });
      });
    }
  }

  return JSON.stringify(surveyData);
}

/**
 * @typedef NullifiedTranslations
 * @property {object} survey - Modified survey.
 * @property {Array<string|null>} translations - Modified translations.
 * @property {Array<string|null>} translations_0 - The original default language name.
 */

/**
 * A function that adjust the translations data to the Form Builder code.
 * Requires the sibling `unnullifyTranslations` function to be called before
 * saving the form.
 * @param {Array<string|null>} [translations]
 * @param {Array<string>} translatedProps
 * @param {Array<object>} survey
 * @param {object} baseSurvey
 * @return {NullifiedTranslations}
 */
export function nullifyTranslations(translations, translatedProps, survey, baseSurvey) {
  const data = {
    survey: clonedeep(survey),
    translations: clonedeep(translations)
  };

  if (typeof translations === 'undefined') {
    data.translations = [null];
    return data;
  }

  if (data.translations.length > 1 && data.translations.indexOf(null) !== -1) {
    throw new Error('There is an unnamed translation in your form definition.\nPlease give a name to all translations in your form.\nUse "Manage Translations" option from form landing page.');
  }

  /*
  TRANSLATIONS HACK (Part 1/2):
  all the coffee code assumes first language to be null, and we don't want
  to introduce potential code-breaking refactor in old code, so we store
  first language, then replace with null and reverse this just before saving
  NOTE: when importing assets from Library into form, we need to make sure
  the default language is the same (or force baseSurvey default language)
  */
  if (baseSurvey) {
    const formDefaultLang = baseSurvey._initialParams.translations_0 || null;
    if (data.translations[0] === formDefaultLang) {
      // case 1: nothing to do - same default language in both
    } else if (data.translations.includes(formDefaultLang)) {
      // case 2: imported asset has form default language but not as first, so
      // we need to reorder things
      const defaultLangIndex = data.translations.indexOf(formDefaultLang);
      data.translations.unshift(data.translations.pop(defaultLangIndex));
      data.survey.forEach((row) => {
        translatedProps.forEach((translatedProp) => {
          const transletedPropArr = row[translatedProp];
          if (transletedPropArr) {
            transletedPropArr.unshift(transletedPropArr.pop(defaultLangIndex));
          }
        });
      });
    }

    if (!data.translations.includes(formDefaultLang)) {
      // case 3: imported asset doesn't have form default language, so we
      // force it onto the asset as the first language and try setting some
      // meaningful property value
      data.translations.unshift(formDefaultLang);
      data.survey.forEach((row) => {
        translatedProps.forEach((translatedProp) => {
          if (row[translatedProp]) {
            let propVal = null;
            if (row.name) {
              propVal = row.name;
            } else if (row.$autoname) {
              propVal = row.$autoname;
            }
            row[translatedProp].unshift(propVal);
          }
        });
      });
    }
  }

  // no need to nullify null
  if (data.translations[0] !== null) {
    data.translations_0 = data.translations[0];
    data.translations[0] = null;
  }

  return data;
}

export function koboMatrixParser(params) {
  let content = {};
  if (params.content)
    content = JSON.parse(params.content);
  if (params.source)
    content = JSON.parse(params.source);

  if (!content.survey)
    return params;

  var hasMatrix = false;
  var surveyLength = content.survey.length;

  // add open/close tags for kobomatrix groups
  for (var i = 0; i < surveyLength; i++) {
    if (content.survey[i].type === 'kobomatrix') {
      content.survey[i].type = 'begin_kobomatrix';
      content.survey[i].appearance = 'field-list';
      surveyLength++;
      content.survey.splice(i + 1, 0, {type: 'end_kobomatrix', '$kuid': `/${content.survey[i].$kuid}`});
    }
  }

  // add columns as items in the group
  for (i = 0; i < surveyLength; i++) {
    if (content.survey[i].type === 'begin_kobomatrix') {
      var j = i;
      hasMatrix = true;
      var matrix = localStorage.getItem(`koboMatrix.${content.survey[i].$kuid}`);

      if (matrix != null) {
        matrix = JSON.parse(matrix);
        for (var kuid of matrix.cols) {
          i++;
          surveyLength++;
          content.survey.splice(i, 0, matrix[kuid]);
        }

        for (var k of Object.keys(matrix.choices)) {
          content.choices.push(matrix.choices[k]);
        }
      }
      // TODO: handle corrupt matrix data
    }
  }

  if (hasMatrix) {
    if (params.content)
      params.content = JSON.stringify(content);
    if (params.source)
      params.source = JSON.stringify(content);
  }
  return params;
}

export function readParameters(str) {
  if (typeof str !== 'string') {
    return null;
  }

  const params = {};

  let separator = ' ';
  if (str.includes(';')) {
    separator = ';';
  } else if (str.includes(',')) {
    separator = ',';
  }
  const otherSeparators = ';, '.replace(separator, '');
  const cleanStr = str.replace(new RegExp(' *= *', 'g'), '=');
  const parts = cleanStr.split(new RegExp(`[${otherSeparators}]*${separator}[${otherSeparators}]*`, 'g'));

  parts.forEach((part) => {
    if (part.includes('=')) {
      const key = part.slice(0, part.indexOf('='));
      const value = part.slice(key.length + 1);
      params[key] = value;
    }
  });

  if (Object.keys(params).length < 1) {
    return null;
  }
  return params;
}

export function writeParameters(obj) {
  let params = [];
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined && obj[key] !== null) {
      let value = obj[key];
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      params.push(`${key}=${value}`);
    }
  });
  return params.join(';');
}
