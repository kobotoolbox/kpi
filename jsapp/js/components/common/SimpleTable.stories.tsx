import type {Meta, StoryObj} from '@storybook/react';
import {MantineProvider} from '@mantine/core';
import {themeKobo} from 'jsapp/js/theme';
import SimpleTable from './SimpleTable';

interface CustomArgs {}
type SimpleTablePropsAndCustomArgs = React.ComponentProps<typeof SimpleTable> & CustomArgs;

const meta: Meta<SimpleTablePropsAndCustomArgs> = {
  title: 'common/SimpleTable',
  component: SimpleTable,
  argTypes: {},
  args: {},
  render: ({...args}) => {
    return (
      <MantineProvider theme={themeKobo}>
        <SimpleTable
          {...args}
          head={['Element position', 'Atomic mass', 'Symbol', 'Element name']}
          body={
            [
              [6, 12.011, 'C', 'Carbon'],
              [7, 14.007, 'N', 'Nitrogen'],
              [39, 88.906, 'Y', 'Yttrium'],
              [56, 137.33, 'Ba', 'Barium'],
              [58, 140.12, 'Ce', 'Cerium'],
            ]
          }
        />
      </MantineProvider>
    );
  },
};

export default meta;

type Story = StoryObj<typeof SimpleTable>;

export const Primary: Story = {
  args: {},
};
