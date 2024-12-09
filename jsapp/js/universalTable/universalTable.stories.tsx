import type {Meta, StoryObj} from '@storybook/react';
import UniversalTable from './universalTable.component';

interface CustomArgs {
  hasColumnPinnedToLeft: boolean;
  hasColumnPinnedToRight: boolean;
}
type UniversalTablePropsAndCustomArgs = React.ComponentProps<typeof UniversalTable> & CustomArgs;

const meta: Meta<UniversalTablePropsAndCustomArgs> = {
  title: 'misc/UniversalTable',
  component: UniversalTable,
  argTypes: {
    hasColumnPinnedToLeft: {
      type: 'boolean',
      description: '_CUSTOM STORY CONTROL_: Makes one of the columns pinned to left',
    },
    hasColumnPinnedToRight: {
      type: 'boolean',
      description: '_CUSTOM STORY CONTROL_: Makes one of the columns pinned to right',
    },
  },
  render: ({hasColumnPinnedToLeft, hasColumnPinnedToRight, ...args}) => {
    const columns = [
      {key: 'source', label: 'Source'},
      {key: 'activity', label: 'Last activity'},
      {key: 'duration', label: 'Session duration', isPinned: hasColumnPinnedToLeft},
      {key: 'ip', label: 'IP Address'},
      {key: 'a', label: 'a'},
      {key: 'b', label: 'b'},
      {key: 'c', label: 'c', size: 400},
      {key: 'd', label: 'd'},
      {key: 'e', label: 'e'},
      {key: 'your_name', label: 'Your name', isPinned: hasColumnPinnedToRight},
      {key: 'f', label: 'f'},
      {key: 'g', label: 'g'},
    ];
    const data = [
      {source: 'Safari', activity: '15 minutes ago', duration: 'Your current session', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: '1:11:23', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: '1:11:23', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Edge', activity: '15 minutes ago', duration: '1:11:23', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: '1:11:23', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: '1:11:23', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: '1:11:23', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Edge', activity: '15 minutes ago', duration: '1:11:23', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: '1:11:23', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: '1:11:23', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: '1:11:23', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: '1:11:23', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: '1:11:23', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: '1:11:23', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: '1:11:23', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: '1:11:23', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: '1:11:23', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: '1:11:23', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: '1:11:23', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', your_name: 'Rebbeca', f: '-', g: '-'},
    ];

    const dataLimited = data.slice(0, args.pageSize);

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
    pageSize: 10,
    pageSizeOptions: [10, 30, 50, 100],
    onRequestPaginationChange: (newPageInfo, oldPageInfo) => {
      alert(`
        Pagination change requested:\n
        new info: ${JSON.stringify(newPageInfo)}\n
        old info: ${JSON.stringify(oldPageInfo)}`
      );
    },
  },
};
