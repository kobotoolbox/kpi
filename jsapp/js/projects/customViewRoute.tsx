// Libraries
import React, {useState, useEffect} from 'react';
import {observer} from 'mobx-react-lite';
import {toJS} from 'mobx';
import {useParams} from 'react-router-dom';

// Partial components
import ProjectsFilter from './projectViews/projectsFilter';
import ProjectsFieldsSelector from './projectViews/projectsFieldsSelector';
import ViewSwitcher from './projectViews/viewSwitcher';
import ProjectsTable from 'js/projects/projectsTable/projectsTable';
import ProjectQuickActionsEmpty from './projectsTable/projectQuickActionsEmpty';
import ProjectQuickActions from './projectsTable/projectQuickActions';
import ProjectBulkActions from './projectsTable/projectBulkActions';
import LimitNotifications from 'js/components/usageLimits/limitNotifications.component';
import Button from 'js/components/common/button';

// Stores, hooks and utilities
import customViewStore from './customViewStore';
import {notify} from 'js/utils';
import {handleApiFail, fetchPostUrl} from 'js/api';
import projectViewsStore from './projectViews/projectViewsStore';

// Constants and types
import type {
  ProjectsFilterDefinition,
  ProjectFieldName,
} from './projectViews/constants';
import {
  DEFAULT_VISIBLE_FIELDS,
  DEFAULT_ORDERABLE_FIELDS,
  DEFAULT_EXCLUDED_FIELDS,
} from './projectViews/constants';
import {ROOT_URL} from 'js/constants';

// Styles
import styles from './projectViews.module.scss';

/**
 * Component responsible for rendering a custom project view route (`#/projects/<vid>`).
 */
function CustomViewRoute() {
  const {viewUid} = useParams();

  // This condition is here to satisfy TS, as without it the code below would
  // need to be unnecessarily more lengthy.
  if (viewUid === undefined) {
    return null;
  }

  const [projectViews] = useState(projectViewsStore);
  const [customView] = useState(customViewStore);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

  useEffect(() => {
    customView.setUp(
      viewUid,
      `${ROOT_URL}/api/v2/project-views/${viewUid}/assets/`,
      DEFAULT_VISIBLE_FIELDS,
      false
    );
  }, [viewUid]);

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

  const exportAllData = () => {
    const foundView = projectViews.getView(viewUid);
    if (foundView) {
      fetchPostUrl(foundView.assets_export, {uid: viewUid}).then(() => {
        notify.warning(
          t(
            "Export is being generated, you will receive an email when it's done"
          )
        );
      }, handleApiFail);
    } else {
      notify.error(
        t(
          "We couldn't create the export, please try again later or contact support"
        )
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
      (fieldName) => !DEFAULT_EXCLUDED_FIELDS.includes(fieldName)
    );
  };

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <ViewSwitcher selectedViewUid={viewUid} />

        <ProjectsFilter
          onFiltersChange={customView.setFilters.bind(customView)}
          filters={toJS(customView.filters)}
          excludedFields={DEFAULT_EXCLUDED_FIELDS}
        />

        <ProjectsFieldsSelector
          onFieldsChange={customView.setFields.bind(customView)}
          selectedFields={toJS(customView.fields)}
          excludedFields={DEFAULT_EXCLUDED_FIELDS}
        />

        <Button
          type='secondary'
          size='s'
          startIcon='download'
          label={t('Export all data')}
          onClick={exportAllData}
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
        orderableFields={DEFAULT_ORDERABLE_FIELDS}
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
  );
}

export default observer(CustomViewRoute);
