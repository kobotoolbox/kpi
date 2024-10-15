import type {ReactNode} from 'react';
import {useState} from 'react';
import '../../../scss/components/_kobo.form-view.scss';
import type {KoboSelectOption} from '../common/koboSelect';
import KoboSelect from '../common/koboSelect';
import type {UniversalTableColumn} from 'jsapp/js/universalTable/universalTable.component';
import Button from '../common/button';
import PaginatedQueryUniversalTable from 'jsapp/js/universalTable/paginatedQueryUniversalTable.component';
import type {ActivityLogItem} from 'jsapp/js/query/queries/activityLog.query';
import {useActivityLogsQuery} from 'jsapp/js/query/queries/activityLog.query';
import moment from 'moment';
import styles from './formActivity.module.scss';
import cx from 'classnames';
import {formatTime, stringToColor} from 'jsapp/js/utils';

interface TableDataItem {
  description: ReactNode;
  date: ReactNode;
}

const mockOptions: KoboSelectOption[] = [
  {value: '1', label: 'Option 1'},
  {value: '2', label: 'Option 2'},
  {value: '3', label: 'Option 3'},
];

const columns: UniversalTableColumn[] = [
  {
    key: 'description',
    label: t('Event description'),
  },
  {
    key: 'date',
    label: t('Date'),
    size: 100,
  },
];

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

const EventDate = ({dateTime}: {dateTime: string}) => formatTime(dateTime);

export default function FormActivity() {
  const [filterOptions, setFilterOptions] =
    useState<KoboSelectOption[]>(mockOptions);
  const [selectedFilterOption, setSelectedFilterOption] =
    useState<KoboSelectOption | null>(null);

  const handleFilterChange = (value: string | null) => {
    setSelectedFilterOption(
      filterOptions.find((option) => option.value === value) || null
    );
  };

  const rowRenderer = (data: ActivityLogItem) => {
    return {
      description: (
        <EventDescription
          who={data.who}
          action={data.action}
          what={data.what}
        />
      ),
      date: <EventDate dateTime={data.date} />,
    };
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
            options={filterOptions}
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
        <PaginatedQueryUniversalTable<ActivityLogItem, TableDataItem>
          columns={columns}
          queryHook={useActivityLogsQuery}
          rowRenderer={rowRenderer}
        />
      </div>
    </div>
  );
}
