import React from 'react';
import type {
  ProjectsFilterDefinition,
  ProjectFieldName,
} from 'js/components/projectsView/projectsViewConstants';
import ProjectsFilter from 'js/components/projectsView/projectsFilter';
import ProjectsFieldsSelector from 'js/components/projectsView/projectsFieldsSelector';

interface ProjectsViewTempDemoState {
  filters: ProjectsFilterDefinition[];
  fields: ProjectFieldName[];
}

export default class ProjectsViewTempDemo extends React.Component<{}, ProjectsViewTempDemoState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      filters: [],
      fields: [],
    };
  }

  onFiltersChange(filters: ProjectsFilterDefinition[]) {
    this.setState({filters: filters});
  }

  onFieldsChange(fields: ProjectFieldName[]) {
    this.setState({fields: fields});
  }

  render() {
    return (
      <section>
        <h1>Projects View temporary demo</h1>

        <ProjectsFilter
          onFiltersChange={this.onFiltersChange.bind(this)}
          filters={this.state.filters}
        />


        <ProjectsFieldsSelector
          onFieldsChange={this.onFieldsChange.bind(this)}
          fields={this.state.fields}
        />
        <hr/>
      </section>
    );
  }
}
