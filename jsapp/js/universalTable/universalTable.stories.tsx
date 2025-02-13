import type {Meta, StoryObj} from '@storybook/react';
import UniversalTable, {type UniversalTableColumn} from './universalTable.component';
import Avatar from 'js/components/common/avatar';
import {type ColumnPinningPosition} from '@tanstack/react-table';
import moment from 'moment';

interface CustomArgs {
  hasColumnsPinnedLeft: 'none' | 'one' | 'multiple';
  hasColumnsPinnedRight: 'none' | 'one' | 'multiple';
  howManyColumns: 'few' | 'lots';
}
type UniversalTablePropsAndCustomArgs = React.ComponentProps<typeof UniversalTable> & CustomArgs;

const PAGE_SIZES = [10, 30, 50, 100];

interface MockDataItem {
  date_created: string;
  ip: string;
  age: number;
  your_name: string;
  pet: string;
  source: string;
  activity: string;
  a: string;
  b: string;
  c: string;
  d: string;
  e: string;
  f: string;
  g: string;
}

function getMockDataItem(): MockDataItem {
  const names = ['Phuong', 'Patrick', 'Michael', 'Bob', 'Peter', 'Farayi', 'Tino', 'John', 'David', 'Olivier', 'Leszek', 'Anji', 'Joshua', 'Jacqueline', 'Kalyan', 'Jess', 'Phil', 'Mae-Lin', 'Alexander', 'Julia', 'Tessa', 'Ruth', 'Ayman', 'David', 'Diyaa', 'James', 'Salomé', 'Timothy', 'Michael', 'Paula'];
  const pets = ['snake', 'cordyceps', 'mouse', 'hamster', 'pterosaur', 'tentacle'];
  const activities = ['created', 'updated', 'deleted', 'added', 'removed', 'reversed', 'rotated'];
  const sources = ['MacOS', 'iOS', 'Windows 98', 'CrunchBang Linux', 'Firefox', 'Safari', 'Gossip'];
  const curDate = new Date();
  curDate.setTime(curDate.getTime() - Math.random() * 1000000000000);
  return {
    date_created: moment(curDate).format('YYYY-MM-DD HH:mm:ss'),
    ip: (Math.floor(Math.random() * 255) + 1) + '.' + (Math.floor(Math.random() * 255)) + '.' + (Math.floor(Math.random() * 255)) + '.' + (Math.floor(Math.random() * 255)),
    age: Math.floor(Math.random() * 90),
    your_name: names[Math.floor(Math.random() * names.length)],
    pet: pets[Math.floor(Math.random() * pets.length)],
    source: sources[Math.floor(Math.random() * sources.length)],
    activity: activities[Math.floor(Math.random() * activities.length)],
    a: String(Math.random() * 100 - 100),
    b: 'Kobo'.repeat(Math.floor(Math.random() * 5)),
    c: String(Math.random() / 100000),
    d: '@'.repeat(Math.floor(Math.random() * 10)),
    e: String(Math.random()),
    f: 'uid_' + Math.floor(Math.random() * 9999999999999),
    g: String(Math.round(Math.random() * 100000)),
  };
}

const meta: Meta<UniversalTablePropsAndCustomArgs> = {
  title: 'misc/UniversalTable',
  component: UniversalTable,
  argTypes: {
    hasColumnsPinnedLeft: {
      options: ['none', 'one', 'multiple'],
      control: {type: 'radio'},
      description: '_CUSTOM STORY CONTROL_\n\nPins some of the columns to the left. \n\n Note that column pinning happens at the level of column definition, and we use conditionally predefined mock columns in this story.',
    },
    hasColumnsPinnedRight: {
      options: ['none', 'one', 'multiple'],
      control: {type: 'radio'},
      description: '_CUSTOM STORY CONTROL_\n\nPins some of the columns to the right.',
    },
    howManyColumns: {
      options: ['few', 'lots'],
      control: {type: 'radio'},
      description: '_CUSTOM STORY CONTROL_\n\nControls how many columns the table has. Useful for conditionally testing horizontal scroll.',
    },
    pageSize: {
      options: PAGE_SIZES,
      control: 'radio',
    },
  },
  args: {
    hasColumnsPinnedLeft: 'none',
    hasColumnsPinnedRight: 'none',
    howManyColumns: 'lots',
  },
  render: ({hasColumnsPinnedLeft, hasColumnsPinnedRight, howManyColumns, ...args}) => {
    const columns: Array<UniversalTableColumn<MockDataItem>> = [
      {
        key: 'date_created',
        label: 'Date created',
        // is pinned when "one" or "multiple" selected
        isPinned: hasColumnsPinnedLeft !== 'none' ? 'left' as ColumnPinningPosition : false,
      },
      {
        key: 'ip',
        label: 'IP Address',
        // is pinned when "multiple" selected
        isPinned: hasColumnsPinnedLeft === 'multiple' ? 'left' as ColumnPinningPosition : false,
      },
      {
        key: 'age',
        label: 'Age',
        // is pinned when "one" or "multiple" selected
        isPinned: hasColumnsPinnedRight !== 'none' ? 'right' as ColumnPinningPosition : false,
        size: 60,
      },
      {
        key: 'your_name',
        label: 'Your name',
        // is pinned when "multiple" selected
        isPinned: hasColumnsPinnedRight === 'multiple' ? 'right' as ColumnPinningPosition : false,
        cellFormatter: (dataItem: MockDataItem) => (
          <Avatar size='s' username={dataItem.your_name} isUsernameVisible />
        ),
      },
    ];

    if (howManyColumns === 'lots') {
      columns.push(
        {key: 'pet', label: 'Pet'},
        {key: 'source', label: 'Source'},
        {key: 'activity', label: 'Last activity'},
        {key: 'a', label: 'a'},
        {key: 'b', label: 'b'},
        {key: 'c', label: 'c', size: 400},
        {key: 'd', label: 'd'},
        {key: 'e', label: 'e'},
        {key: 'f', label: 'f'},
        {key: 'g', label: 'g', size: 50}
      );
    }

    const mockData = Array.from({length: 101}, () => getMockDataItem());
    const dataLimited = mockData.slice(0, args.pageSize);
    return <UniversalTable {...args} columns={columns} data={dataLimited} />;
  },
};

export default meta;

type Story = StoryObj<typeof UniversalTable>;

export const Primary: Story = {
  args: {
    isSpinnerVisible: false,
    pageIndex: 3,
    pageCount: 11,
    pageSize: PAGE_SIZES[0],
    pageSizeOptions: PAGE_SIZES,
    onRequestPaginationChange: (newPageInfo, oldPageInfo) => {
      alert(`
        Pagination change requested:\n
        new info: ${JSON.stringify(newPageInfo)}\n
        old info: ${JSON.stringify(oldPageInfo)}`
      );
    },
  },
};
