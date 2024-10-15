import type {ReactNode} from 'react';
import {useState} from 'react';
import '../../../scss/components/_kobo.form-view.scss';
import type {KoboSelectOption} from '../common/koboSelect';
import KoboSelect from '../common/koboSelect';
import type {UniversalTableColumn} from 'jsapp/js/universalTable/universalTable.component';
import Button from '../common/button';
import PaginatedQueryUniversalTable from 'jsapp/js/universalTable/paginatedQueryUniversalTable.component';
import type {ActivityLogsItem} from 'jsapp/js/query/queries/activityLog.query';
import {useActivityLogsFilterOptionsQuery, useActivityLogsQuery} from 'jsapp/js/query/queries/activityLog.query';
import styles from './formActivity.module.scss';
import cx from 'classnames';
import {formatTime, stringToColor} from 'jsapp/js/utils';

const UserAvatar = ({name}: {name: string}) => (
  <div style={{background: `#${stringToColor(name)}`}} className={styles.profilePicture}>{name.slice(0, 1)}</div>
);

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
    <UserAvatar name={who} />
    <span className={styles.who}>{who}</span>{' '}
    <span className={styles.action}>{action}</span> {what}
    <button className={styles.seeDetails}>{t('See details')}</button>
  </div>
);

const columns: Array<UniversalTableColumn<ActivityLogsItem>> = [
  {
    key: 'description',
    label: t('Event description'),
    cellFormatter: (data: ActivityLogsItem) => formatTime(data.date) as ReactNode,
  },
  {
    key: 'date',
    label: t('Date'),
    size: 100,
    cellFormatter: (data: ActivityLogsItem) => (
      <EventDescription
      who={data.who}
      action={data.action}
      what={data.what}
    />
    ),
  },
];


export default function FormActivity() {

  const {data: filterOptions} = useActivityLogsFilterOptionsQuery();

  const [selectedFilterOption, setSelectedFilterOption] =
    useState<KoboSelectOption | null>(null);

  const handleFilterChange = (value: string | null) => {
    setSelectedFilterOption(
      filterOptions?.find((option) => option.value === value) || null
    );
  };

  return (
    <div className={cx('form-view', styles.mainContainer)}>
      <div className={styles.header}>
        <h1>{t('Recent Project Activity')}</h1>
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
        <PaginatedQueryUniversalTable<ActivityLogsItem>
          columns={columns}
          queryHook={useActivityLogsQuery}
        />
      </div>
    </div>
  );
}
