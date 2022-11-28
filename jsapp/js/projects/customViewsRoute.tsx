import React, {useState} from 'react';
import type {
  ProjectsFilterDefinition,
  ProjectFieldName,
} from './projectsView/projectsViewConstants';
import ProjectsFilter from './projectsView/projectsFilter';
import ProjectsFieldsSelector from './projectsView/projectsFieldsSelector';

export default function CustomViewsRoute() {
  const [filters, setFilters] = useState<ProjectsFilterDefinition[]>([]);
  const [fields, setFields] = useState<ProjectFieldName[] | undefined>([]);

  return (
    <section style={{backgroundColor: 'white'}}>
      <h1>Projects View temporary demo</h1>

      <ProjectsFilter
        onFiltersChange={setFilters}
        filters={filters}
      />

      <ProjectsFieldsSelector
        onFieldsChange={setFields}
        selectedFields={fields}
      />
    </section>
  );
}
