/**
 * This application handles password strength in registration form (which is
 * mainly non-JS form).
 */

import React from 'react';
import PasswordStrength from './components/passwordStrength.component';
import envStore from './envStore';

const PASS_INPUT_ID = 'id_password1';

interface RegistrationPasswordAppState {
  currentPass: string;
}

class RegistrationPasswordApp extends React.Component<
  {},
  RegistrationPasswordAppState
> {
  inputEl = document.getElementById(PASS_INPUT_ID);
  onInputBound = this.onInput.bind(this);
  state: RegistrationPasswordAppState = {currentPass: ''};

  componentDidMount() {
    if (this.inputEl) {
      this.watchInput();
    } else {
      throw new Error(`Input "${PASS_INPUT_ID}" not found!`);
    }
  }

  componentWillUnmount() {
    this.unwatchInput();
  }

  onInput(evt: Event) {
    const evtTarget = evt.currentTarget as HTMLInputElement;
    this.setState({currentPass: evtTarget.value});
  }

  watchInput() {
    this.inputEl?.addEventListener('input', this.onInputBound);
  }

  unwatchInput() {
    this.inputEl?.removeEventListener('input', this.onInputBound);
  }

  render() {
    if (envStore.isReady && envStore.data.enable_password_entropy_meter) {
      return <PasswordStrength password={this.state.currentPass} />;
    }

    return null;
  }
}

export default RegistrationPasswordApp;
