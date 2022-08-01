import $ from 'jquery';
import type {FailResponse} from 'js/dataInterface';
import {ROOT_URL} from 'js/constants';
import type {LanguageBase} from './languagesStore';

interface DetailedLanguageRegion {
  code: string;
  name: string;
}

interface DetailedLanguageService {
  goog: {[languageCode: string]: string};
}

interface DetailedLanguage extends LanguageBase {
  regions: DetailedLanguageRegion[];
  transcription_services: DetailedLanguageService[];
  translation_services: DetailedLanguageService[];
}

/**
 * This store uses the language detail endpoint:
 * `api/v2/languages/${languageCode}`. It is designed to handle fetching
 * singular language (with memoization, as languages data on backend will not
 * change).
 *
 * If you need a list of languages, please use `languagesStore`.
 */
class DetailedLanguagesStore {
  private languages: Map<string, DetailedLanguage> = new Map();

  /**
   * Returns a promise that gets you a single language (with extended data).
   * It will either resolve with memoized data, or make a backend call.
   */
  public getLanguage(languageCode: string) {
    return new Promise((resolve, reject) => {
      if (this.languages.has(languageCode)) {
        resolve(this.languages.get(languageCode));
      } else {
        $.ajax({
          dataType: 'json',
          method: 'GET',
          url: `${ROOT_URL}/api/v2/languages/${languageCode}/`,
        })
          .done((response: DetailedLanguage) => {
            this.languages.set(response.code, response);
            resolve(response);
          })
          .fail((response: FailResponse) => {
            reject(response.responseText);
          });
      }
    });
  }
}

export default new DetailedLanguagesStore();

