import type {Meta, StoryObj} from '@storybook/react';
import UniversalTable from './universalTable.component';

const meta: Meta<typeof UniversalTable> = {
  title: 'misc/UniversalTable',
  component: UniversalTable,
};

export default meta;

type Story = StoryObj<typeof UniversalTable>;

export const Primary: Story = {
  args: {
    columns: [
      {key: 'source', label: t('Source')},
      {key: 'activity', label: t('Last activity')},
      {key: 'duration', label: t('Session duration'), isPinned: true},
      {key: 'ip', label: t('IP Address')},
      {key: 'a', label: 'a'},
      {key: 'b', label: 'b'},
      {key: 'c', label: 'c', size: 400},
      {key: 'd', label: 'd'},
      {key: 'e', label: 'e'},
      {key: 'f', label: 'f'},
      {key: 'g', label: 'g'},
    ],
    data: [
      {source: 'Safari', activity: '15 minutes ago', duration: 'Your current session', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: 'Your current session', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: 'Your current session', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: 'Your current session', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: 'Your current session', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: 'Your current session', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: 'Your current session', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: 'Your current session', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: 'Your current session', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: 'Your current session', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: 'Your current session', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: 'Your current session', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: 'Your current session', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: 'Your current session', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: 'Your current session', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: 'Your current session', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: 'Your current session', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: 'Your current session', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Safari', activity: '15 minutes ago', duration: 'Your current session', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
      {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
    ],
    isSpinnerVisible: false,
    pageIndex: 3,
    pageCount: 11,
    pageSize: 10,
    pageSizeOptions: [10, 30, 50, 100],
    onRequestPaginationChange: (newPageInfo, oldPageInfo) => {
      console.log('pagination change requested', newPageInfo, oldPageInfo);
    },
  }
};
