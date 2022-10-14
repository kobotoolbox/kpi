import React from 'react';
import bem from 'js/bem';
import KoboModal from 'js/components/common/koboModal';
import KoboPrompt from 'js/components/common/koboPrompt';
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
                    >
                      <Button
                        type='full'
                        color='storm'
                        size='s'
                        onClick={this.togglePrompt.bind(this)}
                        label={'cancel'}
                      />

                      <Button
                        type='full'
                        color='red'
                        size='s'
                        onClick={this.confirmSomeAction.bind(this)}
                        label={'confirm some action!'}
                      />
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
