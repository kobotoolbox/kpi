import React from 'react';
import {bem} from 'js/bem';
import {redirectToLogin} from 'js/router/routerUtils';
import envStore from 'js/envStore';

/**
 * @prop {function} onSetModalTitle - for changing the modal title by this component
 */
class AccessDeniedModal extends React.Component {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    this.props.onSetModalTitle(t('Access denied'));
  }

  goToLogin(evt) {
    evt.preventDefault();
    redirectToLogin();
  }

  goToSupport() {
    window.location.replace(envStore.data.support_url);
  }

  render() {
    return (
      <bem.FormModal>
        <bem.FormModal__group>
          {t("Either you don't have access to this route or this route simply doesn't exist.")}
          {t('You could either try logging in or contacting support if you encounter any problems.')}
          {t('To learn more')}
          &nbsp;
          <a href='https://kobotoolbox.org'>
            {t('visit kobotoolbox.org')}
          </a>
        </bem.FormModal__group>

        <bem.Modal__footer>
          {envStore.data.support_url &&
            <bem.KoboButton m='teal' onClick={this.goToSupport}>
              {t('Support')}
            </bem.KoboButton>
          }

          <bem.KoboButton m='blue' onClick={this.goToLogin}>
            {t('Log in')}
          </bem.KoboButton>
        </bem.Modal__footer>
      </bem.FormModal>
    );
  }
}

export default AccessDeniedModal;
