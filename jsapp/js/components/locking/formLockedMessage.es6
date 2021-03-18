import React from 'react';
import autoBind from 'react-autobind';
import {bem} from 'js/bem';
import {ASSET_TYPES} from 'js/constants';
import {
  isAssetLocked,
  isAssetAllLocked,
} from 'js/components/locking/lockingUtils';

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

  getMessageText() {
    const isAllLocked = isAssetAllLocked(this.props.asset);
    if (this.props.asset.asset_type === ASSET_TYPES.template.id) {
      if (isAllLocked) {
        return 'fully locked tempalte msg';
      } else {
        return 'partially locked tempalte msg';
      }
    } else if (isAllLocked) {
      return 'fully locked form msg';
    } else {
      return 'partially locked form msg';
    }
  }

  render() {
    if (!isAssetLocked(this.props.asset)) {
      return null;
    }

    return (
      <bem.FormBuilder__messageBox>
        {/* <span>lockpad icon</span> */}
        <span>{this.getMessageText()}</span>
        <span onClick={this.toggleMoreInfo}>{t('see more')}</span>

        {this.state.isOpen &&
          <div>a list of cans and can'ts</div>
        }
      </bem.FormBuilder__messageBox>
    );
  }
}

export default FormLockedMessage;
