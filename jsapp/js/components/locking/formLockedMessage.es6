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
    const isAllLocked = isAssetAllLocked(this.props.asset.content);
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
    if (!isAssetLocked(this.props.asset.content)) {
      return null;
    }

    return (
      <bem.FormBuilderMessageBox>
        {/* <span>lockpad icon</span> */}
        <p>{this.getMessageText()}</p>

        {/* see more is not needed for fully locked template */}
        <bem.FormBuilderMessageBox__toggle onClick={this.toggleMoreInfo}>
          {t('see more')}
        </bem.FormBuilderMessageBox__toggle>

        {this.state.isOpen &&
          <bem.FormBuilderMessageBox__details>
            a list of cans and can'ts

            <bem.FormBuilderMessageBox__list>
              <bem.FormBuilderMessageBox__listTitle>
                can's
              </bem.FormBuilderMessageBox__listTitle>

              <bem.FormBuilderMessageBox__listItem>
                can 1
              </bem.FormBuilderMessageBox__listItem>
              <bem.FormBuilderMessageBox__listItem>
                can 2
              </bem.FormBuilderMessageBox__listItem>
              <bem.FormBuilderMessageBox__listItem>
                can 3
              </bem.FormBuilderMessageBox__listItem>
            </bem.FormBuilderMessageBox__list>

            <bem.FormBuilderMessageBox__list>
              <bem.FormBuilderMessageBox__listTitle>
                cant's
              </bem.FormBuilderMessageBox__listTitle>

              <bem.FormBuilderMessageBox__listItem>
                cant 1
              </bem.FormBuilderMessageBox__listItem>
              <bem.FormBuilderMessageBox__listItem>
                cant 2
              </bem.FormBuilderMessageBox__listItem>
            </bem.FormBuilderMessageBox__list>
          </bem.FormBuilderMessageBox__details>
        }
      </bem.FormBuilderMessageBox>
    );
  }
}

export default FormLockedMessage;
