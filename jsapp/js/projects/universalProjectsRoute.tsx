// Libraries
import React, {useState, useEffect} from 'react';
import {observer} from 'mobx-react-lite';
import {toJS} from 'mobx';
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
import ProjectOwnershipTransferModalWithBanner from 'js/components/permissions/transferProjects/projectOwnershipTransferModalWithBanner';
import Button from 'js/components/common/button';

// Stores, hooks and utilities
import customViewStore from './customViewStore';
import {validFileTypes, notify} from 'js/utils';
import {dropImportXLSForms} from 'js/dropzone.utils';
import {handleApiFail, fetchPostUrl} from 'js/api';
import projectViewsStore from './projectViews/projectViewsStore';

// Constants and types
import type {
  ProjectsFilterDefinition,
  ProjectFieldName,
} from './projectViews/constants';

// Styles
import styles from './projectViews.module.scss';

interface UniversalProjectsRouteProps {
  // Props to satisfy `customViewStore.setUp` function
  viewUid: string;
  baseUrl: string;
  defaultVisibleFields: ProjectFieldName[];
  includeTypeFilter: boolean;
  // Props for filtering and ordering
  defaultOrderableFields: ProjectFieldName[];
  defaultExcludedFields: ProjectFieldName[];
  /** Pass this to display export button */
  isExportButtonVisible: boolean;
}

/**
 * Component responsible for rendering every possible projects route. It relies
 * heavily on `customViewStore` and has the least possible amount of custom code,
 * assuming every route wants the same functionalities.
 */
function UniversalProjectsRoute(props: UniversalProjectsRouteProps) {
  const [projectViews] = useState(projectViewsStore);
  const [customView] = useState(customViewStore);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

  useEffect(() => {
    customView.setUp(
      props.viewUid,
      props.baseUrl,
      props.defaultVisibleFields,
      props.includeTypeFilter
    );
  }, [
    customView,
    props.viewUid,
    props.baseUrl,
    props.defaultVisibleFields,
    props.includeTypeFilter
  ]);

  // Whenever we do a full page (of results) reload, we need to clear up
  // `selectedRows` to not end up with a project selected (e.g. on page of
  // results that wasn't loaded/scrolled down into yet) and user not knowing
  // about it.
  useEffect(() => {
    setSelectedRows([]);
  }, [customView.isFirstLoadComplete]);

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

  /**
   * Note: for now the export function only supports custom proejct views.
   */
  const exportAllData = () => {
    const foundView = projectViews.getView(props.viewUid);
    if (foundView) {
      fetchPostUrl(foundView.assets_export, {uid: props.viewUid}).then(() => {
        notify.warning(
          t("Export is being generated, you will receive an email when it's done")
        );
      }, handleApiFail);
    } else {
      notify.error(
        t("We couldn't create the export, please try again later or contact support")
      );
    }
  };

  const selectedAssets = customView.assets.filter((asset) =>
    selectedRows.includes(asset.uid)
  );

  /** Filters out excluded fields */
  const getTableVisibleFields = () => {
    const outcome = toJS(customView.fields) || customView.defaultVisibleFields;
    return outcome.filter(
      (fieldName) => !props.defaultExcludedFields.includes(fieldName)
    );
  };

  return (
    <Dropzone
      onDrop={dropImportXLSForms}
      disableClick
      multiple
      className={styles.dropzone}
      activeClassName={styles.dropzoneActive}
      accept={validFileTypes()}
    >
      <div className={styles.dropzoneOverlay}>
        <Icon name='upload' size='xl' />
        <h1>{t('Drop files to upload')}</h1>
      </div>

      <section className={styles.root}>
        <ProjectOwnershipTransferModalWithBanner />

        <LimitNotifications useModal />

        <header className={styles.header}>
          <ViewSwitcher selectedViewUid={props.viewUid} />

          <ProjectsFilter
            onFiltersChange={customView.setFilters.bind(customView)}
            filters={toJS(customView.filters)}
            excludedFields={props.defaultExcludedFields}
          />

          <ProjectsFieldsSelector
            onFieldsChange={customView.setFields.bind(customView)}
            selectedFields={toJS(customView.fields)}
            excludedFields={props.defaultExcludedFields}
          />

          {props.isExportButtonVisible &&
            <Button
              type='secondary'
              size='s'
              startIcon='download'
              label={t('Export all data')}
              onClick={exportAllData}
            />
          }

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
          orderableFields={props.defaultOrderableFields}
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

export default observer(UniversalProjectsRoute);
