import { makeAutoObservable } from 'mobx'
import { fetchGet } from '#/api'
import { endpoints } from '#/api.endpoints'
import type { LabelValuePair, TransxLanguages } from '#/dataInterface'
import type { UserFieldName } from './account/account.constants'

export interface EnvironmentResponse {
  terms_of_service_url: string
  privacy_policy_url: string
  source_code_url: string
  support_email: string
  support_url: string
  community_url: string
  academy_url: string
  project_metadata_fields: EnvStoreFieldItem[]
  extra_project_metadata_fields: EnvStoreFieldItem[]
  extra_project_metadata_choices: Record<string, string[][]>
  user_metadata_fields: UserMetadataField[]
  sector_choices: string[][]
  operational_purpose_choices: string[][]
  country_choices: string[][]
  interface_languages: string[][]
  submission_placeholder: string
  use_team_label: boolean
  usage_limit_enforcement: boolean
  frontend_min_retry_time: number
  frontend_max_retry_time: number
  asr_mt_features_enabled: boolean
  mfa_localized_help_text: string
  mfa_enabled: boolean
  mfa_per_user_availability: boolean
  mfa_code_length: number
  stripe_public_key: string | null
  social_apps: SocialApp[]
  enable_custom_password_guidance_text: boolean
  custom_password_localized_help_text: string
  enable_password_entropy_meter: boolean
  /**
   * Whether the TOS message is defined. This causes the whole TOS Screen checks
   * to be put into motion; i.e. when this is `false` we don't bother to check
   * if we should display TOS Screen to user :)
   */
  terms_of_service__sitewidemessage__exists: boolean
  open_rosa_server: string
  project_history_log_lifespan: number
  allow_self_account_deletion: boolean
}

/*
 * NOTE: This store is written to use MobX, but its imports do not need to be
 * exported with `observer()`. We also do not need to add this to a root store.
 *
 * This is because this store's value does not actually change as they store
 * constant environment variables that are set by the docker container. Thus it
 * JustWorks™ given our frontend architecture.
 */

export interface UserMetadataField {
  name: UserFieldName
  required: boolean
  label: string
}

export interface EnvStoreFieldItem {
  name: string
  required: boolean
  label: string
  type?: 'select' | 'multiselect' | 'text' | 'text-multiline'
}

export interface SocialApp {
  name: string
  provider: string
  provider_id: string
  client_id: string
}

export class EnvStoreData {
  public terms_of_service_url = ''
  public privacy_policy_url = ''
  public source_code_url = ''
  public support_email = ''
  public support_url = ''
  public community_url = ''
  public academy_url = ''
  public min_retry_time = 4 // seconds
  public max_retry_time: number = 4 * 60 // seconds
  public project_metadata_fields: EnvStoreFieldItem[] = []
  public extra_project_metadata_fields: EnvStoreFieldItem[] = []
  public extra_project_metadata_choices: Record<string, LabelValuePair[]> = {}
  public user_metadata_fields: UserMetadataField[] = []
  public sector_choices: LabelValuePair[] = []
  public operational_purpose_choices: LabelValuePair[] = []
  public country_choices: LabelValuePair[] = []
  public interface_languages: LabelValuePair[] = []
  public transcription_languages: TransxLanguages = {}
  public translation_languages: TransxLanguages = {}
  public submission_placeholder = ''
  public use_team_label = true
  public asr_mt_features_enabled = false
  public usage_limit_enforcement = false
  public mfa_localized_help_text = ''
  public mfa_enabled = false
  public mfa_per_user_availability = false
  public mfa_code_length = 6
  public stripe_public_key: string | null = null
  public social_apps: SocialApp[] = []
  public enable_custom_password_guidance_text = false
  public custom_password_localized_help_text = ''
  public enable_password_entropy_meter = false
  public terms_of_service__sitewidemessage__exists = false
  public open_rosa_server = ''
  public allow_self_account_deletion = false

  public getProjectMetadataFieldsAsSimpleDict() {
    // dict[name] => {name, required, label}
    const dict: { [fieldName: string]: EnvStoreFieldItem } = {}
    const all = [...this.project_metadata_fields, ...this.extra_project_metadata_fields]
    for (const field of all) {
      dict[field.name] = field
    }
    return dict
  }

  public getLocalizedLabel(label: string | Record<string, string>, lang: string): string {
    if (typeof label === 'string') return label
    console.error('this is the lang: ', lang)

    if (label[lang]) return label[lang]
    if (label['default']) return label['default']
    if (label['en']) return label['en']

    return Object.values(label)[0] || ''
  }

  public getOptionsForField(fieldName: string): LabelValuePair[] {
    if (fieldName === 'sector') return this.sector_choices
    if (fieldName === 'country') return this.country_choices
    if (fieldName === 'operational_purpose') return this.operational_purpose_choices

    if (fieldName === 'collects_pii') {
      return [
        { value: 'Yes', label: 'Yes' },
        { value: 'No', label: 'No' },
      ]
    }

    return this.extra_project_metadata_choices[fieldName] || []
  }

  public getUserMetadataFieldsAsSimpleDict() {
    // dict[name] => {name, required, label}
    const dict: { [fieldName: string]: UserMetadataField } = {}
    for (const field of this.user_metadata_fields) {
      dict[field.name] = field
    }
    return dict
  }

  public getUserMetadataRequiredFieldNames(): UserFieldName[] {
    return this.user_metadata_fields.filter((item) => item.required).map((item) => item.name)
  }

  public getUserMetadataFieldNames(): UserFieldName[] {
    return this.user_metadata_fields.map((item) => item.name)
  }
}

class EnvStore {
  data: EnvStoreData
  isReady = false

  constructor() {
    makeAutoObservable(this)
    this.data = new EnvStoreData()
    this.fetchData()
  }

  async fetchData() {
    // Error handling is done inside `fetchGet`
    const response = await fetchGet<EnvironmentResponse>(endpoints.ENVIRONMENT)
    this.onGetEnvCompleted(response)
  }

  /**
   * A DRY utility function that turns an array of two items into an object with
   * 'value' and 'label' properties.
   */
  private nestedArrToChoiceObjs = (i: string[]): LabelValuePair => {
    return {
      value: i[0],
      label: i[1],
    }
  }

  private onGetEnvCompleted(response: EnvironmentResponse) {
    this.data.terms_of_service_url = response.terms_of_service_url
    this.data.privacy_policy_url = response.privacy_policy_url
    this.data.source_code_url = response.source_code_url
    this.data.support_email = response.support_email
    this.data.support_url = response.support_url
    this.data.community_url = response.community_url
    this.data.academy_url = response.academy_url
    this.data.min_retry_time = response.frontend_min_retry_time
    this.data.max_retry_time = response.frontend_max_retry_time
    this.data.project_metadata_fields = response.project_metadata_fields
    this.data.user_metadata_fields = response.user_metadata_fields
    this.data.submission_placeholder = response.submission_placeholder
    this.data.use_team_label = response.use_team_label
    this.data.usage_limit_enforcement = response.usage_limit_enforcement
    this.data.mfa_localized_help_text = response.mfa_localized_help_text
    this.data.mfa_enabled = response.mfa_enabled
    this.data.mfa_per_user_availability = response.mfa_per_user_availability
    this.data.mfa_code_length = response.mfa_code_length
    this.data.stripe_public_key = response.stripe_public_key
    this.data.social_apps = response.social_apps
    this.data.open_rosa_server = response.open_rosa_server

    this.data.allow_self_account_deletion = Boolean(response.allow_self_account_deletion)

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

    this.data.asr_mt_features_enabled = response.asr_mt_features_enabled

    this.data.extra_project_metadata_fields = response.extra_project_metadata_fields || []

    if (response.extra_project_metadata_choices) {
      Object.keys(response.extra_project_metadata_choices).forEach((key) => {
        this.data.extra_project_metadata_choices[key] = response.extra_project_metadata_choices[key].map(
          this.nestedArrToChoiceObjs,
        )
      })
    }

    this.data.extra_project_metadata_fields.forEach((field: any) => {
      if (field.options && Array.isArray(field.options)) {
        this.data.extra_project_metadata_choices[field.name] = field.options.map((opt: any) => {
          return {
            value: opt.name,
            label: opt.label,
          }
        })
      }
    })

    this.data.enable_custom_password_guidance_text = response.enable_custom_password_guidance_text
    this.data.custom_password_localized_help_text = response.custom_password_localized_help_text
    this.data.enable_password_entropy_meter = response.enable_password_entropy_meter

    this.data.terms_of_service__sitewidemessage__exists = response.terms_of_service__sitewidemessage__exists

    this.isReady = true
  }

  public getSectorLabel(sectorName: string): string | undefined {
    const foundSector = this.data.sector_choices.find((item: LabelValuePair) => item.value === sectorName)
    if (foundSector) {
      return foundSector.label
    }
    return undefined
  }

  public getCountryLabel(code: string): string | undefined {
    const foundCountry = this.data.country_choices.find((item: LabelValuePair) => item.value === code)
    if (foundCountry) {
      return foundCountry.label
    }
    return undefined
  }
}

/**
 * This store keeps all environment data (constants) like languages, countries,
 * external urls…
 */
export default new EnvStore()
