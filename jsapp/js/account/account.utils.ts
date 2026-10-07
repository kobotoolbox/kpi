import type { EnvironmentResponse } from '#/api/models/environmentResponse'
import { choicesFromTuples, recordKeys } from '#/utils'
import type { AccountFieldsConfig, AccountFieldsValues, UserFieldName, UserMetadataField } from './account.constants'
import { MMO_MANAGED_FIELD_NAMES, USER_FIELD_NAMES } from './account.constants'

/**
 * A blank for every field Frontend knows about. `Required` on purpose: this is the list the other helpers here derive
 * their keys from, so leaving a field out of it would quietly take that field out of play.
 */
export function getInitialAccountFieldsValues(): Required<AccountFieldsValues> {
  return {
    name: '',
    organization: '',
    organization_website: '',
    organization_type: '',
    sector: '',
    gender: '',
    bio: '',
    city: '',
    country: '',
    require_auth: false,
    newsletter_subscription: false,
    twitter: '',
    linkedin: '',
    instagram: '',
  }
}

/**
 * For given field values produces an object to use with the `/me` endpoint for
 * updating the `extra_details`.
 */
export function getProfilePatchData(fields: Partial<AccountFieldsValues>) {
  return { extra_details: fields }
}

/**
 * Picks the profile fields out of an account's `extra_details`, filling in a blank for anything absent.
 */
export function getProfileFieldsValues(extraDetails: Partial<AccountFieldsValues>): Required<AccountFieldsValues> {
  const values = getInitialAccountFieldsValues()

  for (const fieldName of recordKeys(values)) {
    const given = extraDetails[fieldName]
    if (given !== undefined && given !== null) {
      // Assigned this way because the compiler cannot see that the key and the value came from the same field.
      Object.assign(values, { [fieldName]: given })
    }
  }

  return values
}

/**
 * The profile fields a user is allowed to edit themselves: whatever was given, minus whatever their
 * organization owns - see {@link MMO_MANAGED_FIELD_NAMES}.
 */
export function getEditableProfileFieldNames({
  configuredFieldNames,
  isMmoMember,
}: {
  configuredFieldNames: readonly UserFieldName[]
  isMmoMember: boolean
}): UserFieldName[] {
  if (!isMmoMember) {
    // Copied for safety
    return [...configuredFieldNames]
  }
  return configuredFieldNames.filter((name) => !MMO_MANAGED_FIELD_NAMES.includes(name))
}

/** The profile fields configuration built from `/environment` response. */
export function getAccountFieldsConfig(environment: EnvironmentResponse): AccountFieldsConfig {
  const userMetadataFields: UserMetadataField[] = []
  for (const field of environment.user_metadata_fields) {
    if (field.name in USER_FIELD_NAMES) {
      userMetadataFields.push({
        name: field.name as UserFieldName,
        required: Boolean(field.required),
        label: field.label,
      })
    }
  }

  return {
    userMetadataFields,
    countryChoices: choicesFromTuples(environment.country_choices),
    sectorChoices: choicesFromTuples(environment.sector_choices),
  }
}

export function getUserMetadataFieldsByName(
  userMetadataFields: readonly UserMetadataField[],
): Partial<Record<UserFieldName, UserMetadataField>> {
  const byName: Partial<Record<UserFieldName, UserMetadataField>> = {}
  for (const field of userMetadataFields) {
    byName[field.name] = field
  }
  return byName
}

export function getUserMetadataFieldLabel(
  userMetadataFields: readonly UserMetadataField[],
  fieldName: UserFieldName,
): string {
  return userMetadataFields.find((field) => field.name === fieldName)?.label || fieldName
}

export function hasNoOrganizationAffiliation(
  values: Pick<AccountFieldsValues, 'organization_type'>,
  configuredFieldNames: readonly UserFieldName[],
): boolean {
  return configuredFieldNames.includes(USER_FIELD_NAMES.organization_type) && values.organization_type === 'none'
}
