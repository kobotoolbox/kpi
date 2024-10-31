import type {ReactNode} from 'react';
import {useState} from 'react';
import '../../../scss/components/_kobo.form-view.scss';
import type {KoboSelectOption} from '../common/koboSelect';
import KoboSelect from '../common/koboSelect';
import type {UniversalTableColumn} from 'jsapp/js/universalTable/universalTable.component';
import PaginatedQueryUniversalTable from 'jsapp/js/universalTable/paginatedQueryUniversalTable.component';
import type {ActivityLogsItem} from './activityLogs.query';
import {
  useActivityLogsFilterOptionsQuery,
  useActivityLogsQuery,
  useExportActivityLogs,
} from './activityLogs.query';
import styles from './formActivity.module.scss';
import cx from 'classnames';
import {formatTime} from 'jsapp/js/utils';
import Avatar from '../common/avatar';
import ExportToEmailButton from '../exportToEmailButton/exportToEmailButton.component';

const EventDescription = ({
  who,
  action,
  what,
}: {
  who: string;
  action: string;
  what: string;
}) => (
  <div className={styles.eventDescription}>
    <Avatar size='s' username={who} />
    <span className={styles.who}>{who}</span>
    <span className={styles.action}>{action}</span> {what}
    <button className={styles.seeDetails}>{t('See details')}</button>
  </div>
);

const columns: Array<UniversalTableColumn<ActivityLogsItem>> = [
  {
    key: 'description',
    label: t('Event description'),
    cellFormatter: (data: ActivityLogsItem) => (
      <EventDescription who={data.who} action={data.action} what={data.what} />
    ),
  },
  {
    key: 'date',
    label: t('Date'),
    size: 100,
    cellFormatter: (data: ActivityLogsItem) =>
      formatTime(data.date) as ReactNode,
  },
];

export default function FormActivity() {
  const {data: filterOptions} = useActivityLogsFilterOptionsQuery();

  const [selectedFilterOption, setSelectedFilterOption] =
    useState<KoboSelectOption | null>(null);

  const exportData = useExportActivityLogs();

  const handleFilterChange = (value: string | null) => {
    setSelectedFilterOption(
      filterOptions?.find((option) => option.value === value) || null
    );
  };

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
          <ExportToEmailButton
            label={t('Export all data')}
            exportFunction={exportData}
          />
        </div>
      </div>
      <div className={styles.tableContainer}>
        <PaginatedQueryUniversalTable<ActivityLogsItem>
          columns={columns}
          queryHook={useActivityLogsQuery}
        />
      </div>
    </div>
  );
}
