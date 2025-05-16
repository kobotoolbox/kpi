import type { Meta, StoryFn } from '@storybook/react-webpack5'
import ExportToEmailButton from './exportToEmailButton.component'

export default {
  title: 'Components/ExportToEmailButton',
  component: ExportToEmailButton,
  argTypes: {
    label: {
      control: 'text',
    },
  },
} as Meta<typeof ExportToEmailButton>

const Template: StoryFn<typeof ExportToEmailButton> = (args) => <ExportToEmailButton {...args} />

export const Primary = Template.bind({})
Primary.args = {
  label: 'Export all data',
  exportFunction: () => new Promise((resolve) => setTimeout(resolve, 500)),
}
