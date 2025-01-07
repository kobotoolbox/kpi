import React, {useState} from 'react';
import {Menu} from '@mantine/core';
import Button from './ButtonNew';

export default {title: 'common/Dropdown Menu'};

export function dropdownMenu() {
  return (
    <div style={{padding: 40, display: 'flex', justifyContent: 'center'}}>
      <Menu width={100}>
        <Menu.Target>
          <Button>Toggle menu</Button>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Item
            leftSection={<i className='k-icon k-icon-sort-ascending' />}
          >
            Item 1
          </Menu.Item>
          <Menu.Item leftSection={<i className='k-icon k-icon-hide' />}>
            Item 2
          </Menu.Item>
          <Menu.Item leftSection={<i className='k-icon k-icon-users' />}>
            Item 3
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            variant='danger'
            leftSection={<i className='k-icon k-icon-users' />}
          >
            Item 4
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </div>
  );
}
