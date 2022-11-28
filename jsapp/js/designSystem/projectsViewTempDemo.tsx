import React from 'react';
import type {
  ProjectsFilterDefinition,
  ProjectFieldName,
  OrderDirection,
} from 'js/components/projectsView/projectsViewConstants';
import ProjectsFilter from 'js/components/projectsView/projectsFilter';
import ProjectsFieldsSelector from 'js/components/projectsView/projectsFieldsSelector';
import ProjectsTable from 'js/components/projectsTable/projectsTable';
import mockAssets from './assetsResponseMock';
import ProjectActionButtons from 'js/components/projectsTable/projectActionButtons';

interface ProjectsViewTempDemoState {
  filters: ProjectsFilterDefinition[];
  fields: ProjectFieldName[] | undefined;
  selectedRows: string[];
}

export default class ProjectsViewTempDemo extends React.Component<{}, ProjectsViewTempDemoState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      filters: [],
      fields: undefined,
      selectedRows: [],
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

  onSelectedRowsChange(uids: string[]) {
    console.log('selected rows', uids);
    this.setState({selectedRows: uids});
  }

  render() {
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
          <h1>Projects View temporary demo</h1>

          <ProjectsFilter
            onFiltersChange={this.onFiltersChange.bind(this)}
            filters={this.state.filters}
          />


          <ProjectsFieldsSelector
            onFieldsChange={this.onFieldsChange.bind(this)}
            selectedFields={this.state.fields}
          />

          <ProjectActionButtons asset={mockAssets.results[0]}/>
        </div>

        <ProjectsTable
          assets={mockAssets.results}
          totalAssets={mockAssets.count}
          orderFieldName='name'
          orderDirection='ascending'
          onChangeOrderRequested={(fieldName: string, direction: OrderDirection) => console.log(fieldName, direction)}
          selectedRows={this.state.selectedRows}
          onRowsSelected={this.onSelectedRowsChange.bind(this)}
          currentPage={1}
          totalPages={35}
          onSwitchPage={(pageNumber: number) => console.log(pageNumber)}
        />
      </section>
    );
  }
}
