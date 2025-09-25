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

export const USER_FIELD_NAMES: Record<UserFieldName, UserFieldName> = {
  bio: 'bio',
  city: 'city',
  country: 'country',
  gender: 'gender',
  instagram: 'instagram',
  linkedin: 'linkedin',
  name: 'name',
  newsletter_subscription: 'newsletter_subscription',
  organization_type: 'organization_type',
  organization_website: 'organization_website',
  organization: 'organization',
  require_auth: 'require_auth',
  sector: 'sector',
  twitter: 'twitter',
}
