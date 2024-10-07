import {useMemo, useState} from 'react';
import '../../../scss/components/_kobo.form-view.scss';
import type {KoboSelectOption} from '../common/koboSelect';
import KoboSelect from '../common/koboSelect';
import './formActivity.scss';
import type {UniversalTableColumn} from 'jsapp/js/universalTable/universalTable.component';
import UniversalTable from 'jsapp/js/universalTable/universalTable.component';
import Button from '../common/button';
import {useGetFormActivities} from './useActivity';
import LoadingSpinner from '../common/loadingSpinner';
import PaginatedQueryUniversalTable from 'jsapp/js/universalTable/paginatedQueryUniversalTable.component';

interface Activity {
  id: number;
  who: string;
  action: string;
  what: string;
  date: Date;
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

const EventDescription = ({
  who,
  action,
  what,
}: {
  who: string;
  action: string;
  what: string;
}) => (
  <div className='event-description'>
    <div className='profile-picture'>{who.slice(0, 1)}</div>
    <span className='description'>
      <span className='who'>{who}</span>{' '}
      <span className='action'>{action}</span> {what}
    </span>
    <button className='see-details'>{t('See details')}</button>
  </div>
);

const EventDate = ({dateTime}: {dateTime: Date}) => {
  // TODO: Apply formatting
  const formattedDate = dateTime.toLocaleDateString();
  return formattedDate;
};

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

  const {data: activities, isLoading} = useGetFormActivities();

  // MOCK TABLE DATA
  const tableData = useMemo(() => {
    if (!activities) {
      return [];
    }

    return activities.map((activity) => {
      return {
        id: activity.id,
        description: <EventDescription {...activity} />,
        date: <EventDate dateTime={activity.date} />,
      };
    });
  }, [activities]);

  return (
    <div className='form-view main-container'>
      <div className='header'>
        <h1>{t('Recent Project Activity')}</h1>
        <div className='header-actions'>
          <KoboSelect
            isClearable
            className='filter-select'
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
      <div className='table-container'>
        {isLoading ? (
          <div className='loading'><LoadingSpinner /></div>
        ) : (
          // <UniversalTable data={tableData} columns={columns} />
          < PaginatedQueryUniversalTable
            columns={columns}
            queryHook={(limit, offset) => useGetFormActivities<Activity>(limit, offset)}

        )}
      </div>
    </div>
  );
}
