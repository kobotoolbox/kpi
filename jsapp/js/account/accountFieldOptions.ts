import type { OrganizationTypeEnum } from '#/api/models/organizationTypeEnum'
import { recordValues } from '#/utils'

/**
 * The choice lists for the user metadata fields the frontend owns, as opposed to `sector` and `country`,
 * whose options `/environment` sends. Kept out of the components that render them so every screen asking
 * for these details offers the same answers.
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
