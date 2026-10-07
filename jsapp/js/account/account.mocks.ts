import type { UserFieldName } from './account.constants'

/**
 * The set an instance gets when an administrator asks for the organization block. Spelled out rather than
 * built from `MMO_MANAGED_FIELD_NAMES`, because tests assert on this order and that constant uses another.
 */
export const ORG_FIELDS: UserFieldName[] = ['name', 'organization_type', 'organization', 'organization_website']
