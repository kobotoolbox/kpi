import React from 'react'

import { Stack } from '@mantine/core'
import MultiSelect from '#/components/common/MultiSelect'
import Select from '#/components/common/Select'
import TextBox from '#/components/common/textBox'
import { EXTRA_PROJECT_METADATA_FIELD_TYPES } from '#/constants'
import envStore, { type ExtraProjectMetadataField } from '#/envStore'
import { addRequiredToLabel } from '#/textUtils'
import { currentLang } from '#/utils'

type FieldRawValue = string | string[] | null | undefined

type FieldChangeHandler = (fieldName: string, newValue: string | string[] | null) => void

interface SelectOption {
  value: string
  label: string
}

interface ExtraProjectMetadataFieldProps {
  field: ExtraProjectMetadataField
  value: FieldRawValue
  onChange: FieldChangeHandler
  hasError?: boolean
}

/**
 * Renders the appropriate input for a single extra metadata field based on its
 * type. Supported types are `single_select`, `multi_select`, and the default
 * plain-text input.
 *
 * For select fields the component converts between the raw stored value (a
 * string key or array of string keys) and the primitive value format expected
 * by the shared `Select` and `MultiSelect` components.
 */
const ExtraProjectMetadataField = ({ field, value, onChange, hasError }: ExtraProjectMetadataFieldProps) => {
  const label = envStore.data.getExtraFieldLabel(field, currentLang())

  if (
    field.type === EXTRA_PROJECT_METADATA_FIELD_TYPES.SINGLE_SELECT ||
    field.type === EXTRA_PROJECT_METADATA_FIELD_TYPES.MULTI_SELECT
  ) {
    const options: SelectOption[] = (field.options ?? []).map((opt) => {
      return {
        value: opt.name,
        label: envStore.data.getExtraFieldLabel(opt, currentLang()),
      }
    })

    const isMulti = field.type === EXTRA_PROJECT_METADATA_FIELD_TYPES.MULTI_SELECT
    const multiValue = Array.isArray(value) ? value : []
    const multiSelectValue = multiValue
    const singleSelectValue = options.find((opt) => opt.value === value)?.value ?? null

    if (isMulti) {
      return (
        <MultiSelect
          label={addRequiredToLabel(label, field.required)}
          value={multiSelectValue}
          onChange={(newValue) => onChange(field.name, newValue)}
          data={options}
          clearable
          maxDropdownHeight={220}
          error={hasError ? t('Please select an option') : undefined}
        />
      )
    } else {
      return (
        <Select
          label={addRequiredToLabel(label, field.required)}
          value={singleSelectValue}
          onChange={(newValue) => onChange(field.name, newValue)}
          data={options}
          clearable
          maxDropdownHeight={220}
          error={hasError ? t('Please select an option') : undefined}
        />
      )
    }
  }

  return (
    <TextBox
      value={typeof value === 'string' ? value : ''}
      onChange={(val) => onChange(field.name, val)}
      label={addRequiredToLabel(label, field.required)}
      placeholder={label}
      errors={hasError ? t('This field is required') : false}
    />
  )
}

interface ExtraProjectMetadataFieldsProps {
  /** Map of field name → current raw value. */
  values: Record<string, FieldRawValue>
  /** Called with (fieldName, newRawValue). */
  onChange: FieldChangeHandler
  /**
   * Returns true when a field has a validation error. Defaults to always
   * returning false (no errors shown).
   */
  hasFieldError?: (fieldName: string) => boolean
  fieldClassName?: string
}

/**
 * Renders all extra project metadata fields configured by the superuser in the
 * environment store.
 */
const ExtraProjectMetadataFields = ({
  values,
  onChange,
  hasFieldError = () => false,
  fieldClassName,
}: ExtraProjectMetadataFieldsProps) => {
  if (envStore.data.extra_project_metadata_fields.length === 0) {
    return null
  }

  return (
    <Stack gap={15} className={fieldClassName}>
      {envStore.data.extra_project_metadata_fields.map((field) => (
        <ExtraProjectMetadataField
          key={field.name}
          field={field}
          value={values[field.name]}
          onChange={onChange}
          hasError={hasFieldError(field.name)}
        />
      ))}
    </Stack>
  )
}

export default ExtraProjectMetadataFields
