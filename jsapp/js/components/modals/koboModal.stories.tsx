import type { Meta, StoryObj } from '@storybook/react'
import Button from '../common/button'
import KoboModal from './koboModal'
import KoboModalContent from './koboModalContent'
import KoboModalFooter from './koboModalFooter'
import KoboModalHeader from './koboModalHeader'

const meta: Meta<typeof KoboModal> = {
  title: 'Design system old/KoboModal',
  component: KoboModal,
  argTypes: {
    isOpen: { control: 'boolean' },
  },
}

export default meta

type Story = StoryObj<typeof KoboModal>

export const Primary: Story = {
  args: {
    isOpen: true,
    // TODO: this doesn't work in story, but since this is a deprecated component, it's fine
    isDismissableByDefaultMeans: true,
  },
  render: (args) => (
    <KoboModal {...args}>
      <KoboModalHeader>{'KoboModal test'}</KoboModalHeader>
      <KoboModalContent>
        <p>{'This is a test modal. It has some custom content.'}</p>
        <p>{'It uses three different components to render the content:'}</p>
        <ul>
          <li>{'KoboModalHeader,'}</li>
          <li>{'KoboModalContent,'}</li>
          <li>{'KoboModalFooter.'}</li>
        </ul>
        <p>{'All these components are optional (but built in inside KoboPrompt).'}</p>
        <p>{'You can display anything you like inside KoboModal - it does not assume anything.'}</p>
      </KoboModalContent>

      <KoboModalFooter>
        <Button type='primary' size='m' onClick={() => {}} label={'click'} />
        <Button type='danger' size='m' onClick={() => {}} label={'click'} />
      </KoboModalFooter>
    </KoboModal>
  ),
}
