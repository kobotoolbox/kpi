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
        return 'TODO fully locked tempalte msg';
      } else {
        return 'TODO partially locked tempalte msg';
      }
    } else if (isAllLocked) {
      return 'TODO fully locked form msg';
    } else {
      return 'TODO partially locked form msg';
    }
  }

  renderSeeMore() {
    return (
      <React.Fragment>
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
      </React.Fragment>
    );
  }

  render() {
    if (!isAssetLocked(this.props.asset.content)) {
      return null;
    }

    const isAllLocked = isAssetAllLocked(this.props.asset.content);

    return (
      <bem.FormBuilderMessageBox>
        <i className='k-icon k-icon-lock'/>

        <p>{this.getMessageText()}</p>

        {!isAllLocked && this.renderSeeMore()}
      </bem.FormBuilderMessageBox>
    );
  }
}

export default FormLockedMessage;
