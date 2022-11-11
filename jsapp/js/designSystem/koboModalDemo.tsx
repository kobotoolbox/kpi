import React from 'react';
import bem from 'js/bem';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalContent from 'js/components/modals/koboModalContent';
import KoboModalFooter from 'js/components/modals/koboModalFooter';
import KoboPrompt from 'js/components/modals/koboPrompt';
import Button from 'js/components/common/button';
import Checkbox from 'js/components/common/checkbox';

interface KoboModalDemoState {
  demoIsModalOpen: boolean;
  demoIsPromptOpen: boolean;
  demoIsDismissableByDefaultMeans: boolean;
  demoShouldHaveX: boolean;
}

export default class KoboModalDemo extends React.Component<{}, KoboModalDemoState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      demoIsModalOpen: false,
      demoIsPromptOpen: false,
      demoIsDismissableByDefaultMeans: true,
      demoShouldHaveX: true,
    };
  }

  onIsDismissableByDefaultMeansChange(isChecked: boolean) {
    this.setState({demoIsDismissableByDefaultMeans: isChecked});
  }

  onShouldHaveXChange(isChecked: boolean) {
    this.setState({demoShouldHaveX: isChecked})
  }

  confirmSomeAction() {
    this.togglePrompt();
    this.toggleModal();
    console.log('action confirmed!');
  }

  toggleModal() {
    this.setState({demoIsModalOpen: !this.state.demoIsModalOpen});
  }

  togglePrompt() {
    this.setState({demoIsPromptOpen: !this.state.demoIsPromptOpen});
  }

  render() {
    return (
      <section>
        <h1><code>&lt;KoboModal&gt;</code> component</h1>

        <bem.SimpleTable>
          <bem.SimpleTable__header>
            <bem.SimpleTable__row>
              <bem.SimpleTable__cell>configuration</bem.SimpleTable__cell>
              <bem.SimpleTable__cell>live view</bem.SimpleTable__cell>
            </bem.SimpleTable__row>
          </bem.SimpleTable__header>
          <bem.SimpleTable__body>
            <bem.SimpleTable__row>
              <bem.SimpleTable__cell m='align-top'>
                <form>
                  <div className='demo__form-row'>
                    <div className='demo__form-config'>
                      <Checkbox
                        label='should close on overlay click or Esc'
                        onChange={this.onIsDismissableByDefaultMeansChange.bind(this)}
                        checked={this.state.demoIsDismissableByDefaultMeans}
                      />
                    </div>
                  </div>

                  <div className='demo__form-row'>
                    <div className='demo__form-config'>
                      <Checkbox
                        label='should have "x" close button'
                        onChange={this.onShouldHaveXChange.bind(this)}
                        checked={this.state.demoShouldHaveX}
                      />
                    </div>
                  </div>
                </form>
              </bem.SimpleTable__cell>
              <bem.SimpleTable__cell m='align-top'>
                <div className='demo__preview'>
                  <Button
                    type='frame'
                    color='storm'
                    size='l'
                    onClick={this.toggleModal.bind(this)}
                    label={'open modal'}
                  />

                  <KoboModal
                    isOpen={this.state.demoIsModalOpen}
                    onRequestClose={this.toggleModal.bind(this)}
                    size='large'
                    isDismissableByDefaultMeans={this.state.demoIsDismissableByDefaultMeans}
                    data-cy='KoboModal-demo-test'
                  >
                    <KoboModalHeader
                      onRequestCloseByX={this.state.demoShouldHaveX ? this.toggleModal.bind(this) : undefined}
                    >
                      {'KoboModal test'}
                    </KoboModalHeader>
                    <KoboModalContent>
                      <p>{'This is a test modal. It has some custom content and can open a (nested) prompt.'}</p>
                      <p>{'It uses three different components to render the content:'}</p>
                      <ul>
                        <li>{'KoboModalHeader,'}</li>
                        <li>{'KoboModalContent,'}</li>
                        <li>{'KoboModalFooter.'}</li>
                      </ul>
                      <p>{'All these components are optional (but built in inside KoboPrompt).'}</p>
                      <p>{'You can display anything you like inside KoboModal - it does not assume anything.'}</p>
                    </KoboModalContent>

                    <KoboModalFooter>
                      <Button
                        type='full'
                        color='blue'
                        size='m'
                        onClick={this.toggleModal.bind(this)}
                        label={'click to close modal from inside'}
                      />

                      <Button
                        type='full'
                        color='red'
                        size='m'
                        onClick={this.togglePrompt.bind(this)}
                        label={'some action that needs confirmation'}
                      />
                    </KoboModalFooter>

                    <KoboPrompt
                      isOpen={this.state.demoIsPromptOpen}
                      onRequestClose={this.togglePrompt.bind(this)}
                      title='Are you sure?'
                      titleIcon='alert'
                      titleIconColor='red'
                      buttons={[
                        {
                          color: 'storm',
                          label: 'cancel',
                          onClick: this.togglePrompt.bind(this),
                        },
                        {
                          color: 'red',
                          label: 'confirm',
                          onClick: this.confirmSomeAction.bind(this),
                        },
                      ]}
                    >
                      {'This is some dangerous stuff here. Please confirm you want to do this.'}
                    </KoboPrompt>
                  </KoboModal>
                </div>
              </bem.SimpleTable__cell>
            </bem.SimpleTable__row>
          </bem.SimpleTable__body>
        </bem.SimpleTable>
      </section>
    );
  }
}
