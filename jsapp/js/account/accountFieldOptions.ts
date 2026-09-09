import type { OrganizationTypeEnum } from '#/api/models/organizationTypeEnum'
import { recordValues } from '#/utils'

/**
 * The choice lists for the user metadata fields the frontend owns, as opposed to `sector` and `country`,
 * whose options `/environment` sends. Shared by account settings and the signup form, which have to offer
 * the same answers - and the same ones as `KoboSignupMixin` on the backend.
 */

export const ORGANIZATION_TYPES: { [P in OrganizationTypeEnum]: { name: P; label: string } } = {
  'non-profit': { name: 'non-profit', label: t('Non-profit organization') },
  government: { name: 'government', label: t('Government institution') },
  educational: { name: 'educational', label: t('Educational organization') },
  commercial: { name: 'commercial', label: t('A commercial/for-profit company') },
  none: { name: 'none', label: t('I am not associated with any organization') },
}

export const ORGANIZATION_TYPE_SELECT_OPTIONS = recordValues(ORGANIZATION_TYPES).map(({ name, label }) => {
  return { value: name, label }
})

export const GENDER_SELECT_OPTIONS = [
  { value: 'male', label: t('Male') },
  { value: 'female', label: t('Female') },
  { value: 'other', label: t('Other') },
]
