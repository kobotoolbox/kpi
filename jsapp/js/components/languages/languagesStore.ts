import $ from 'jquery';
import type {FailResponse} from 'js/dataInterface';
import {ROOT_URL} from 'js/constants';

/**
 * A language code is a string (alias type), but it is more helpful to pass it
 * around, than vague "string".
 */
export type LanguageCode = string;

export interface LanguageBase {
  /** API endpoint for detailed language data. */
  url: string;
  name: string;
  code: LanguageCode;
  /** This marks the most popular and featured languages in UI. */
  featured: boolean;
}

interface ListLanguageService {
  code: LanguageCode;
  name: string;
}

export interface ListLanguage extends LanguageBase {
  transcription_services: ListLanguageService[];
  translation_services: ListLanguageService[];
}

interface DetailedLanguageRegion {
  code: LanguageCode;
  name: string;
}

interface DetailedLanguageService {
  goog: {[languageCode: LanguageCode]: LanguageCode};
}

export interface DetailedLanguage extends LanguageBase {
  regions: DetailedLanguageRegion[];
  transcription_services: DetailedLanguageService[];
  translation_services: DetailedLanguageService[];
}

/**
 * This store uses the language detail endpoint:
 * `api/v2/languages/${languageCode}`. It is designed to handle fetching
 * singular language (with memoization, as languages data on backend will not
 * change during a lifetime of the app).
 *
 * If you need a list of languages, please use `languagesStore`.
 */
class LanguagesStore {
  private detailedLanguages: Map<LanguageCode, DetailedLanguage> = new Map();
  private languages: Map<LanguageCode, ListLanguage> = new Map();

  /**
   * Returns a promise that gets you a single language (with extended data).
   * It will either resolve with memoized data, or make a backend call.
   */
  public getLanguage(languageCode: LanguageCode): Promise<DetailedLanguage> {
    return new Promise((resolve, reject) => {
      const language = this.detailedLanguages.get(languageCode);
      if (language) {
        resolve(language);
      } else {
        $.ajax({
          dataType: 'json',
          method: 'GET',
          url: `${ROOT_URL}/api/v2/languages/${languageCode}/`,
        })
          .done((response: DetailedLanguage) => {
            this.detailedLanguages.set(response.code, response);
            resolve(response);
          })
          .fail((response: FailResponse) => {
            reject(response.responseText);
          });
      }
    });
  }

  /**
   * To be used by `languagesListStore` to memoize data for the
   * `getLanguageName` method, to avoid unnecessary calls for detailed language,
   * in cases when we just need a name (which is most of cases).
   */
  public setListLanguages(languages: ListLanguage[]) {
    languages.forEach((language) => {
      this.languages.set(language.code, language);
    });
  }

  /**
   * Returns a promist that resolves with a language name. Most of the times
   * you will get a memoized value.
   */
  public getLanguageName(languageCode: LanguageCode): Promise<string> {
    return new Promise((resolve, reject) => {
      // First we try to get the name from memoized data.
      const languageName = (
        this.detailedLanguages.get(languageCode)?.name ||
        this.languages.get(languageCode)?.name
      );
      if (languageName) {
        resolve(languageName);
      } else {
        this.getLanguage(languageCode)
          .then((language: DetailedLanguage) => {
            resolve(language.name);
          })
          .catch(reject);
      }
    });
  }
}

export default new LanguagesStore();

