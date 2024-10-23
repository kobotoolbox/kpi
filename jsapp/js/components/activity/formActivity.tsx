import type {ReactNode} from 'react';
import {useState} from 'react';
import '../../../scss/components/_kobo.form-view.scss';
import type {KoboSelectOption} from '../common/koboSelect';
import KoboSelect from '../common/koboSelect';
import type {UniversalTableColumn} from 'jsapp/js/universalTable/universalTable.component';
import Button from '../common/button';
import PaginatedQueryUniversalTable from 'jsapp/js/universalTable/paginatedQueryUniversalTable.component';
import type {ActivityLogsItem} from 'jsapp/js/query/queries/activityLogs.query';
import {
  useActivityLogsFilterOptionsQuery,
  useActivityLogsQuery,
} from 'jsapp/js/query/queries/activityLogs.query';
import styles from './formActivity.module.scss';
import cx from 'classnames';
import {formatTime} from 'jsapp/js/utils';
import Avatar from '../common/avatar';
import KoboModal from '../modals/koboModal';
import KoboModalHeader from '../modals/koboModalHeader';

interface EventDescriptionProps {
  data: ActivityLogsItem;
  /**
   * This will be called when details button is being clicked. If you don't
   * provide it, the button will not be displayed.
   */
  detailsButtonFn?: () => void;
}
const EventDescription = (props: EventDescriptionProps) => (
  <div className={styles.eventDescription}>
    <Avatar size='s' username={props.data.username} />
    <span className={styles.who}>{props.data.username}</span>
    <span className={styles.action}>{props.data.action}</span> {props.data.metadata.log_subtype}
    {props.detailsButtonFn &&
      <button
        className={styles.seeDetailsButton}
        onClick={props.detailsButtonFn}
      >
        {t('See details')}
      </button>
    }
  </div>
);

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
        <EventDescription
          data={data}
          detailsButtonFn={() => setDetailsModalData(data)}
        />
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
              <EventDescription data={detailsModalData} />
            </KoboModalHeader>

            <section className={styles.detailsModalContent}>
              <p className={styles.detailsModalText}>
                <pre>{JSON.stringify(detailsModalData.metadata, null, '  ')}</pre>
              </p>
              <div className={styles.detailsModalMetaRow}>
                <label>{t('Action occured:')}</label>
                <time dateTime={detailsModalData.date_created}>
                  {formatTime(detailsModalData.date_created)}
                </time>
              </div>
              <div className={styles.detailsModalMetaRow}>
                <label>{t('Device:')}</label>
                {detailsModalData.metadata.source}
              </div>
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
