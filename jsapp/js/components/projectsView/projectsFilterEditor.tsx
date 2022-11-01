import React, {
  useState,
  useEffect,
} from 'react';
import bem, {makeBem} from 'js/bem';
import Button from 'js/components/common/button';
import TextBox from 'js/components/common/textBox';
import KoboSelect from 'js/components/common/koboSelect';
import {generateUid} from 'js/utils';
import type {
  FilterConditionName,
  FilterFieldName,
  ProjectsFilterDefinition,
} from './projectsViewConstants';
import {FILTER_CONDITIONS, FILTER_FIELDS} from './projectsViewConstants';
import './projectsFilterEditor.scss';

bem.ProjectsFilterEditor = makeBem(null, 'projects-filter-editor', 'form');

interface ProjectsFilterEditorProps {
  filter: ProjectsFilterDefinition;
  hideLabels?: boolean;
  /** Called on every change. */
  onFilterChange: (filter: ProjectsFilterDefinition) => void;
  onDelete: () => void;
}

export default function ProjectsFilterEditor(props: ProjectsFilterEditorProps) {
  const [filter, setFilter] = useState(props.filter);

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
      fieldValue = newValue as FilterFieldName;
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

  const isValueRequired = () => {
    if (props.filter.condition) {
      const conditionDefinition = FILTER_CONDITIONS[props.filter.condition];
      if (conditionDefinition) {
        return conditionDefinition.requiresValue;
      }
    }
    return true;
  };

  const getFieldSelectorOptions = () => (
    Object.values(FILTER_FIELDS).map((filterDefinition) => {
      return {label: filterDefinition.label, id: filterDefinition.name};
    })
  );

  const getConditionSelectorOptions = () => (
    Object.values(FILTER_CONDITIONS).map((conditionDefinition) => {
      return {label: conditionDefinition.label, id: conditionDefinition.name};
    })
  );

  return (
    <bem.ProjectsFilterEditor>
      {/* Filter field selector */}
      <div>
        <label>{t('Filter by')}</label>
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
      <div>
        <label>{t('Condition')}</label>
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
      {isValueRequired() &&
        <TextBox
          customModifiers='on-white'
          value={props.filter.value || ''}
          onChange={onFilterValueChange}
          label={props.hideLabels ? undefined : t('Value')}
          placeholder={t('Enter value')}
        />
      }

      <Button
        type='bare'
        color='red'
        size='m'
        onClick={props.onDelete}
        startIcon='trash'
      />
    </bem.ProjectsFilterEditor>
  );
}
