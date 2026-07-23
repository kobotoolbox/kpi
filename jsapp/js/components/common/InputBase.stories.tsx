import { InputBase, NumberInput, PasswordInput, Stack, TextInput, Textarea } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-webpack5'

const meta: Meta<typeof InputBase> = {
  title: 'Design system/InputBase',
  component: InputBase,
  parameters: {
    controls: { expanded: false },
  },
}

export default meta

type Story = StoryObj<typeof InputBase>

export const CompareAll: Story = {
  render: () => (
    <Stack gap='md' style={{ maxWidth: 420, padding: 40, margin: 'auto' }}>
      <InputBase label='InputBase' placeholder='Shared styling' value='Base input' />
      <TextInput label='TextInput' placeholder='Shared styling' defaultValue='Text input' />
      <PasswordInput label='PasswordInput' placeholder='Shared styling' defaultValue='secret' />
      <Textarea label='Textarea' placeholder='Shared styling' defaultValue='Textarea input' autosize minRows={2} />
      <NumberInput label='NumberInput' placeholder='Shared styling' defaultValue={42} />
    </Stack>
  ),
}
