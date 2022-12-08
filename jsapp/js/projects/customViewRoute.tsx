import React, {useState, useEffect} from 'react';
import {useParams} from 'react-router-dom';
import {notify, downloadUrl} from 'js/utils';
import type {
  ProjectsFilterDefinition,
  ProjectFieldName,
} from './projectViews/constants';
import ProjectsFilter from './projectViews/projectsFilter';
import ProjectsFieldsSelector from './projectViews/projectsFieldsSelector';
import {
  DEFAULT_PROJECT_FIELDS,
  PROJECT_FIELDS,
} from './projectViews/constants';
import ViewSwitcher from './projectViews/viewSwitcher';
import ProjectsTable, { ProjectsTableOrder } from 'js/projects/projectsTable/projectsTable';
import Button from 'js/components/common/button';
import customViewStore from './customViewStore';
import projectViewsStore from './projectViews/projectViewsStore';
import {observer} from 'mobx-react-lite';

const DEFAULT_ORDER: ProjectsTableOrder = {
  fieldName: PROJECT_FIELDS.name.name,
  direction: PROJECT_FIELDS.name.defaultDirection || 'ascending',
}

function CustomViewRoute() {
  const {viewUid} = useParams();

  if (viewUid === undefined) {
    return null;
  }

  const [projectViews] = useState(projectViewsStore);
  const [customView] = useState(customViewStore);
  const [filters, setFilters] = useState<ProjectsFilterDefinition[]>([]);
  const [fields, setFields] = useState<ProjectFieldName[] | undefined>(undefined);
  const [order, setOrder] = useState<ProjectsTableOrder>(DEFAULT_ORDER);

  useEffect(() => {
    customView.setUp(viewUid);
    customView.fetchAssets();
  }, [viewUid]);

  /** Returns a list of names for fields that have at least 1 filter defined. */
  const getFilteredFieldsNames = () => {
    const outcome: ProjectFieldName[] = [];
    filters.forEach((item: ProjectsFilterDefinition) => {
      if (item.fieldName !== undefined) {
        outcome.push(item.fieldName);
      }
    });
    return outcome;
  };

  const exportAllData = () => {
    notify.warning(t("Export is being generated, you will receive an email when it's done"));
    const foundView = projectViews.getView(viewUid);
    if (foundView) {
      // TODO verify if this is how we want to use that url
      downloadUrl(foundView.assets_export);
      console.log('download', foundView.assets_export);
    }
  };

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
        <ViewSwitcher selectedViewUid={viewUid}/>

        <ProjectsFilter
          onFiltersChange={setFilters}
          filters={filters}
        />

        <ProjectsFieldsSelector
          onFieldsChange={setFields}
          selectedFields={fields}
        />

        <Button
          type='frame'
          color='storm'
          size='s'
          startIcon='download'
          label={t('Export all data')}
          onClick={exportAllData}
        />
      </div>

      <ProjectsTable
        assets={customView.assets}
        isLoading={!customView.isInitialised}
        highlightedFields={getFilteredFieldsNames()}
        visibleFields={fields || DEFAULT_PROJECT_FIELDS}
        order={order}
        onChangeOrderRequested={setOrder}
        onRequestLoadNextPage={customView.fetchMoreAssets}
        hasMorePages={customView.hasMoreAssets}
      />
    </section>
  );
}

export default observer(CustomViewRoute);
