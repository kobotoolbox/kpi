import React from 'react';
import bem from 'js/bem';
import {ASSET_TYPES} from 'js/constants';
import {
  isAssetLocked,
  isAssetAllLocked,
  getFormFeatures,
} from 'js/components/locking/lockingUtils';
import type {AssetResponse} from 'jsapp/js/dataInterface';

interface FormLockedMessageProps {
  asset: AssetResponse;
}
interface FormLockedMessageState {
  isOpen: boolean;
}

class FormLockedMessage extends React.Component<
  FormLockedMessageProps,
  FormLockedMessageState
> {
  constructor(props: FormLockedMessageProps){
    super(props);
    this.state = {
      isOpen: false,
    };
  }

  toggleMoreInfo(evt: React.TouchEvent) {
    evt.preventDefault();
    this.setState({isOpen: !this.state.isOpen});
  }

  getMessageText() {
    const isAllLocked = (
      this.props.asset.content !== undefined &&
      isAssetAllLocked(this.props.asset.content)
    );
    if (this.props.asset.asset_type === ASSET_TYPES.template.id) {
      if (isAllLocked) {
        // fully locked template
        return t('This is a fully locked template. Go to question settings to see specific restrictions.');
      } else {
        // partially locked template
        return t('This is a partially locked template. Go to question settings to see specific restrictions. Expand this notification to see form level restrictions.');
      }
    } else if (isAllLocked) {
      // fully locked form
      return t('This form was created using a fully locked template. This means no edits were permitted by the template creator.');
    } else {
      // partially locked form
      return t('This form was created using a partially locked template. Go to question settings to see specific restrictions. Expand this notification to see form level restrictions.');
    }
  }

  renderSeeMore() {
    const features = this.props.asset.content ? getFormFeatures(this.props.asset.content) : null;
    if (features === null) {
      return null;
    }

    return (
      <React.Fragment>
        <bem.FormBuilderMessageBox__toggle onClick={this.toggleMoreInfo.bind(this)}>
          {t('see more')}
          {this.state.isOpen && <i className='k-icon k-icon-angle-up'/>}
          {!this.state.isOpen && <i className='k-icon k-icon-angle-down'/>}
        </bem.FormBuilderMessageBox__toggle>

        {this.state.isOpen &&
          <bem.FormBuilderMessageBox__details>
            <div className='locked-features'>
              {features.cants.length >= 1 &&
                <ul className='locked-features__list locked-features__list--cants'>
                  <label>
                    {t('Locked functionalities')}
                  </label>
                  {features.cants.map((cant) => (
                    <li key={cant.name}>
                      <i className='k-icon k-icon-close'/>
                      {cant.label}
                    </li>
                  ))}
                </ul>
              }

              {features.cans.length >= 1 &&
                <ul className='locked-features__list locked-features__list--cans'>
                  <label>
                    {t('Unlocked functionalities')}
                  </label>
                  {features.cans.map((can) => (
                    <li key={can.name}>
                      <i className='k-icon k-icon-check'/>
                      {can.label}
                    </li>
                  ))}
                </ul>
              }
            </div>
          </bem.FormBuilderMessageBox__details>
        }
      </React.Fragment>
    );
  }

  render() {
    if (!this.props.asset.content) {
      return null;
    }

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
