import React from 'react';
import {ComponentStory, ComponentMeta} from '@storybook/react';
import KoboModal from './koboModal';
import KoboModalHeader from './koboModalHeader';
import KoboModalContent from './koboModalContent';
import KoboModalFooter from './koboModalFooter';
import Button from '../common/button';
import KoboPrompt from './koboPrompt';

export default {
  title: 'commonDeprecated/KoboModal',
  component: KoboModal,
  argTypes: {
    isOpen: {control: 'boolean'},
    demoIsPromptOpen: {control: 'boolean'},
    demoShouldHaveX: {control: 'boolean'},
  },
  args: {
    demoIsPromptOpen: false,
    demoShouldHaveX: false,
  },
} as ComponentMeta<typeof KoboModal>;

const Template: ComponentStory<typeof KoboModal> = (args: any) => (
  <KoboModal {...args}>
    <KoboModalHeader
      onRequestCloseByX={args.demoShouldHaveX ? () => {} : undefined}
    >
      {'KoboModal test'}
    </KoboModalHeader>
    <KoboModalContent>
      <p>
        {
          'This is a test modal. It has some custom content and can open a (nested) prompt.'
        }
      </p>
      <p>{'It uses three different components to render the content:'}</p>
      <ul>
        <li>{'KoboModalHeader,'}</li>
        <li>{'KoboModalContent,'}</li>
        <li>{'KoboModalFooter.'}</li>
      </ul>
      <p>
        {'All these components are optional (but built in inside KoboPrompt).'}
      </p>
      <p>
        {
          'You can display anything you like inside KoboModal - it does not assume anything.'
        }
      </p>
    </KoboModalContent>

    <KoboModalFooter>
      <Button
        type='primary'
        size='m'
        onClick={() => {}}
        label={'click to close modal from inside'}
      />

      <Button
        type='danger'
        size='m'
        onClick={() => {}}
        label={'some action that needs confirmation'}
      />
    </KoboModalFooter>

    <KoboPrompt
      isOpen={args.demoIsPromptOpen}
      onRequestClose={() => {}}
      title='Are you sure?'
      titleIcon='alert'
      titleIconColor='mid-red'
      buttons={[
        {
          type: 'secondary',
          label: 'cancel',
          onClick: () => {},
        },
        {
          type: 'danger',
          label: 'confirm',
          onClick: () => {},
        },
      ]}
    >
      {'This is some dangerous stuff here. Please confirm you want to do this.'}
    </KoboPrompt>
  </KoboModal>
);

export const Primary = Template.bind({});
Primary.args = {
    isOpen: true
};
