import type {ReactNode} from 'react';
import {useState} from 'react';
import '../../../scss/components/_kobo.form-view.scss';
import type {KoboSelectOption} from '../common/koboSelect';
import KoboSelect from '../common/koboSelect';
import type {UniversalTableColumn} from 'jsapp/js/universalTable/universalTable.component';
import Button from '../common/button';
import PaginatedQueryUniversalTable from 'jsapp/js/universalTable/paginatedQueryUniversalTable.component';
import type {ActivityLogsItem} from './activity.constants';
import {
  useActivityLogsFilterOptionsQuery,
  useActivityLogsQuery,
} from 'jsapp/js/query/queries/activityLogs.query';
import styles from './formActivity.module.scss';
import cx from 'classnames';
import {formatTime} from 'jsapp/js/utils';
import KoboModal from '../modals/koboModal';
import KoboModalHeader from '../modals/koboModalHeader';
import {ActivityMessage} from './activityMessage.component';

/**
 * A component used at Project > Settings > Activity route. Displays a table
 * of actions that users did on the project.
 */
export default function FormActivity() {
  const {data: filterOptions} = useActivityLogsFilterOptionsQuery();

  const [selectedFilterOption, setSelectedFilterOption] =
    useState<KoboSelectOption | null>(null);

  const handleFilterChange = (value: string | null) => {
    setSelectedFilterOption(
      filterOptions?.find((option) => option.value === value) || null
    );
  };

  // Modal is being displayed when data for it is being set. To close modal,
  // simply set data to `null`.
  const [detailsModalData, setDetailsModalData] =
    useState<ActivityLogsItem | null>(null);

  const columns: Array<UniversalTableColumn<ActivityLogsItem>> = [
    {
      key: 'description',
      label: t('Event description'),
      cellFormatter: (data: ActivityLogsItem) => (
        <>
          <ActivityMessage data={data} />
          <button
            className={styles.seeDetailsButton}
            onClick={() => setDetailsModalData(data)}
          >
            {t('See details')}
          </button>
        </>
      ),
    },
    {
      key: 'date',
      label: t('Date'),
      size: 100,
      cellFormatter: (data: ActivityLogsItem) =>
        formatTime(data.date_created) as ReactNode,
    },
  ];

  return (
    <div className={cx('form-view', styles.mainContainer)}>
      <div className={styles.header}>
        <h1>{t('Recent project activity')}</h1>
        <div className={styles.headerActions}>
          <KoboSelect
            isClearable
            className={styles.filterSelect}
            selectedOption={selectedFilterOption?.value || ''}
            onChange={handleFilterChange}
            type='outline'
            name='filter'
            size='m'
            placeholder={t('Filter by')}
            options={filterOptions || []}
          />
          <Button
            size='m'
            type='primary'
            startIcon='download'
            label={t('Export all data')}
          />
        </div>
      </div>
      <div className={styles.tableContainer}>
        {detailsModalData &&
          <KoboModal
            isOpen
            size='medium'
            onRequestClose={() => setDetailsModalData(null)}
          >
            <KoboModalHeader onRequestCloseByX={() => setDetailsModalData(null)}>
              <ActivityMessage data={detailsModalData} />
            </KoboModalHeader>

            <section className={styles.detailsModalContent}>
              <pre>{JSON.stringify(detailsModalData, null, '  ')}</pre>
            </section>
          </KoboModal>
        }

        <PaginatedQueryUniversalTable<ActivityLogsItem>
          columns={columns}
          queryHook={useActivityLogsQuery}
        />
      </div>
    </div>
  );
}
