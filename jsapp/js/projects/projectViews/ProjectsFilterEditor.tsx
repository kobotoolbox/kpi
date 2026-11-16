import React from 'react'
import ActionIcon from '#/components/common/ActionIcon'
import MultiSelect from '#/components/common/MultiSelect'
import Select from '#/components/common/Select'
import TextInput from '#/components/common/TextInput'
import envStore from '#/envStore'
import { KOBO_Z_INDEX } from '#/theme/kobo/zIndex'
import { recordValues } from '#/utils'
import styles from './ProjectsFilterEditor.module.scss'
import type { FilterConditionName, ProjectFieldName, ProjectsFilterDefinition } from './constants'
import { FILTER_CONDITIONS, PROJECT_FIELDS } from './constants'
import { getFilterValues, isFilterConditionValueRequired } from './utils'

interface ProjectsFilterEditorProps {
  filter: ProjectsFilterDefinition
  hideLabels?: boolean
  /** Called on every change. */
  onFilterChange: (filter: ProjectsFilterDefinition) => void
  onDelete: () => void
  /** A list of fields that should not be available to user. */
  excludedFields?: ProjectFieldName[]
}

/** Known values for a field, if any. Env choices are read on render, as they load after import. */
const getValueOptions = (fieldName?: ProjectFieldName) => {
  if (fieldName === 'sector') {
    return envStore.data.sector_choices
  }
  if (fieldName === 'countries') {
    return envStore.data.country_choices
  }
  return fieldName && PROJECT_FIELDS[fieldName].valueOptions
}

/**
 * This component renders a single (editable) filter row. It has few dropdowns,
 * and textboxes, and a delete button.
 */
export default function ProjectsFilterEditor(props: ProjectsFilterEditorProps) {
  const onFilterValueChange = (newValue: string | string[]) => {
    props.onFilterChange({
      fieldName: props.filter.fieldName,
      condition: props.filter.condition,
      value: newValue,
    })
  }

  const onFieldSelectorChange = (newValue: string | null) => {
    let fieldValue
    if (newValue) {
      fieldValue = newValue as ProjectFieldName
    }
    props.onFilterChange({
      fieldName: fieldValue,
      // Switching field causes the condition to be dropped - this ensures
      // we don't end up with unsupported field x condition pair :heart:.
      condition: undefined,
      // We also drop the value (if any) as it doesn't make sense to keep it
      // without condition :shrug:.
      value: undefined,
    })
  }

  const onConditionSelectorChange = (newValue: string | null) => {
    let conditionValue
    if (newValue) {
      conditionValue = newValue as FilterConditionName
    }
    props.onFilterChange({
      fieldName: props.filter.fieldName,
      condition: conditionValue,
      value: props.filter.value,
    })
  }

  const getFieldSelectorOptions = () =>
    recordValues(PROJECT_FIELDS)
      // We don't want to display fields with zero filters available.
      .filter((filterDefinition) => filterDefinition.availableConditions.length >= 1)
      // We don't want to display excluded fields.
      .filter((filterDefinition) => !props.excludedFields?.includes(filterDefinition.name))
      .map((filterDefinition) => {
        return { label: filterDefinition.label, value: filterDefinition.name }
      })

  const getConditionSelectorOptions = () => {
    if (!props.filter.fieldName) {
      return []
    }
    const fieldDefinition = PROJECT_FIELDS[props.filter.fieldName]
    return fieldDefinition.availableConditions.map((condition: FilterConditionName) => {
      const conditionDefinition = FILTER_CONDITIONS[condition]
      return {
        label: conditionDefinition.label,
        value: conditionDefinition.name,
      }
    })
  }

  const renderValueInput = () => {
    if (!isFilterConditionValueRequired(props.filter.condition)) {
      return <div />
    }

    const valueOptions = getValueOptions(props.filter.fieldName)
    if (valueOptions) {
      return (
        <MultiSelect
          size='sm'
          clearable
          placeholder={t('Select values')}
          // Older saved filters have a single string
          value={getFilterValues(props.filter)}
          data={valueOptions}
          onChange={onFilterValueChange}
          // In a portal, so the modal doesn't clip it. This replaces the theme's comboboxProps, so zIndex is set again.
          comboboxProps={{ withinPortal: true, zIndex: KOBO_Z_INDEX.dropdown }}
        />
      )
    }

    const textValue = typeof props.filter.value === 'string' ? props.filter.value : ''
    return (
      <TextInput
        value={textValue}
        onChange={(evt) => onFilterValueChange(evt.currentTarget.value)}
        placeholder={t('Enter value')}
        // Requires field to be selected first
        disabled={!props.filter.fieldName}
        size='sm'
      />
    )
  }

  return (
    <div className={styles.root}>
      {/* Filter field selector */}
      <div className={styles.column}>
        {!props.hideLabels && <span className={styles.label}>{t('Filter by')}</span>}
        <Select
          size='sm'
          clearable
          data={getFieldSelectorOptions()}
          value={props.filter.fieldName || null}
          onChange={onFieldSelectorChange}
          placeholder={t('Select field')}
        />
      </div>

      {/* Filter condition selector */}
      <div className={styles.column}>
        {!props.hideLabels && <span className={styles.label}>{t('Condition')}</span>}
        <Select
          size='sm'
          clearable
          data={getConditionSelectorOptions()}
          value={props.filter.condition || null}
          onChange={onConditionSelectorChange}
          placeholder={t('Select condition')}
          // Requires field to be selected first
          disabled={!props.filter.fieldName}
        />
      </div>

      {/* Filter value */}
      <div className={styles.column}>
        {!props.hideLabels && <span className={styles.label}>{t('Value')}</span>}

        {renderValueInput()}
      </div>

      <div className={styles.column}>
        <ActionIcon
          variant='danger-secondary'
          size='md'
          iconName='trash'
          tooltip={t('Delete')}
          onClick={props.onDelete}
        />
      </div>
    </div>
  )
}
