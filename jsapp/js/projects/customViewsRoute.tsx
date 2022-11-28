import React, {useState} from 'react';
import type {ProjectsFilterDefinition} from './projectsView/projectsViewConstants';
import ProjectsFilter from './projectsView/projectsFilter';

export default function CustomViewsRoute() {
  const [filters, setFilters] = useState<ProjectsFilterDefinition[]>([]);

  return (
    <section>
      <h1>Projects View temporary demo</h1>

      <ProjectsFilter
        onFiltersChange={setFilters}
        filters={filters}
      />
    </section>
  );
}
