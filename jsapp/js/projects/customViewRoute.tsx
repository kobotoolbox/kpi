import React, {useState} from 'react';
import {useParams} from 'react-router-dom'
import {notify} from 'js/utils';
import type {
  ProjectsFilterDefinition,
  ProjectFieldName,
  OrderDirection,
} from './projectViews/constants';
import ProjectsFilter from './projectViews/projectsFilter';
import ProjectsFieldsSelector from './projectViews/projectsFieldsSelector';
import {DEFAULT_PROJECT_FIELDS} from './projectViews/constants';
import ViewSwitcher from './projectViews/viewSwitcher';
import ProjectsTable from 'js/projects/projectsTable/projectsTable';
import Button from 'js/components/common/button';
import mockAssets from './assetsResponseMock';

export default function CustomViewRoute() {
  const {viewUid} = useParams();
  const [filters, setFilters] = useState<ProjectsFilterDefinition[]>([]);
  const [fields, setFields] = useState<ProjectFieldName[] | undefined>(undefined);

  if (viewUid === undefined) {
    return null;
  }

  /** Returns a list of names for fields that have at least 1 filter defined. */
  const getFilteredFieldsNames = () => {
    const outcome: ProjectFieldName[] = [];
    filters.forEach((item: ProjectsFilterDefinition) => {
      if (item.fieldName !== undefined) {
        outcome.push(item.fieldName);
      }
    });
    return outcome;
  };

  const exportAllData = () => {
    notify.warning(t("Export is being generated, you will receive an email when it's done"));
    // TODO make the call :)
    console.log('call backend to initiate downloading data to email');
  };

  return (
    <section style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
      }}>
        <ViewSwitcher selectedViewUid={viewUid}/>

        <ProjectsFilter
          onFiltersChange={setFilters}
          filters={filters}
        />

        <ProjectsFieldsSelector
          onFieldsChange={setFields}
          selectedFields={fields}
        />

        <Button
          type='frame'
          color='storm'
          size='s'
          startIcon='download'
          label={t('Export all data')}
          onClick={exportAllData}
        />
      </div>

      <ProjectsTable
        assets={mockAssets.results}
        highlightedFields={getFilteredFieldsNames()}
        visibleFields={fields || DEFAULT_PROJECT_FIELDS}
        orderFieldName='name'
        orderDirection='ascending'
        onChangeOrderRequested={(fieldName: string, direction: OrderDirection) => console.log(fieldName, direction)}
        onRequestLoadNextPage={() => console.log('load next page please!')}
        hasMorePages
      />
    </section>
  );
}
