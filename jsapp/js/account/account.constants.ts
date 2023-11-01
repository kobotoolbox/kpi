export type UserFieldName =
  | 'name'
  | 'organization'
  | 'organization_website'
  | 'sector'
  | 'gender'
  | 'bio'
  | 'city'
  | 'country'
  | 'require_auth'
  | 'twitter'
  | 'linkedin'
  | 'instagram';

type UserFieldNames = {[P in UserFieldName]: UserFieldName};
export const USER_FIELD_NAMES: UserFieldNames = {
  name: 'name',
  organization: 'organization',
  organization_website: 'organization_website',
  sector: 'sector',
  gender: 'gender',
  bio: 'bio',
  city: 'city',
  country: 'country',
  require_auth: 'require_auth',
  twitter: 'twitter',
  linkedin: 'linkedin',
  instagram: 'instagram',
};
