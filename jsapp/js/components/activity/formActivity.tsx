import {useMemo, useState} from 'react';
import '../../../scss/components/_kobo.form-view.scss';
import type {KoboSelectOption} from '../common/koboSelect';
import KoboSelect from '../common/koboSelect';
import './formActivity.scss';
import type {UniversalTableColumn} from 'jsapp/js/universalTable/universalTable.component';
import UniversalTable from 'jsapp/js/universalTable/universalTable.component';
import Button from '../common/button';

const mockOptions: KoboSelectOption[] = [
  {value: '1', label: 'Option 1'},
  {value: '2', label: 'Option 2'},
  {value: '3', label: 'Option 3'},
];

const getRandomMockDescriptionData = () => {
  const who = ['Trent', 'Jane', 'Alice', 'Bob', 'Charlie'];
  const action = ['created', 'updated', 'deleted', 'added', 'removed'];
  const what = ['project property', 'the form', 'the permissions'];
  return {
    who: who[Math.floor(Math.random() * who.length)],
    action: action[Math.floor(Math.random() * action.length)],
    what: what[Math.floor(Math.random() * what.length)],
  };
};

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

  // MOCK TABLE DATA
  const tableData = useMemo(
    () =>
      Array.from({length: 50}, (_, index) => {
        return {
          id: index,
          description: <EventDescription {...getRandomMockDescriptionData()} />,
          date: <EventDate dateTime={new Date()} />,
        };
      }),
    []
  );

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
        <UniversalTable data={tableData} columns={columns} />
      </div>
      <div className='footer'>{/* TODO: Implement pagination controls */}</div>
    </div>
  );
}
