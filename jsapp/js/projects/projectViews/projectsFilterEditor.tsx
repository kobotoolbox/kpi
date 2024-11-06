// Libraries
import React from 'react';

// Partial components
import Button from 'js/components/common/button';
import TextBox from 'js/components/common/textBox';
import KoboSelect from 'js/components/common/koboSelect';

// Stores and utilities
import {generateUuid} from 'js/utils';
import {isFilterConditionValueRequired} from './utils';
import envStore from 'js/envStore';

// Constants and types
import type {
  FilterConditionName,
  ProjectFieldName,
  ProjectsFilterDefinition,
} from './constants';
import {FILTER_CONDITIONS, PROJECT_FIELDS} from './constants';

// Styles
import styles from './projectsFilterEditor.module.scss';

interface ProjectsFilterEditorProps {
  filter: ProjectsFilterDefinition;
  hideLabels?: boolean;
  /** Called on every change. */
  onFilterChange: (filter: ProjectsFilterDefinition) => void;
  onDelete: () => void;
  /** A list of fields that should not be available to user. */
  excludedFields?: ProjectFieldName[];
}

const COUNTRIES = envStore.data.country_choices;

/**
 * This component renders a single (editable) filter row. It has few dropdowns,
 * and textboxes, and a delete button.
 */
export default function ProjectsFilterEditor(props: ProjectsFilterEditorProps) {
  const onFilterValueChange = (newValue: string) => {
    props.onFilterChange({
      fieldName: props.filter.fieldName,
      condition: props.filter.condition,
      value: newValue,
    });
  };

  const onFieldSelectorChange = (newValue: string | null) => {
    let fieldValue;
    if (newValue) {
      fieldValue = newValue as ProjectFieldName;
    }
    props.onFilterChange({
      fieldName: fieldValue,
      // Switching field causes the condition to be dropped - this ensures
      // we don't end up with unsupported field x condition pair :heart:.
      condition: undefined,
      // We also drop the value (if any) as it doesn't make sense to keep it
      // without condition :shrug:.
      value: undefined,
    });
  };

  const onConditionSelectorChange = (newValue: string | null) => {
    let conditionValue;
    if (newValue) {
      conditionValue = newValue as FilterConditionName;
    }
    props.onFilterChange({
      fieldName: props.filter.fieldName,
      condition: conditionValue,
      value: props.filter.value,
    });
  };

  const getFieldSelectorOptions = () =>
    Object.values(PROJECT_FIELDS)
      // We don't want to display fields with zero filters available.
      .filter(
        (filterDefinition) => filterDefinition.availableConditions.length >= 1
      )
      // We don't want to display excluded fields.
      .filter(
        (filterDefinition) =>
          !props.excludedFields?.includes(filterDefinition.name)
      )
      .map((filterDefinition) => {
        return {label: filterDefinition.label, value: filterDefinition.name};
      });

  const getConditionSelectorOptions = () => {
    if (!props.filter.fieldName) {
      return [];
    }
    const fieldDefinition = PROJECT_FIELDS[props.filter.fieldName];
    return fieldDefinition.availableConditions.map(
      (condition: FilterConditionName) => {
        const conditionDefinition = FILTER_CONDITIONS[condition];
        return {
          label: conditionDefinition.label,
          value: conditionDefinition.name,
        };
      }
    );
  };

  const isCountryFilterSelected =
    props.filter.fieldName && props.filter.fieldName === 'countries';

  return (
    <div className={styles.root}>
      {/* Filter field selector */}
      <div className={styles.column}>
        {!props.hideLabels && (
          <span className={styles.label}>{t('Filter by')}</span>
        )}
        <KoboSelect
          name={generateUuid()}
          type='outline'
          size='m'
          isClearable
          isSearchable
          options={getFieldSelectorOptions()}
          selectedOption={props.filter.fieldName || null}
          onChange={onFieldSelectorChange}
          placeholder={t('Select field')}
        />
      </div>

      {/* Filter condition selector */}
      <div className={styles.column}>
        {!props.hideLabels && (
          <span className={styles.label}>{t('Condition')}</span>
        )}
        <KoboSelect
          name={generateUuid()}
          type='outline'
          size='m'
          isClearable
          isSearchable
          options={getConditionSelectorOptions()}
          selectedOption={props.filter.condition || null}
          onChange={onConditionSelectorChange}
          placeholder={t('Select condition')}
          // Requires field to be selected first
          isDisabled={!props.filter.fieldName}
        />
      </div>

      {/* Filter value */}
      <div className={styles.column}>
        {!props.hideLabels && (
          <span className={styles.label}>{t('Value')}</span>
        )}

        {!isFilterConditionValueRequired(props.filter.condition) && <div />}
        {isFilterConditionValueRequired(props.filter.condition) &&
          !isCountryFilterSelected && (
            <TextBox
              value={props.filter.value || ''}
              onChange={onFilterValueChange}
              placeholder={t('Enter value')}
              // Requires field to be selected first
              disabled={!props.filter.fieldName}
              size='m'
            />
          )}
        {isFilterConditionValueRequired(props.filter.condition) &&
          isCountryFilterSelected && (
            <KoboSelect
              name={generateUuid()}
              type='outline'
              size='m'
              isClearable
              isSearchable
              placeholder={t('Country')}
              selectedOption={props.filter.value || ''}
              options={COUNTRIES}
              onChange={(code: string | null) => {
                onFilterValueChange(code || '');
              }}
              data-cy='country'
            />
          )}
      </div>

      <div className={styles.column}>
        <Button
          type='secondary-danger'
          size='m'
          onClick={props.onDelete}
          startIcon='trash'
        />
      </div>
    </div>
  );
}
