import React from 'react'

import TextBox from '#/components/common/textBox'
import WrappedSelect from '#/components/common/wrappedSelect'
import { EXTRA_PROJECT_METADATA_FIELD_TYPES } from '#/constants'
import envStore from '#/envStore'
import { addRequiredToLabel } from '#/textUtils'
import { currentLang } from '#/utils'

import styles from './extraProjectMetadataFields.module.scss'

/**
 * Renders the appropriate input for a single extra metadata field based on its
 * type. Supported types are `single_select`, `multi_select`, and the default
 * plain-text input.
 *
 * For select fields the component converts between the raw stored value (a
 * string key or array of string keys) and the option objects that
 * `WrappedSelect` expects, so callers can always work with plain primitives.
 */
const ExtraProjectMetadataField = ({ field, value, onChange, hasError, fieldClassName }) => {
  const label = envStore.data.getExtraFieldLabel(field, currentLang())
  const wrapperClass = fieldClassName ?? styles.field

  if (
    field.type === EXTRA_PROJECT_METADATA_FIELD_TYPES.SINGLE_SELECT ||
    field.type === EXTRA_PROJECT_METADATA_FIELD_TYPES.MULTI_SELECT
  ) {
    const options = (field.options ?? []).map((opt) => {
      return {
        value: opt.name,
        label: envStore.data.getExtraFieldLabel(opt, currentLang()),
      }
    })

    const isMulti = field.type === EXTRA_PROJECT_METADATA_FIELD_TYPES.MULTI_SELECT
    const selectValue = isMulti
      ? options.filter((opt) => (value ?? []).includes(opt.value))
      : (options.find((opt) => opt.value === value) ?? null)

    return (
      <div className={wrapperClass}>
        <WrappedSelect
          label={addRequiredToLabel(label, field.required)}
          isMulti={isMulti}
          value={selectValue}
          onChange={(val) => onChange(field.name, isMulti ? (val ?? []).map((o) => o.value) : (val?.value ?? null))}
          options={options}
          isLimitedHeight
          isClearable
          menuPlacement='auto'
          error={hasError ? t('Please select an option') : false}
        />
      </div>
    )
  }

  return (
    <div className={wrapperClass}>
      <TextBox
        value={value ?? ''}
        onChange={(val) => onChange(field.name, val)}
        label={addRequiredToLabel(label, field.required)}
        placeholder={label}
        errors={hasError ? t('This field is required') : false}
      />
    </div>
  )
}

/**
 * Renders all extra project metadata fields configured by the superuser in the
 * environment store.
 *
 * @param {Object} values - Map of field name → current raw value.
 * @param {Function} onChange - Called with (fieldName, newRawValue).
 * @param {Function} [hasFieldError] - Returns true when a field has a
 *   validation error. Defaults to always returning false (no errors shown).
 */
const ExtraProjectMetadataFields = ({ values, onChange, hasFieldError = () => false, fieldClassName }) =>
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
