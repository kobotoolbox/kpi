import type {Meta, StoryObj} from '@storybook/react';
import SimpleTable from './SimpleTable';

const meta: Meta<React.ComponentProps<typeof SimpleTable>> = {
  title: 'common/SimpleTable',
  component: SimpleTable,
  argTypes: {},
  args: {},
  render: ({...args}) => (
    <SimpleTable
      {...args}
      head={['Element position', 'Atomic mass', 'Symbol', 'Element name']}
      body={
        [
          [6, 12.011, 'C', 'Carbon'],
          [7, 14.007, 'N', 'Nitrogen'],
          [39, 88.906, 'Y', 'Yttrium'],
          [56, 137.33, 'Ba', 'Barium'],
          [
            'n/a',
            'n/a',
            '??',
            (
              <div key='test'>
                This is just a DIV. It has a button and an input:
                <br/><br/>
                <button>button</button>
                <br/><br/>
                <input type='email'/>
                <br/><br/>
                It shows you can have any <code>React.ReactNode</code> here.
              </div>
            ),
          ],
          [58, 140.12, 'Ce', 'Cerium'],
        ]
      }
    />
  ),
};

export default meta;

export const Primary: StoryObj<typeof SimpleTable> = {
  args: {},
};
