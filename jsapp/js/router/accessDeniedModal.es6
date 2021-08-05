import React from 'react';
import {bem} from 'js/bem';

class AccessDeniedModal extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <bem.FormModal>
        <bem.FormModal__group>
          test1
        </bem.FormModal__group>
      </bem.FormModal>
    );
  }
}

export default AccessDeniedModal;
