import type { Meta, StoryObj } from '@storybook/react'
import KoboSelect from '#/components/common/koboSelect'
import { IconNames } from '#/k-icons'

const meta: Meta<typeof KoboSelect> = {
  title: 'Design system old/KoboSelect',
  component: KoboSelect,
  argTypes: {
    selectedOption: {
      options: [undefined, 'one', 'two', 'last'],
      control: { type: 'select' },
    },
  },
}

export default meta

type Story = StoryObj<typeof KoboSelect>

const Template: Story = {
  render: (args) => {
    const options = [
      {
        value: 'one',
        label: 'One (no icon)',
      },
      {
        value: 'two',
        label: 'Two (with icon)',
        icon: IconNames['qt-audio'],
      },
      {
        value: 'last',
        label: 'The last one here with a very long label',
      },
    ]
    return <KoboSelect {...args} options={options} />
  },
}

export const Primary: Story = {
  ...Template,
  args: {
    type: 'blue',
    size: 'm',
    isClearable: true,
    isSearchable: true,
    isDisabled: false,
    isPending: false,
  },
}
