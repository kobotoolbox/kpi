import React from 'react'

import TextBox from '#/components/common/textBox'
import WrappedSelect from '#/components/common/wrappedSelect'
import { EXTRA_PROJECT_METADATA_FIELD_TYPES } from '#/constants'
import envStore, { type ExtraProjectMetadataField } from '#/envStore'
import { addRequiredToLabel } from '#/textUtils'
import { currentLang } from '#/utils'
import styles from './extraProjectMetadataFields.module.scss'

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
  fieldClassName?: string
}

/**
 * Renders the appropriate input for a single extra metadata field based on its
 * type. Supported types are `single_select`, `multi_select`, and the default
 * plain-text input.
 *
 * For select fields the component converts between the raw stored value (a
 * string key or array of string keys) and the option objects that
 * `WrappedSelect` expects, so callers can always work with plain primitives.
 */
const ExtraProjectMetadataField = ({
  field,
  value,
  onChange,
  hasError,
  fieldClassName,
}: ExtraProjectMetadataFieldProps) => {
  const label = envStore.data.getExtraFieldLabel(field, currentLang())
  const wrapperClass = fieldClassName ?? styles.field

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
    const selectValue = isMulti
      ? options.filter((opt) => multiValue.includes(opt.value))
      : (options.find((opt) => opt.value === value) ?? null)

    return (
      <div className={wrapperClass}>
        <WrappedSelect
          label={addRequiredToLabel(label, field.required)}
          isMulti={isMulti}
          value={selectValue}
          onChange={(val: unknown) =>
            onChange(
              field.name,
              isMulti
                ? ((val as readonly SelectOption[] | null) ?? []).map((o) => o.value)
                : ((val as SelectOption | null)?.value ?? null),
            )
          }
          options={options}
          isLimitedHeight
          isClearable
          menuPlacement='auto'
          error={hasError ? t('Please select an option') : undefined}
        />
      </div>
    )
  }

  return (
    <div className={wrapperClass}>
      <TextBox
        value={typeof value === 'string' ? value : ''}
        onChange={(val) => onChange(field.name, val)}
        label={addRequiredToLabel(label, field.required)}
        placeholder={label}
        errors={hasError ? t('This field is required') : false}
      />
    </div>
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
}: ExtraProjectMetadataFieldsProps) =>
  envStore.data.extra_project_metadata_fields.map((field) => (
    <ExtraProjectMetadataField
      key={field.name}
      field={field}
      value={values[field.name]}
      onChange={onChange}
      hasError={hasFieldError(field.name)}
      fieldClassName={fieldClassName}
    />
  ))

export default ExtraProjectMetadataFields
