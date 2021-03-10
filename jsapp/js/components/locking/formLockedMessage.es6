import React from 'react';
import autoBind from 'react-autobind';
import {bem} from 'js/bem';
import {isAssetLocked} from 'js/components/locking/lockingUtils';

/**
 * @prop {object} asset
 */
class FormLockedMessage extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      isOpen: false,
    };
    autoBind(this);
  }

  toggleMoreInfo(evt) {
    evt.preventDefault();
    this.setState({isOpen: !this.state.isOpen});
  }

  render() {
    if (!isAssetLocked(this.props.asset)) {
      return null;
    }

    return (
      <bem.FormBuilder__messageBox>
        this is locked be aware
      </bem.FormBuilder__messageBox>
    );
  }
}

export default FormLockedMessage;
