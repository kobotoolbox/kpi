/**
 * This is a list of user metadata fields known by Front end code. If you happen
 * to add new fields, please updated this interface first :)
 */
export interface AccountFieldsValues {
  name: string;
  organization: string;
  organization_website: string;
  sector: string;
  gender: string;
  bio: string;
  city: string;
  country: string;
  require_auth: boolean;
  twitter: string;
  linkedin: string;
  instagram: string;
}

export type AccountFieldsErrors = {[name in UserFieldName]?: string};

export type UserFieldName = keyof AccountFieldsValues;

export const USER_FIELD_NAMES: Record<UserFieldName, UserFieldName> = {
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
