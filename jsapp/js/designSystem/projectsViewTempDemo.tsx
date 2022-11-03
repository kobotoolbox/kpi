import React from 'react';
import type {ProjectsFilterDefinition} from 'js/components/projectsView/projectsViewConstants';
import ProjectsFilter from 'js/components/projectsView/projectsFilter';

interface ProjectsViewTempDemoState {
  filters: ProjectsFilterDefinition[];
}

export default class ProjectsViewTempDemo extends React.Component<{}, ProjectsViewTempDemoState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      filters: [],
    };
  }

  onFiltersChange(filters: ProjectsFilterDefinition[]) {
    this.setState({filters: filters});
  }

  render() {
    return (
      <section>
        <h1>Projects View temporary demo</h1>

        <ProjectsFilter
          onFiltersChange={this.onFiltersChange.bind(this)}
          filters={this.state.filters}
        />

        <hr/>
      </section>
    );
  }
}
