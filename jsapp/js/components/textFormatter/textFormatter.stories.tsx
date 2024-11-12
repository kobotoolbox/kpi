import type {Meta, StoryFn} from '@storybook/react';
import TextFormatter from './textFormatter.component';

export default {
  title: 'misc/TextFormatter',
  component: TextFormatter,
  argTypes: {
    text: {
      description: 'Text containing markdown-like syntax for formatting. Accepts italic, bold and links with and without target indication. Formatting can be nested to be combined.',
      control: 'text',
    },
  },
} as Meta<typeof TextFormatter>;

const Template: StoryFn<typeof TextFormatter> = (args) => (
  <TextFormatter {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  text: 'Formatted text with **bold** and *italic* and [link](https://www.kobotoolbox.org/pricing/){:target="_blank"}. Formatting can be **bold and *italic* combined**, [also **on** *links*](http://kobotoolbox.org).',
};
