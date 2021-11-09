import Reflux from 'reflux'
import {actions} from 'js/actions'

export interface EnvStoreDataItem {
  value: string
  label: string
}

interface EnvStoreData {
  terms_of_service_url: string
  privacy_policy_url: string
  source_code_url: string
  support_email: string
  support_url: string
  community_url: string
  available_sectors: EnvStoreDataItem[]
  available_countries: EnvStoreDataItem[]
  all_languages: EnvStoreDataItem[]
  interface_languages: EnvStoreDataItem[]
  submission_placeholder: string
}

class EnvStore extends Reflux.Store {
  data: EnvStoreData = {
    terms_of_service_url: '',
    privacy_policy_url: '',
    source_code_url: '',
    support_email: '',
    support_url: '',
    community_url: '',
    available_sectors: [],
    available_countries: [],
    /** languages come from `kobo/static_lists.py` */
    all_languages: [],
    interface_languages: [],
    submission_placeholder: ''
  }

  isReady: boolean = false

  /**
   * A DRY utility function that turns an array of two items into an object with
   * 'value' and 'label' properties.
   */
  private nestedArrToChoiceObjs = (i: string[]): EnvStoreDataItem => {
    return {
      value: i[0],
      label: i[1],
    }
  }

  init() {
    actions.auth.getEnvironment.completed.listen(this.onGetEnvCompleted.bind(this))
    actions.auth.getEnvironment()
  }

  onGetEnvCompleted(response: EnvironmentResponse) {
    this.data.terms_of_service_url = response.terms_of_service_url
    this.data.privacy_policy_url = response.privacy_policy_url
    this.data.source_code_url = response.source_code_url
    this.data.support_email = response.support_email
    this.data.support_url = response.support_url
    this.data.community_url = response.community_url
    this.data.submission_placeholder = response.submission_placeholder

    if (response.available_sectors) {
      this.data.available_sectors = response.available_sectors.map(this.nestedArrToChoiceObjs)
    }
    if (response.available_countries) {
      this.data.available_countries = response.available_countries.map(this.nestedArrToChoiceObjs)
    }
    if (response.interface_languages) {
      this.data.interface_languages = response.interface_languages.map(this.nestedArrToChoiceObjs)
    }
    if (response.all_languages) {
      this.data.all_languages = response.all_languages.map(this.nestedArrToChoiceObjs)
    }

    this.isReady = true
    this.trigger(this.data)
  }

  getLanguages() {
    return this.data.all_languages
  }

  getLanguage(code: string): EnvStoreDataItem | undefined {
    return this.data.all_languages.find(
      (item: EnvStoreDataItem) => item.value === code
    )
  }

  /** Returns a know language label or the provided code. */
  getLanguageDisplayLabel(code: string): string {
    let displayLabel = code
    const envStoreLanguage = envStore.getLanguage(code)
    if (envStoreLanguage) {
      displayLabel = envStoreLanguage.label
    }
    return displayLabel
  }

  /** Case-insensitive lookup by localized name */
  getLanguageByName(label: string): EnvStoreDataItem | undefined {
    return this.data.all_languages.find(
      (item: EnvStoreDataItem) => item.label.toLocaleLowerCase() === label.toLocaleLowerCase()
    )
  }
}

/**
 * This store keeps all environment data (constants) like languages, countries,
 * external urls…
 */
const envStore = new EnvStore();
envStore.init();

export default envStore;
