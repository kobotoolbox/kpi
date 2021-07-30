import React from 'react';
import ui from 'js/ui';

export default class SectionNotFound extends React.Component {
  render() {
    return (
        <ui.Panel className='k404'>
          <i />
          <em>section not found</em>
        </ui.Panel>
      );
  }
}
