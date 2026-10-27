/**
 * This is a list of user metadata fields known by Front end code. If you happen
 * to add new fields, please updated this interface first :)
 */
export interface AccountFieldsValues {
  bio?: string
  city?: string
  country?: string
  gender?: string
  instagram?: string
  linkedin?: string
  name: string
  newsletter_subscription?: boolean
  organization_type?: string
  organization_website?: string
  organization: string
  require_auth: boolean
  sector?: string
  twitter?: string
}

export type AccountFieldsErrors = { [name in UserFieldName]?: string }

export type UserFieldName = keyof AccountFieldsValues

/**
 * Organization details belong to the organization once it has more than one member, so its members cannot
 * write them through `/me/`
 */
export const MMO_MANAGED_FIELD_NAMES: readonly UserFieldName[] = [
  'organization',
  'organization_website',
  'organization_type',
]

/**
 * The fields that only mean anything for somebody who is with an organization, so `organization_type: 'none'`
 * takes them out of play - see `areOrganizationFieldsSkipped` in `account.utils`.
 */
export const ORGANIZATION_DEPENDENT_FIELD_NAMES: readonly UserFieldName[] = ['organization', 'organization_website']
