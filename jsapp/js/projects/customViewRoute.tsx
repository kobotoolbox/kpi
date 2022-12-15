import React, {useState, useEffect} from 'react';
import {useParams} from 'react-router-dom';
import {observer} from 'mobx-react-lite';
import {notify, downloadUrl} from 'js/utils';
import type {
  ProjectsFilterDefinition,
  ProjectFieldName,
} from './projectViews/constants';
import ProjectsFilter from './projectViews/projectsFilter';
import ProjectsFieldsSelector from './projectViews/projectsFieldsSelector';
import {DEFAULT_PROJECT_FIELDS} from './projectViews/constants';
import ViewSwitcher from './projectViews/viewSwitcher';
import type {ProjectsTableOrder} from 'js/projects/projectsTable/projectsTable';
import ProjectsTable from 'js/projects/projectsTable/projectsTable';
import Button from 'js/components/common/button';
import customViewStore from './customViewStore';
import projectViewsStore from './projectViews/projectViewsStore';
import styles from './customViewRoute.module.scss';
import {toJS} from 'mobx';

function CustomViewRoute() {
  const {viewUid} = useParams();

  if (viewUid === undefined) {
    return null;
  }

  const [projectViews] = useState(projectViewsStore);
  const [customView] = useState(customViewStore);
  const [fields, setFields] = useState<ProjectFieldName[] | undefined>(undefined);

  useEffect(() => {
    customView.setUp(viewUid);
    customView.fetchAssets();
  }, [viewUid]);

  /** Returns a list of names for fields that have at least 1 filter defined. */
  const getFilteredFieldsNames = () => {
    const outcome: ProjectFieldName[] = [];
    customView.filters.forEach((item: ProjectsFilterDefinition) => {
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
    <section className={styles.root}>
      <header className={styles.header}>
        <ViewSwitcher selectedViewUid={viewUid}/>

        <ProjectsFilter
          onFiltersChange={customView.setFilters.bind(customView)}
          filters={toJS(customView.filters)}
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
      </header>

      <ProjectsTable
        assets={customView.assets}
        isLoading={!customView.isInitialised}
        highlightedFields={getFilteredFieldsNames()}
        visibleFields={fields || DEFAULT_PROJECT_FIELDS}
        order={customView.order}
        onChangeOrderRequested={customView.setOrder.bind(customView)}
        onRequestLoadNextPage={customView.fetchMoreAssets.bind(customView)}
        hasMorePages={customView.hasMoreAssets}
      />
    </section>
  );
}

export default observer(CustomViewRoute);
