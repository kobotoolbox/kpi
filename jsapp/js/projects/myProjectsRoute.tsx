import React, {useState, useEffect} from 'react';
import {observer} from 'mobx-react-lite';
import type {
  ProjectsFilterDefinition,
  ProjectFieldName,
} from './projectViews/constants';
import ProjectsFilter from './projectViews/projectsFilter';
import ProjectsFieldsSelector from './projectViews/projectsFieldsSelector';
import {HOME_VIEW, DEFAULT_PROJECT_FIELDS} from './projectViews/constants';
import ViewSwitcher from './projectViews/viewSwitcher';
import ProjectsTable from 'js/projects/projectsTable/projectsTable';
import customViewStore from './customViewStore';
import styles from './projectViews.module.scss';
import {toJS} from 'mobx';
import {COMMON_QUERIES, ROOT_URL} from 'js/constants';

function MyProjectsRoute() {
  const [customView] = useState(customViewStore);

  useEffect(() => {
    customView.setUp(
      HOME_VIEW.uid,
      `${ROOT_URL}/api/v2/assets/?q=${COMMON_QUERIES.s}`
    );
    customView.fetchAssets();
  }, []);

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

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <ViewSwitcher selectedViewUid={HOME_VIEW.uid} />

        <ProjectsFilter
          onFiltersChange={customView.setFilters.bind(customView)}
          filters={toJS(customView.filters)}
        />

        <ProjectsFieldsSelector
          onFieldsChange={customView.setFields.bind(customView)}
          selectedFields={toJS(customView.fields)}
        />
      </header>

      <ProjectsTable
        assets={customView.assets}
        isLoading={!customView.isFirstLoadComplete}
        highlightedFields={getFilteredFieldsNames()}
        visibleFields={toJS(customView.fields) || DEFAULT_PROJECT_FIELDS}
        order={customView.order}
        onChangeOrderRequested={customView.setOrder.bind(customView)}
        onHideFieldRequested={customView.hideField.bind(customView)}
        onRequestLoadNextPage={customView.fetchMoreAssets.bind(customView)}
        hasMorePages={customView.hasMoreAssets}
      />
    </section>
  );
}

export default observer(MyProjectsRoute);
