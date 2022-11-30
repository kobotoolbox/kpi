import React, {useState} from 'react';
import type {
  ProjectsFilterDefinition,
  ProjectFieldName,
  OrderDirection,
} from './projectsView/projectsViewConstants';
import ProjectsFilter from './projectsView/projectsFilter';
import ProjectsFieldsSelector from './projectsView/projectsFieldsSelector';
import ViewSwitcher from './projectsView/viewSwitcher';
import ProjectsTable from 'js/projects/projectsTable/projectsTable';
import ProjectActionButtons from 'js/projects/projectsTable/projectActionButtons';
import mockAssets from './assetsResponseMock';

export default function CustomViewsRoute() {
  const [filters, setFilters] = useState<ProjectsFilterDefinition[]>([]);
  const [fields, setFields] = useState<ProjectFieldName[] | undefined>(undefined);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

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
        <ViewSwitcher viewUid='1' viewCount={15}/>

        <ProjectsFilter
          onFiltersChange={setFilters}
          filters={filters}
        />

        <ProjectsFieldsSelector
          onFieldsChange={setFields}
          selectedFields={fields}
        />

        <ProjectActionButtons asset={mockAssets.results[0]}/>
      </div>

      <ProjectsTable
        assets={mockAssets.results}
        totalAssets={mockAssets.count}
        orderFieldName='name'
        orderDirection='ascending'
        onChangeOrderRequested={(fieldName: string, direction: OrderDirection) => console.log(fieldName, direction)}
        selectedRows={selectedRows}
        onRowsSelected={setSelectedRows}
        currentPage={1}
        totalPages={35}
        onSwitchPage={(pageNumber: number) => console.log(pageNumber)}
      />
    </section>
  );
}
