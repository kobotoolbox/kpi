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
  HOME_DEFAULT_VISIBLE_FIELDS,
  HOME_EXCLUDED_FIELDS,
} from './projectViews/constants';
import ViewSwitcher from './projectViews/viewSwitcher';
import ProjectsTable from 'js/projects/projectsTable/projectsTable';
import customViewStore from './customViewStore';
import styles from './projectViews.module.scss';
import routeStyles from './myProjectsRoute.module.scss';
import {toJS} from 'mobx';
import {ROOT_URL} from 'js/constants';
import ProjectQuickActionsEmpty from './projectsTable/projectQuickActionsEmpty';
import ProjectQuickActions from './projectsTable/projectQuickActions';
import ProjectBulkActions from './projectsTable/projectBulkActions';
import Dropzone from 'react-dropzone';
import {validFileTypes} from 'js/utils';
import Icon from 'js/components/common/icon';
import {dropImportXLSForms} from 'js/dropzone.utils';
import LimitNotifications from 'js/components/usageLimits/limitNotifications.component';
import {useSearchParams} from 'react-router-dom';
import TransferProjectsInvite from 'js/components/permissions/transferProjects/transferProjectsInvite.component';
import {
  isInviteForLoggedInUser,
  TransferStatuses,
} from 'js/components/permissions/transferProjects/transferProjects.api';
import Button from '../components/common/button';

interface InviteState {
  valid: boolean;
  uid: string;
  status: TransferStatuses.Accepted | TransferStatuses.Declined | null;
  name: string;
  currentOwner: string;
}

function MyProjectsRoute() {
  const [customView] = useState(customViewStore);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [invite, setInvite] = useState<InviteState>({
    valid: false,
    uid: '',
    status: null,
    name: '',
    currentOwner: '',
  });
  const [banner, setBanner] = useState(true);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    customView.setUp(
      HOME_VIEW.uid,
      `${ROOT_URL}/api/v2/assets/`,
      HOME_DEFAULT_VISIBLE_FIELDS
    );

    const inviteParams = searchParams.get('invite');
    if (inviteParams) {
      isInviteForLoggedInUser(inviteParams).then((data) => {
        setInvite({...invite, valid: data, uid: inviteParams});
      });
    } else {
      setInvite({...invite, valid: false, uid: ''});
    }
  }, [searchParams]);

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

  const setInviteDetail = (
    newStatus: TransferStatuses.Accepted | TransferStatuses.Declined,
    name: string,
    currentOwner: string
  ) => {
    setInvite({
      ...invite,
      status: newStatus,
      name: name,
      currentOwner: currentOwner,
    });
  };

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

      <LimitNotifications useModal />

      <section className={styles.root}>
        {invite.status && banner && (
          <div className={styles.banner}>
            <Icon
              name='information'
              color='blue'
              className={styles.bannerIcon}
            />

            {invite.status === TransferStatuses.Declined && (
              <>
                {t(
                  'You have declined the request of transfer ownership for ##PROJECT_NAME##. ##CURRENT_OWNER_NAME## will receive a notification that the transfer was incomplete.'
                )
                  .replace('##PROJECT_NAME##', invite.name)
                  .replace('##CURRENT_OWNER_NAME##', invite.currentOwner)}
                &nbsp;
                {t(
                  '##CURRENT_OWNER_NAME## will remain the project owner.'
                ).replace('##CURRENT_OWNER_NAME##', invite.currentOwner)}
              </>
            )}
            {invite.status === TransferStatuses.Accepted && (
              <>
                {t(
                  'You have accepted project ownership from ##CURRENT_OWNER_NAME## for ##PROJECT_NAME##. This process can take up to a few minutes to complete.'
                )
                  .replace('##PROJECT_NAME##', invite.name)
                  .replace('##CURRENT_OWNER_NAME##', invite.currentOwner)}
              </>
            )}

            <Button
              type='bare'
              color='dark-blue'
              size='s'
              startIcon='close'
              onClick={() => {
                setBanner(false);
              }}
              className={styles.bannerButton}
            />
          </div>
        )}

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
        {invite.valid && invite.uid !== '' && (
          <TransferProjectsInvite
            setInvite={setInviteDetail}
            inviteUid={invite.uid}
          />
        )}
      </section>
    </Dropzone>
  );
}

export default observer(MyProjectsRoute);
