import Reflux from 'reflux'
import {actions} from 'js/actions'

export interface EnvStoreDataItem {
  value: string
  /** Note: the labels are always localized in the current UI language */
  label: string
}

export interface EnvStoreFieldItem {
  name: string
  required: boolean
}

class EnvStoreData {
  terms_of_service_url: string = ''
  privacy_policy_url: string = ''
  source_code_url: string = ''
  support_email: string = ''
  support_url: string = ''
  community_url: string = ''
  min_retry_time: number = 4 // seconds
  max_retry_time: number = 4 * 60 // seconds
  project_metadata_fields: EnvStoreFieldItem[] = []
  user_metadata_fields: EnvStoreFieldItem[] = []
  sector_choices: EnvStoreDataItem[] = []
  operational_purpose_choices: EnvStoreDataItem[] = []
  country_choices: EnvStoreDataItem[] = []
  /** languages come from `kobo/static_lists.py` **/
  all_languages: EnvStoreDataItem[] = []
  interface_languages: EnvStoreDataItem[] = []
  submission_placeholder: string = ''

  getProjectMetadataField(fieldName: string): EnvStoreFieldItem | boolean {
    for (const f of this.project_metadata_fields) {
      if (f.name === fieldName) {
        return f
      }
    }
    return false;
  }
  getUserMetadataField(fieldName: string): EnvStoreFieldItem | boolean {
    for (const f of this.user_metadata_fields) {
      if (f.name === fieldName) {
        return f
      }
    }
    return false;
  }
}

class EnvStore extends Reflux.Store {
  data: EnvStoreData
  isReady: boolean = false

  constructor() {
    super()
    this.data = new EnvStoreData()
  }

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
    this.data.min_retry_time = response.frontend_min_retry_time
    this.data.max_retry_time = response.frontend_max_retry_time
    this.data.project_metadata_fields = response.project_metadata_fields;
    this.data.user_metadata_fields = response.user_metadata_fields;
    this.data.submission_placeholder = response.submission_placeholder

    if (response.sector_choices) {
      this.data.sector_choices = response.sector_choices.map(this.nestedArrToChoiceObjs)
    }
    if (response.operational_purpose_choices) {
      this.data.operational_purpose_choices = response.operational_purpose_choices.map(this.nestedArrToChoiceObjs)
    }
    if (response.country_choices) {
      this.data.country_choices = response.country_choices.map(this.nestedArrToChoiceObjs)
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

  getSectorLabel(sectorName: string): string | undefined {
    const foundSector = this.data.sector_choices.find(
      (item: EnvStoreDataItem) => item.value === sectorName
    )
    if (foundSector) {
      return foundSector.label
    }
    return undefined
  }

  getCountryLabel(code: string): string | undefined {
    const foundCountry = this.data.country_choices.find(
      (item: EnvStoreDataItem) => item.value === code
    )
    if (foundCountry) {
      return foundCountry.label
    }
    return undefined
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
