import type { AccountFieldsErrors, AccountFieldsValues, UserFieldName } from '#/account/account.constants'
import {
  MMO_MANAGED_FIELD_NAMES,
  ORGANIZATION_DEPENDENT_FIELD_NAMES,
  USER_FIELD_NAMES,
} from '#/account/account.constants'
import { hasNoOrganizationAffiliation } from '#/account/account.utils'

/**
 * Fields `AccountFieldsEditor` renders without a slot for an error message. A message about one of these
 * has to go in the banner instead, or it would be dropped and the user would be left clicking a button
 * that keeps failing for no visible reason.
 */
const FIELD_NAMES_WITHOUT_ERROR_SLOT: readonly UserFieldName[] = [USER_FIELD_NAMES.newsletter_subscription]

export interface ProfileFieldsContext {
  /** Every field the instance configures through `USER_METADATA_FIELDS`, in the order it lists them. */
  configuredFieldNames: UserFieldName[]
  /** The subset of `configuredFieldNames` the instance marks required. */
  requiredFieldNames: UserFieldName[]
  /** Whether the user belongs to an organization with more than one member. */
  isMmoMember: boolean
}

/**
 * The required fields that are still blank, which is what decides whether the profile screen blocks the
 * app at all.
 *
 * This mirrors `CurrentUserSerializer.validate_extra_details` deliberately: if the two ever disagree, the
 * user gets either a screen they cannot satisfy or a save that puts the screen straight back up.
 */
export function getBlankRequiredProfileFieldNames(
  values: AccountFieldsValues,
  { configuredFieldNames, requiredFieldNames, isMmoMember }: ProfileFieldsContext,
): UserFieldName[] {
  const organizationFieldsSkipped = hasNoOrganizationAffiliation(values, configuredFieldNames)

  return requiredFieldNames.filter((name) => {
    // Not this user's to write, so a blank one is not theirs to fix either and must not hold them back.
    if (isMmoMember && MMO_MANAGED_FIELD_NAMES.includes(name)) {
      return false
    }
    if (organizationFieldsSkipped && ORGANIZATION_DEPENDENT_FIELD_NAMES.includes(name)) {
      return false
    }
    // Falsy rather than `=== ''`, because the server decides this with Python truthiness: an unticked
    // required checkbox counts as blank there, so it has to count as blank here too.
    return !values[name]
  })
}

export function doBlankFieldsDependOnMmoStatus(blankFieldNames: readonly UserFieldName[]): boolean {
  return blankFieldNames.some((name) => MMO_MANAGED_FIELD_NAMES.includes(name))
}

/** Narrows to something we can safely call `Object.entries` on. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Flattens whatever DRF put in an error value into one line. A serializer can answer with a bare string,
 * a list of them, or a dict of either, and all of those have to end up readable.
 */
function toErrorMessage(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }
  if (Array.isArray(value)) {
    return value.map(toErrorMessage).filter(Boolean).join(' ')
  }
  if (isRecord(value)) {
    return Object.values(value).map(toErrorMessage).filter(Boolean).join(' ')
  }
  if (value === null || value === undefined || typeof value === 'boolean') {
    return ''
  }
  return String(value)
}

export interface ProfileUpdateErrors {
  /** Messages the fields editor can show under the input they belong to. */
  fieldErrors: AccountFieldsErrors
  /** Everything we could not attach to a visible input, for the banner above the form. */
  formErrors: string[]
}

export interface ProfileUpdateErrorsOptions {
  /** What the editor is showing, so no message ends up hidden under an input nobody can see. */
  displayedFieldNames: UserFieldName[]
  /** Names the field a banner message is about. Called only for messages that cannot stay inline. */
  labelFor: (fieldName: UserFieldName) => string
}

/** Whether the editor has somewhere to put a message about this field. */
function canShowInline(fieldName: string, displayedFieldNames: UserFieldName[]): fieldName is UserFieldName {
  return (
    fieldName in USER_FIELD_NAMES &&
    displayedFieldNames.includes(fieldName as UserFieldName) &&
    !FIELD_NAMES_WITHOUT_ERROR_SLOT.includes(fieldName as UserFieldName)
  )
}

/**
 * The messages for required fields left blank, in the same two buckets a rejection gets sorted into - so
 * the client's own complaints land exactly where the server's do.
 */
export function getRequiredProfileFieldErrors(
  blankFieldNames: UserFieldName[],
  { displayedFieldNames, labelFor }: ProfileUpdateErrorsOptions,
): ProfileUpdateErrors {
  const fieldErrors: AccountFieldsErrors = {}
  const formErrors: string[] = []
  const message = t('Required field')

  for (const fieldName of blankFieldNames) {
    if (canShowInline(fieldName, displayedFieldNames)) {
      fieldErrors[fieldName] = message
    } else {
      formErrors.push(`${labelFor(fieldName)}: ${message}`)
    }
  }

  return { fieldErrors, formErrors }
}

/**
 * Sorts a rejected `/me/` PATCH into messages that belong under an input and messages that belong in the
 * banner above the form.
 *
 * `ServerError.parsedResponse` is `unknown` by design here: this reads whatever the server actually sent
 * rather than what the schema promises, because a 400 body is exactly where the two tend to part ways.
 */
export function splitProfileUpdateErrors(
  parsedResponse: unknown,
  { displayedFieldNames, labelFor }: ProfileUpdateErrorsOptions,
): ProfileUpdateErrors {
  const fieldErrors: AccountFieldsErrors = {}
  const formErrors: string[] = []

  // A non-JSON body (an HTML error page, say) arrives as the raw text.
  if (typeof parsedResponse === 'string') {
    const message = parsedResponse.trim()
    return { fieldErrors, formErrors: message ? [message] : [] }
  }

  if (!isRecord(parsedResponse)) {
    return { fieldErrors, formErrors }
  }

  for (const [key, value] of Object.entries(parsedResponse)) {
    // The profile fields are nested, because that is where they were sent.
    if (key === 'extra_details' && isRecord(value)) {
      for (const [fieldName, fieldValue] of Object.entries(value)) {
        const message = toErrorMessage(fieldValue)
        if (!message) {
          continue
        }
        if (canShowInline(fieldName, displayedFieldNames)) {
          fieldErrors[fieldName] = message
        } else if (fieldName in USER_FIELD_NAMES) {
          // Named, so the banner can say which field this is about.
          formErrors.push(`${labelFor(fieldName as UserFieldName)}: ${message}`)
        } else {
          // A field this build has never heard of. Quoting the message on its own beats dropping it.
          formErrors.push(message)
        }
      }
      continue
    }

    // Anything else is about the request as a whole - `detail` on a 401, a rule we don't know about yet.
    const message = toErrorMessage(value)
    if (message) {
      formErrors.push(message)
    }
  }

  return { fieldErrors, formErrors }
}
