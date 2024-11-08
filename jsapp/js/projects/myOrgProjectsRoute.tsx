// Libraries
import React, {useState, useEffect} from 'react';
import {observer} from 'mobx-react-lite';
import {toJS} from 'mobx';
import {useNavigate} from 'react-router-dom';
import Dropzone from 'react-dropzone';

// Partial components
import ProjectsFilter from './projectViews/projectsFilter';
import ProjectsFieldsSelector from './projectViews/projectsFieldsSelector';
import ViewSwitcher from './projectViews/viewSwitcher';
import ProjectsTable from 'js/projects/projectsTable/projectsTable';
import ProjectQuickActionsEmpty from './projectsTable/projectQuickActionsEmpty';
import ProjectQuickActions from './projectsTable/projectQuickActions';
import ProjectBulkActions from './projectsTable/projectBulkActions';
import LimitNotifications from 'js/components/usageLimits/limitNotifications.component';
import Icon from 'js/components/common/icon';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import TransferModalWithBanner from 'js/components/permissions/transferProjects/transferModalWithBanner';

// Stores, hooks and utilities
import customViewStore from './customViewStore';
import {useOrganizationQuery} from 'js/account/stripe.api';
import {validFileTypes} from 'js/utils';
import {dropImportXLSForms} from 'js/dropzone.utils';

// Constants and types
import type {
  ProjectsFilterDefinition,
  ProjectFieldName,
} from './projectViews/constants';
import {
  ORG_VIEW,
  HOME_ORDERABLE_FIELDS,
  HOME_DEFAULT_VISIBLE_FIELDS,
  HOME_EXCLUDED_FIELDS,
} from './projectViews/constants';
import {ROOT_URL} from 'js/constants';
import {endpoints} from 'js/api.endpoints';
import {PROJECTS_ROUTES} from 'js/router/routerConstants';

// Styles
import styles from './projectViews.module.scss';
import routeStyles from './myProjectsRoute.module.scss';

/**
 * Component responsible for rendering organization projects route (`#/projects/organization`).
 */
function MyOrgProjectsRoute() {
  const [customView] = useState(customViewStore);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const orgQuery = useOrganizationQuery();
  const navigate = useNavigate();

  useEffect(() => {
    if (orgQuery.data) {
      const apiUrl = endpoints.ORG_ASSETS_URL.replace(':organization_uid', orgQuery.data.id);
      customView.setUp(
        ORG_VIEW.uid,
        `${ROOT_URL}${apiUrl}`,
        HOME_DEFAULT_VISIBLE_FIELDS,
        false
      );
    }
  });

  // Whenever we do a full page (of results) reload, we need to clear up
  // `selectedRows` to not end up with a project selected (e.g. on page of
  // results that wasn't loaded/scrolled down into yet) and user not knowing
  // about it.
  useEffect(() => {
    setSelectedRows([]);
  }, [customView.isFirstLoadComplete]);

  useEffect(() => {
    if (orgQuery.data?.is_mmo === false) {
      navigate(PROJECTS_ROUTES.MY_PROJECTS);
    }
  }, [navigate, orgQuery.data]);

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

  /** Filters out excluded fields */
  const getTableVisibleFields = () => {
    const outcome = toJS(customView.fields) || customView.defaultVisibleFields;
    return outcome.filter(
      (fieldName) => !HOME_EXCLUDED_FIELDS.includes(fieldName)
    );
  };


  if (orgQuery.data === undefined) {
    return <LoadingSpinner />;
  }

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
        <TransferModalWithBanner />

        <header className={styles.header}>
          <ViewSwitcher selectedViewUid={HOME_VIEW.uid} />

          <ProjectsFilter
            onFiltersChange={customView.setFilters.bind(customView)}
            filters={toJS(customView.filters)}
            excludedFields={HOME_EXCLUDED_FIELDS}
          />

          <ProjectsFieldsSelector
            onFieldsChange={customView.setFields.bind(customView)}
            selectedFields={toJS(customView.fields)}
            excludedFields={HOME_EXCLUDED_FIELDS}
          />

          {selectedAssets.length === 0 && (
            <div className={styles.actions}>
              <ProjectQuickActionsEmpty />
            </div>
          )}

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
          visibleFields={getTableVisibleFields()}
          orderableFields={HOME_ORDERABLE_FIELDS}
          order={customView.order}
          onChangeOrderRequested={customView.setOrder.bind(customView)}
          onHideFieldRequested={customView.hideField.bind(customView)}
          onRequestLoadNextPage={customView.fetchMoreAssets.bind(customView)}
          hasMorePages={customView.hasMoreAssets}
          selectedRows={selectedRows}
          onRowsSelected={setSelectedRows}
        />

        <LimitNotifications useModal />
      </section>
    </Dropzone>
  );
}

export default observer(MyOrgProjectsRoute);
