import React from 'react';
import type {ComponentStory, ComponentMeta, StoryObj} from '@storybook/react';

import Avatar from './avatar';
import type {AvatarSize} from './avatar';

const avatarSizes: AvatarSize[] = ['s', 'm'];

export default {
  title: 'common/Avatar',
  component: Avatar,
  argTypes: {
    size: {
      options: avatarSizes,
      control: {type: 'select'},
    },
    username: {type: 'string'},
    isUsernameVisible: {type: 'boolean'},
    hasFullName: {
      type: 'boolean',
      description: 'Allows testing `fullName` being empty string or not existing',
    },
    fullName: {type: 'string', if: {arg: 'hasFullName', truthy: true}},
    hasEmail: {
      type: 'boolean',
      description: 'Allows testing `email` being empty string or not existing',
    },
    email: {type: 'string', if: {arg: 'hasEmail', truthy: true}},
  },
} as ComponentMeta<typeof Avatar>;

const Template: ComponentStory<typeof Avatar> = (args) => (
  <Avatar
    size={args.size}
    username={args.username}
    isUsernameVisible={args.isUsernameVisible}
    fullName={args.fullName}
    email={args.email}
  />
);

export const Simple = Template.bind({});
Simple.args = {
  size: avatarSizes[0],
  username: 'leszek',
  isUsernameVisible: true,
};

export const Full: StoryObj<typeof Avatar> = {
  render: () => (
    <Avatar
      size='m'
      username='wilhelm_lg_swh'
      isUsernameVisible
      fullName='Wilhelm Ludwig Georg zu Sayn-Wittgenstein-Hohenstein'
      email='wilhelm@swh.de'
    />
  ),
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
export const BulkColorsTest = () => (
  <div style={{display: 'flex', flexWrap: 'wrap', gap: '10px'}}>
    {bulkUsernames.map((username) => (
      <div key={username}>
        <Avatar size='m' username={username}/>
      </div>
    ))}
  </div>
);
