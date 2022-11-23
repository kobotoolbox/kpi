import React from 'react';
import type {
  ProjectsFilterDefinition,
  ProjectFieldName,
} from 'js/components/projectsView/projectsViewConstants';
import ProjectsFilter from 'js/components/projectsView/projectsFilter';
import ProjectsFieldsSelector from 'js/components/projectsView/projectsFieldsSelector';

import ProjectsTable from 'js/components/projectsTable/projectsTable';
import type {OrderDirection} from 'js/components/projectsView/projectsViewConstants';
import mockAssets from './assetsResponseMock';

interface ProjectsViewTempDemoState {
  filters: ProjectsFilterDefinition[];
  fields: ProjectFieldName[] | undefined;
}

export default class ProjectsViewTempDemo extends React.Component<{}, ProjectsViewTempDemoState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      filters: [],
      fields: undefined,
    };
  }

  onFiltersChange(filters: ProjectsFilterDefinition[]) {
    console.log('onFiltersChange', filters);
    this.setState({filters: filters});
  }

  onFieldsChange(fields: ProjectFieldName[] | undefined) {
    console.log('onFieldsChange', fields);
    this.setState({fields: fields});
  }

  render() {
    return (
      <section style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}>
        <div>
          <h1>Projects View temporary demo</h1>

          <ProjectsFilter
            onFiltersChange={this.onFiltersChange.bind(this)}
            filters={this.state.filters}
          />


          <ProjectsFieldsSelector
            onFieldsChange={this.onFieldsChange.bind(this)}
            selectedFields={this.state.fields}
          />
        </div>

        <ProjectsTable
          assets={mockAssets.results}
          totalAssets={mockAssets.count}
          orderFieldName='name'
          orderDirection='ascending'
          onChangeOrderRequested={(fieldName: string, direction: OrderDirection) => console.log(fieldName, direction)}
        />
      </section>
    );
  }
}
