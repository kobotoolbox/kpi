import React, {useState, useEffect} from 'react';
import {observer} from 'mobx-react-lite';
import type {
  ProjectsFilterDefinition,
  ProjectFieldName,
} from './projectViews/constants';
import ProjectsFilter from './projectViews/projectsFilter';
import ProjectsFieldsSelector from './projectViews/projectsFieldsSelector';
import {
  HOME_VIEW,
  HOME_ORDERABLE_FIELDS,
  DEFAULT_VISIBLE_FIELDS,
} from './projectViews/constants';
import ViewSwitcher from './projectViews/viewSwitcher';
import ProjectsTable from 'js/projects/projectsTable/projectsTable';
import customViewStore from './customViewStore';
import styles from './projectViews.module.scss';
import routeStyles from './myProjectsRoute.module.scss';
import {toJS} from 'mobx';
import {COMMON_QUERIES, ROOT_URL} from 'js/constants';
import ProjectQuickActions from './projectsTable/projectQuickActions';
import ProjectBulkActions from './projectsTable/projectBulkActions';
import mixins from 'js/mixins';
import Dropzone from 'react-dropzone';
import {validFileTypes} from 'js/utils';
import Icon from 'js/components/common/icon';
import {dropImportXLSForms} from 'js/dropzone.utils';

function MyProjectsRoute() {
  const [customView] = useState(customViewStore);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

  useEffect(() => {
    customView.setUp(
      HOME_VIEW.uid,
      `${ROOT_URL}/api/v2/assets/?q=${COMMON_QUERIES.s}`
    );
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

  const selectedAssets = customView.assets.filter((asset) =>
    selectedRows.includes(asset.uid)
  );

  return (
    <Dropzone
      onDrop={dropImportXLSForms}
      disableClick
      multiple
      className={routeStyles.dropzone}
      activeClassName={routeStyles.dropzoneActive}
      accept={validFileTypes()}
    >
      <div className={routeStyles.dropzoneOverlay}>
        <Icon name='upload' size='xl' />
        <h1>{t('Drop files to upload')}</h1>
      </div>

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

          {selectedAssets.length === 1 && (
            <div className={styles.actions}>
              <ProjectQuickActions asset={selectedAssets[0]} />
            </div>
          )}

          {selectedAssets.length > 1 && (
            <div className={styles.actions}>
              <ProjectBulkActions assets={selectedAssets} />
            </div>
          )}
        </header>

        <ProjectsTable
          assets={customView.assets}
          isLoading={!customView.isFirstLoadComplete}
          highlightedFields={getFilteredFieldsNames()}
          visibleFields={toJS(customView.fields) || DEFAULT_VISIBLE_FIELDS}
          orderableFields={HOME_ORDERABLE_FIELDS}
          order={customView.order}
          onChangeOrderRequested={customView.setOrder.bind(customView)}
          onHideFieldRequested={customView.hideField.bind(customView)}
          onRequestLoadNextPage={customView.fetchMoreAssets.bind(customView)}
          hasMorePages={customView.hasMoreAssets}
          selectedRows={selectedRows}
          onRowsSelected={setSelectedRows}
        />
      </section>
    </Dropzone>
  );
}

export default observer(MyProjectsRoute);
