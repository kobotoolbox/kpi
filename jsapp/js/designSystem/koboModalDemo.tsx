import React from 'react';
import bem from 'js/bem';
import KoboModal from 'js/components/modals/koboModal';
import KoboPrompt from 'js/components/modals/koboPrompt';
import Checkbox from 'js/components/common/checkbox';
import Button from 'js/components/common/button';

interface KoboModalDemoState {
  demoIsModalOpen: boolean;
  demoIsPromptOpen: boolean;
}

export default class KoboModalDemo extends React.Component<{}, KoboModalDemoState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      demoIsModalOpen: false,
      demoIsPromptOpen: false,
    };
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
              <bem.SimpleTable__cell>
                <form>
                  …
                </form>
              </bem.SimpleTable__cell>
              <bem.SimpleTable__cell>
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
                  >
                    {'This is a test modal. It has some custom content and can open a (nested) prompt.'}

                    <Button
                      type='full'
                      color='blue'
                      size='m'
                      onClick={this.toggleModal.bind(this)}
                      label={'close modal from inside'}
                    />

                    <Button
                      type='full'
                      color='red'
                      size='m'
                      onClick={this.togglePrompt.bind(this)}
                      label={'button that needs confirmation'}
                    />

                    <KoboPrompt
                      isOpen={this.state.demoIsPromptOpen}
                      onRequestClose={this.togglePrompt.bind(this)}
                      title='Are you sure?'
                      buttons={[
                        {
                          color: 'storm',
                          label: 'cancel',
                          onClick: this.togglePrompt.bind(this),
                        },
                        {
                          color: 'red',
                          label: 'confirm some action!',
                          onClick: this.confirmSomeAction.bind(this),
                        },
                      ]}
                    >
                      {'This is some dangerous stuff here. Please make sure before you proceed.'}
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
