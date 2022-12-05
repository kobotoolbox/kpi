import React, {useState} from 'react';
import type {ProjectsFilterDefinition} from './projectsView/projectsViewConstants';
import ProjectsFilter from './projectsView/projectsFilter';
import ViewSwitcher from './projectsView/viewSwitcher';

export default function CustomViewsRoute() {
  const [filters, setFilters] = useState<ProjectsFilterDefinition[]>([]);

  return (
    <section>
      <div>
        <ViewSwitcher viewUid='1' viewCount={15}/>

        <ProjectsFilter
          onFiltersChange={setFilters}
          filters={filters}
        />
      </div>

      TBD Custom View 1
    </section>
  );
}
