import { GENDER_SELECT_OPTIONS, ORGANIZATION_TYPE_SELECT_OPTIONS } from '#/account/accountFieldOptions'
import type { MetadataField } from '#/api/models/metadataField'
import { OrganizationTypeEnum } from '#/api/models/organizationTypeEnum'

/**
 * The user metadata fields the signup form can ask about, in the order the Django form uses (`SignupForm.field_order`).
 *
 * Mirrors `CONFIGURABLE_METADATA_FIELDS` in `kobo/apps/accounts/forms.py`, which is narrower than
 * `USER_METADATA_FIELDS`: an instance may also configure `bio`, `city` and the social handles, but those belong to
 * account settings and signup has nowhere to put them.
 */
export const SIGNUP_METADATA_FIELD_NAMES = [
  'name',
  'country',
  'sector',
  'organization_type',
  'organization',
  'organization_website',
  'gender',
  'newsletter_subscription',
] as const

export type SignupMetadataFieldName = (typeof SIGNUP_METADATA_FIELD_NAMES)[number]

/** What the instance configured, by field name. A missing entry means the field is off here. */
export type SignupMetadataFields = Partial<Record<SignupMetadataFieldName, MetadataField>>

/**
 * The form always carries a value for every supported field, configured or not, so the shape does not
 * change when `/environment` lands.
 */
export interface SignupMetadataValues {
  name: string
  country: string
  sector: string
  organization_type: string
  organization: string
  organization_website: string
  gender: string
  newsletter_subscription: boolean
}

/** Shared, so spread it into a form rather than handing the object itself over. */
export const EMPTY_SIGNUP_METADATA_VALUES: SignupMetadataValues = {
  name: '',
  country: '',
  sector: '',
  organization_type: '',
  organization: '',
  organization_website: '',
  gender: '',
  newsletter_subscription: false,
}

function isSignupMetadataFieldName(name: string): name is SignupMetadataFieldName {
  return (SIGNUP_METADATA_FIELD_NAMES as readonly string[]).includes(name)
}

/** Picks the signup-capable fields out of `/environment`'s `user_metadata_fields`. */
export function getSignupMetadataFields(userMetadataFields: MetadataField[] | undefined): SignupMetadataFields {
  const fields: SignupMetadataFields = {}
  for (const field of userMetadataFields ?? []) {
    if (isSignupMetadataFieldName(field.name)) {
      fields[field.name] = field
    }
  }
  return fields
}

/**
 * "Skip logic" for the organization fields: picking "I am not associated with any organization" hides
 * `organization` and `organization_website`, and the backend then accepts them blank even when the
 * instance marks them required (see `KoboSignupMixin.clean`).
 */
function areOrganizationFieldsSkipped(fields: SignupMetadataFields, values: SignupMetadataValues): boolean {
  return Boolean(fields.organization_type) && values.organization_type === OrganizationTypeEnum.none
}

/** Whether to render a field at all: configured on this instance, and not skipped. */
export function isMetadataFieldShown(
  name: SignupMetadataFieldName,
  fields: SignupMetadataFields,
  values: SignupMetadataValues,
): boolean {
  if (!fields[name]) {
    return false
  }
  if (name === 'organization' || name === 'organization_website') {
    return !areOrganizationFieldsSkipped(fields, values)
  }
  return true
}

/** A hidden field is never required, so this follows the organization dropdown as it changes. */
export function isMetadataFieldRequired(
  name: SignupMetadataFieldName,
  fields: SignupMetadataFields,
  values: SignupMetadataValues,
): boolean {
  return isMetadataFieldShown(name, fields, values) && Boolean(fields[name]?.required)
}

interface SelectOption {
  value: string
  label: string
}

/**
 * `/environment` sends the choice lists as `[value, label]` pairs, and the loose type allows a pair with
 * no label.
 */
function toSelectOptions(choices: string[][] | undefined): SelectOption[] {
  return (choices ?? []).map(([value, label]) => {
    return { value, label: label ?? value }
  })
}

/** The two choice lists `/environment` sends, for the dropdowns whose options the server owns. */
export interface MetadataChoices {
  sectorChoices: string[][] | undefined
  countryChoices: string[][] | undefined
}

/** The dropdown options for a field, or `null` for the ones that are plain text inputs. */
export function getMetadataFieldOptions(
  name: SignupMetadataFieldName,
  choices: MetadataChoices,
): SelectOption[] | null {
  switch (name) {
    case 'country':
      return toSelectOptions(choices.countryChoices)
    case 'sector':
      return toSelectOptions(choices.sectorChoices)
    // The frontend owns these two lists, so signup and account settings offer the same answers.
    case 'organization_type':
      return ORGANIZATION_TYPE_SELECT_OPTIONS
    case 'gender':
      return GENDER_SELECT_OPTIONS
    default:
      return null
  }
}
