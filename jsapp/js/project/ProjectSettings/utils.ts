import { EXTRA_PROJECT_METADATA_FIELD_TYPES, NAME_MAX_LENGTH } from '#/constants'
import type { AssetResponse, LabelValuePair } from '#/dataInterface'
import envStore from '#/envStore'
import type { ProjectSettingsFields } from './types'

/**
 * Converts an AssetResponse to ProjectSettingsFields for form editing.
 * Handles data normalization and provides sensible defaults for missing values.
 *
 * @param asset - Optional asset to extract settings from (undefined when creating new project)
 * @returns Normalized fields ready for the form
 */
export function getInitialFieldsFromAsset(asset?: AssetResponse): ProjectSettingsFields {
  // Start with empty defaults
  const fields: ProjectSettingsFields = {
    name: '',
    description: '',
    sector: null,
    country: null,
    operational_purpose: null,
    collects_pii: null,
    extra_metadata_fields: {},
  }

  fields.name = asset ? asset.name : ''
  fields.description = asset?.settings?.description ?? ''

  // Sector: validate it's a proper LabelValuePair object before using it
  const sectorValue = asset?.settings?.sector
  fields.sector =
    sectorValue && typeof sectorValue === 'object' && 'value' in sectorValue ? (sectorValue as LabelValuePair) : null

  // Country: normalize both single value and array formats to always be an array
  // (Backend historically allowed both formats, we standardize to array)
  const countryValue = asset?.settings?.country
  if (countryValue && Array.isArray(countryValue)) {
    fields.country = countryValue
  } else if (countryValue && typeof countryValue === 'object' && 'value' in countryValue) {
    // Wrap single value in array for consistency
    fields.country = [countryValue as LabelValuePair]
  } else {
    fields.country = null
  }

  fields.operational_purpose = asset?.settings?.operational_purpose ?? null
  fields.collects_pii = asset?.settings?.collects_pii ?? null

  // Initialize admin-configured extra fields with appropriate defaults based on type
  fields.extra_metadata_fields = {}
  envStore.data.extra_project_metadata_fields.forEach((field) => {
    const value = asset?.settings?.extra_metadata?.[field.name]
    // Default values must match field type to prevent runtime errors:
    const defaultValue =
      field.type === EXTRA_PROJECT_METADATA_FIELD_TYPES.MULTI_SELECT
        ? [] // Multi-select needs empty array (avoids "undefined is not an array" errors)
        : field.type === EXTRA_PROJECT_METADATA_FIELD_TYPES.SINGLE_SELECT
          ? null // Single-select uses null for "no selection" (matches react-select API)
          : '' // Text fields use empty string for controlled input components

    fields.extra_metadata_fields[field.name] = value !== undefined ? value : defaultValue
  })

  return fields
}

/**
 * Extracts filename from a URL by taking the last path segment and removing the extension.
 * Used when importing XLSForm via URL to suggest a project name.
 */
export function getFilenameFromURI(url: string): string {
  const pathname = new URL(url).pathname
  const lastSegment = pathname.split('/').pop()
  if (!lastSegment) {
    return 'imported-form'
  }
  return decodeURIComponent(lastSegment.split('.')[0])
}

export function getSettingsForEndpoint(fields: ProjectSettingsFields): string {
  const settings = {
    description: fields.description,
    sector: fields.sector,
    country: fields.country,
    operational_purpose: fields.operational_purpose,
    collects_pii: fields.collects_pii,
    extra_metadata: fields.extra_metadata_fields,
  }

  return JSON.stringify(settings)
}

export function getNameInputLabel(nameVal: string): string {
  let label = t('Project Name')
  if (nameVal.length >= NAME_MAX_LENGTH - 99) {
    label += ` (${t('##count## characters left').replace('##count##', String(NAME_MAX_LENGTH - nameVal.length))})`
  }
  return label
}

/**
 * Helper to extract non-boolean field metadata from envStore.
 * Returns null if the field doesn't exist or is a boolean flag.
 */
export function getFieldMetadata(
  fieldName: 'description' | 'sector' | 'country' | 'operational_purpose' | 'collects_pii',
) {
  const result = envStore.data.getProjectMetadataField(fieldName)
  return result && typeof result !== 'boolean' ? result : null
}

/**
 * Validates project settings fields and returns an array of field names with errors.
 * Used by the project settings form submission to check required fields.
 */
export function validateProjectFields(fields: ProjectSettingsFields): string[] {
  const fieldsWithErrors: string[] = []

  // Validate project name (always required)
  if (!fields.name.trim()) {
    fieldsWithErrors.push('name')
  }

  // Validate description field (if required by admin config)
  const descriptionFieldMeta = getFieldMetadata('description')
  if (descriptionFieldMeta?.required && !fields.description.trim()) {
    fieldsWithErrors.push('description')
  }

  // Validate sector field (if required by admin config)
  const sectorFieldMeta = getFieldMetadata('sector')
  if (sectorFieldMeta?.required && !fields.sector) {
    fieldsWithErrors.push('sector')
  }

  // Validate country field (if required by admin config)
  const countryFieldMeta = getFieldMetadata('country')
  if (countryFieldMeta?.required && !fields.country?.length) {
    fieldsWithErrors.push('country')
  }

  // Validate operational purpose field (if required by admin config)
  const operationalPurposeFieldMeta = getFieldMetadata('operational_purpose')
  if (operationalPurposeFieldMeta?.required && !fields.operational_purpose) {
    fieldsWithErrors.push('operational_purpose')
  }

  // Validate PII collection field (if required by admin config)
  const collectsPiiFieldMeta = getFieldMetadata('collects_pii')
  if (collectsPiiFieldMeta?.required && !fields.collects_pii) {
    fieldsWithErrors.push('collects_pii')
  }

  // Validate extra metadata fields configured by admin
  envStore.data.extra_project_metadata_fields.forEach((field) => {
    if (!field.required) return

    const val = fields.extra_metadata_fields[field.name]

    // Multi-select fields must have at least one selection
    if (field.type === EXTRA_PROJECT_METADATA_FIELD_TYPES.MULTI_SELECT) {
      if (!Array.isArray(val) || val.length === 0) {
        fieldsWithErrors.push(field.name)
      }
      return
    }

    // Single-select fields must have a value selected
    if (field.type === EXTRA_PROJECT_METADATA_FIELD_TYPES.SINGLE_SELECT) {
      if (!val) {
        fieldsWithErrors.push(field.name)
      }
      return
    }

    // Text fields must have non-empty content
    if (typeof val !== 'string' || !val.trim()) {
      fieldsWithErrors.push(field.name)
    }
  })

  return fieldsWithErrors
}
