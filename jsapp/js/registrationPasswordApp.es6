/**
 * This application handles password strength in registration form (which is
 * mainly non-JS form).
 */

import React from 'react';
import PasswordStrength from './components/passwordStrength';

const PASS_INPUT_ID = 'id_password1';

class RegistrationPasswordApp extends React.Component {
  constructor(props) {
    super(props);
    this.state = {currentPass: ''}
  }

  componentDidMount() {
    this.watchInput(PASS_INPUT_ID);
  }

  watchInput(inputId) {
    const inputEl = document.getElementById(inputId);
    if (inputEl) {
      inputEl.addEventListener('input', (evt) => {
        this.setState({currentPass: evt.currentTarget.value})
      });
    } else {
      throw new Error(`Input "${inputId}" not found!`);
    }
  }

  render() {
    return (
      <PasswordStrength password={this.state.currentPass} />
    );
  }
};

export default RegistrationPasswordApp;
