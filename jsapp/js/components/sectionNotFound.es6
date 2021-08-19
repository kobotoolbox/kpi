import React from 'react';
import bem from 'js/bem';

export default class SectionNotFound extends React.Component {
  render() {
    return (
      <bem.uiPanel className='k404'>
        <bem.uiPanel__body>
          <i />
          <em>section not found</em>
        </bem.uiPanel__body>
      </bem.uiPanel>
    );
  }
}
