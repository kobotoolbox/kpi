import React, {useState, useEffect} from 'react';
import {useParams} from 'react-router-dom';
import {observer} from 'mobx-react-lite';
import {notify, handleApiFail} from 'js/utils';
import type {
  ProjectsFilterDefinition,
  ProjectFieldName,
} from './projectViews/constants';
import ProjectsFilter from './projectViews/projectsFilter';
import ProjectsFieldsSelector from './projectViews/projectsFieldsSelector';
import {
  DEFAULT_VISIBLE_FIELDS,
  DEFAULT_ORDERABLE_FIELDS,
} from './projectViews/constants';
import ViewSwitcher from './projectViews/viewSwitcher';
import ProjectsTable from 'js/projects/projectsTable/projectsTable';
import Button from 'js/components/common/button';
import customViewStore from './customViewStore';
import projectViewsStore from './projectViews/projectViewsStore';
import styles from './projectViews.module.scss';
import {toJS} from 'mobx';
import {ROOT_URL} from 'js/constants';
import {fetchPostUrl} from 'js/api';
import ProjectsActionButtons from './projectsTable/projectsActionButtons';

function CustomViewRoute() {
  const {viewUid} = useParams();

  if (viewUid === undefined) {
    return null;
  }

  const [projectViews] = useState(projectViewsStore);
  const [customView] = useState(customViewStore);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

  useEffect(() => {
    customView.setUp(
      viewUid,
      `${ROOT_URL}/api/v2/project-views/${viewUid}/assets/?`
    );
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

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <ViewSwitcher selectedViewUid={viewUid} />

        <ProjectsFilter
          onFiltersChange={customView.setFilters.bind(customView)}
          filters={toJS(customView.filters)}
        />

        <ProjectsFieldsSelector
          onFieldsChange={customView.setFields.bind(customView)}
          selectedFields={toJS(customView.fields)}
        />

        <Button
          type='frame'
          color='storm'
          size='s'
          startIcon='download'
          label={t('Export all data')}
          onClick={exportAllData}
        />

        <ProjectsActionButtons asset={customView.assets[0]}/>
      </header>

      <ProjectsTable
        assets={customView.assets}
        isLoading={!customView.isFirstLoadComplete}
        highlightedFields={getFilteredFieldsNames()}
        visibleFields={toJS(customView.fields) || DEFAULT_VISIBLE_FIELDS}
        orderableFields={DEFAULT_ORDERABLE_FIELDS}
        order={customView.order}
        onChangeOrderRequested={customView.setOrder.bind(customView)}
        onHideFieldRequested={customView.hideField.bind(customView)}
        onRequestLoadNextPage={customView.fetchMoreAssets.bind(customView)}
        hasMorePages={customView.hasMoreAssets}
        selectedRows={selectedRows}
        onRowsSelected={setSelectedRows}
      />
    </section>
  );
}

export default observer(CustomViewRoute);
