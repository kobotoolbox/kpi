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
import mockAssets from './assetsResponseMock';

export default function CustomViewsRoute() {
  const [filters, setFilters] = useState<ProjectsFilterDefinition[]>([]);
  const [fields, setFields] = useState<ProjectFieldName[] | undefined>(undefined);

  const getHighlightedFields = () => {
    const outcome: ProjectFieldName[] = [];
    filters.forEach((item: ProjectsFilterDefinition) => {
      if (item.fieldName !== undefined) {
        outcome.push(item.fieldName);
      }
    });
    return outcome;
  }

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
      </div>

      <ProjectsTable
        assets={mockAssets.results}
        highlightedFields={getHighlightedFields()}
        orderFieldName='name'
        orderDirection='ascending'
        onChangeOrderRequested={(fieldName: string, direction: OrderDirection) => console.log(fieldName, direction)}
        onRequestLoadNextPage={() => console.log('load next page please!')}
        hasMorePages
      />
    </section>
  );
}
