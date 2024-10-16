import React from 'react';
import type {ComponentStory, ComponentMeta} from '@storybook/react';

import Avatar from './avatar';
import type {AvatarSize} from './avatar';

const avatarSizes: AvatarSize[] = ['s', 'm', 'l'];

export default {
  title: 'common/Avatar',
  component: Avatar,
  argTypes: {
    username: {type: 'string'},
    size: {
      options: avatarSizes,
      control: {type: 'select'},
    },
    isUsernameVisible: {type: 'boolean'},
  },
} as ComponentMeta<typeof Avatar>;

const Template: ComponentStory<typeof Avatar> = (args) => <Avatar {...args} />;

export const Primary = Template.bind({});
Primary.args = {
  username: 'Leszek',
  size: avatarSizes[0],
  isUsernameVisible: true,
};

// We want to test how the avatar colors look like with some ~random usernames.
const bulkUsernames = [
// NATO phonetic alphabet (https://en.wikipedia.org/wiki/NATO_phonetic_alphabet)
'Alfa', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel',
'India', 'Juliett', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa',
'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'Xray',
'Yankee', 'Zulu',
// Top 100 most popular names in the world (https://forebears.io/earth/forenames)
'Maria', 'Nushi', 'Mohammed', 'Jose', 'Muhammad', 'Mohamed', 'Wei', 'Mohammad',
'Ahmed', 'Yan', 'Ali', 'John', 'David', 'Li', 'Abdul', 'Ana', 'Ying', 'Michael',
'Juan', 'Anna', 'Mary', 'Jean', 'Robert', 'Daniel', 'Luis', 'Carlos', 'James',
'Antonio', 'Joseph', 'Hui', 'Elena', 'Francisco', 'Hong', 'Marie', 'Min', 'Lei',
'Yu', 'Ibrahim', 'Peter', 'Fatima', 'Aleksandr', 'Richard', 'Xin', 'Bin',
'Paul', 'Ping', 'Lin', 'Olga', 'Sri', 'Pedro', 'William', 'Rosa', 'Thomas',
'Jorge', 'Yong', 'Elizabeth', 'Sergey', 'Ram', 'Patricia', 'Hassan', 'Anita',
'Manuel', 'Victor', 'Sandra', 'Ming', 'Siti', 'Miguel', 'Emmanuel', 'Samuel',
'Ling', 'Charles', 'Sarah', 'Mario', 'Joao', 'Tatyana', 'Mark', 'Rita',
'Martin', 'Svetlana', 'Patrick', 'Natalya', 'Qing', 'Ahmad', 'Martha', 'Andrey',
'Sunita', 'Andrea', 'Christine', 'Irina', 'Laura', 'Linda', 'Marina', 'Carmen',
'Ghulam', 'Vladimir', 'Barbara', 'Angela', 'George', 'Roberto', 'Peng',
];
export const BulkTest = () => (
  <div style={{display: 'flex', flexWrap: 'wrap', gap: '10px'}}>
    {bulkUsernames.map((username) => (
      <div key={username}>
        <Avatar size='m' username={username} isUsernameVisible/>
      </div>
    ))}
  </div>
);
