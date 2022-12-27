import React from 'react';
import Button from 'js/components/common/button';
import TextBox from 'js/components/common/textBox';
import KoboSelect from 'js/components/common/koboSelect';
import {generateUid} from 'js/utils';
import type {
  FilterConditionName,
  ProjectFieldName,
  ProjectsFilterDefinition,
} from './constants';
import {FILTER_CONDITIONS, PROJECT_FIELDS} from './constants';
import {isFilterConditionValueRequired} from './utils';
import styles from './projectsFilterEditor.module.scss';

interface ProjectsFilterEditorProps {
  filter: ProjectsFilterDefinition;
  hideLabels?: boolean;
  /** Called on every change. */
  onFilterChange: (filter: ProjectsFilterDefinition) => void;
  onDelete: () => void;
}

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
      condition: props.filter.condition,
      value: props.filter.value,
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
      .filter((filterDefinition) => filterDefinition.filterable)
      .map((filterDefinition) => {
        return {label: filterDefinition.label, id: filterDefinition.name};
      });

  const getConditionSelectorOptions = () =>
    Object.values(FILTER_CONDITIONS).map((conditionDefinition) => {
      return {label: conditionDefinition.label, id: conditionDefinition.name};
    });

  return (
    <div className={styles.root}>
      {/* Filter field selector */}
      <div className={styles.column}>
        {!props.hideLabels && (
          <span className={styles.label}>{t('Filter by')}</span>
        )}
        <KoboSelect
          name={generateUid()}
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
          name={generateUid()}
          type='outline'
          size='m'
          isClearable
          isSearchable
          options={getConditionSelectorOptions()}
          selectedOption={props.filter.condition || null}
          onChange={onConditionSelectorChange}
          placeholder={t('Select condition')}
        />
      </div>

      {/* Filter value */}
      <div className={styles.column}>
        {!props.hideLabels && (
          <span className={styles.label}>{t('Value')}</span>
        )}
        {!isFilterConditionValueRequired(props.filter.condition) && <div />}
        {isFilterConditionValueRequired(props.filter.condition) && (
          <TextBox
            customModifiers='on-white'
            value={props.filter.value || ''}
            onChange={onFilterValueChange}
            placeholder={t('Enter value')}
          />
        )}
      </div>

      <div className={styles.column}>
        <Button
          type='bare'
          color='red'
          size='m'
          onClick={props.onDelete}
          startIcon='trash'
        />
      </div>
    </div>
  );
}
