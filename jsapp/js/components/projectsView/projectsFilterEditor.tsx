import React from 'react';
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
import {isFilterConditionValueRequired} from './projectsViewUtils';
import './projectsFilterEditor.scss';

bem.ProjectsFilterEditor = makeBem(null, 'projects-filter-editor', 'form');
bem.ProjectsFilterEditor__column = makeBem(bem.ProjectsFilterEditor, 'column');
bem.ProjectsFilterEditor__label = makeBem(bem.ProjectsFilterEditor, 'label', 'label');
bem.ProjectsFiltereditor__noValue = makeBem(bem.ProjectsFilterEditor, 'no-value');

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
      <bem.ProjectsFilterEditor__column>
        {!props.hideLabels &&
          <bem.ProjectsFilterEditor__label>
            {t('Filter by')}
          </bem.ProjectsFilterEditor__label>
        }
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
      </bem.ProjectsFilterEditor__column>

      {/* Filter condition selector */}
      <bem.ProjectsFilterEditor__column>
        {!props.hideLabels &&
          <bem.ProjectsFilterEditor__label>
            {t('Condition')}
          </bem.ProjectsFilterEditor__label>
        }
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
      </bem.ProjectsFilterEditor__column>

      {/* Filter value */}
      <bem.ProjectsFilterEditor__column>
        {!props.hideLabels &&
          <bem.ProjectsFilterEditor__label>
            {t('Value')}
          </bem.ProjectsFilterEditor__label>
        }
        {!isFilterConditionValueRequired(props.filter.condition) &&
          <bem.ProjectsFiltereditor__noValue/>
        }
        {isFilterConditionValueRequired(props.filter.condition) &&
          <TextBox
            customModifiers='on-white'
            value={props.filter.value || ''}
            onChange={onFilterValueChange}
            placeholder={t('Enter value')}
          />
        }
      </bem.ProjectsFilterEditor__column>

      <bem.ProjectsFilterEditor__column>
        <Button
          type='bare'
          color='red'
          size='m'
          onClick={props.onDelete}
          startIcon='trash'
        />
      </bem.ProjectsFilterEditor__column>
    </bem.ProjectsFilterEditor>
  );
}
