import React from 'react';
import {bem} from 'js/bem';
import {redirectToLogin} from 'js/router/routerUtils';

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

  render() {
    return (
      <bem.FormModal>
        <bem.FormModal__group>
          {t("Either you don't have access to this route or this route simply doesn't exist.")}
        </bem.FormModal__group>

        <bem.Modal__footer>
          <bem.KoboButton
            m='blue'
            onClick={this.goToLogin}
          >
            {t('Log in')}
          </bem.KoboButton>
        </bem.Modal__footer>
      </bem.FormModal>
    );
  }
}

export default AccessDeniedModal;
