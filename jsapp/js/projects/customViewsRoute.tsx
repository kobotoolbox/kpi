import React, {useState} from 'react';
import type {
  ProjectsFilterDefinition,
  ProjectFieldName,
} from './projectsView/projectsViewConstants';
import ProjectsFilter from './projectsView/projectsFilter';
import ProjectsFieldsSelector from './projectsView/projectsFieldsSelector';
import ViewSwitcher from './projectsView/viewSwitcher';

export default function CustomViewsRoute() {
  const [filters, setFilters] = useState<ProjectsFilterDefinition[]>([]);
  const [fields, setFields] = useState<ProjectFieldName[] | undefined>([]);

  return (
    <section>
      <div>
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

      TBD Custom View 1
    </section>
  );
}
