import React from 'react';
import bem from 'js/bem';
import KoboPrompt from 'js/components/modals/koboPrompt';
import Button from 'js/components/common/button';
import Checkbox from 'js/components/common/checkbox';

interface KoboModalDemoState {
  demoIsPromptOpen: boolean;
  demoIsDismissableByDefaultMeans: boolean;
  demoHasIcon: boolean;
}

export default class KoboModalDemo extends React.Component<{}, KoboModalDemoState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      demoIsPromptOpen: false,
      demoIsDismissableByDefaultMeans: true,
      demoHasIcon: true,
    };
  }

  onIsDismissableByDefaultMeansChange(isChecked: boolean) {
    this.setState({demoIsDismissableByDefaultMeans: isChecked});
  }

  onHasIconChange(isChecked: boolean) {
    this.setState({demoHasIcon: isChecked});
  }

  togglePrompt() {
    this.setState({demoIsPromptOpen: !this.state.demoIsPromptOpen});
  }

  render() {
    return (
      <section>
        <h1><code>&lt;KoboPrompt&gt;</code> component</h1>

        <p>This component is built atop the more general <code>KoboModal</code>.</p>

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
                        label='should have an icon'
                        onChange={this.onHasIconChange.bind(this)}
                        checked={this.state.demoHasIcon}
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
                    onClick={this.togglePrompt.bind(this)}
                    label={'open prompt'}
                  />

                  <KoboPrompt
                    isOpen={this.state.demoIsPromptOpen}
                    onRequestClose={this.togglePrompt.bind(this)}
                    title='Have a nice day!'
                    titleIcon={this.state.demoHasIcon ? 'information' : undefined}
                    titleIconColor={this.state.demoHasIcon ? 'blue' : undefined}
                    buttons={[
                      {
                        color: 'blue',
                        label: 'ok, thanks',
                        onClick: this.togglePrompt.bind(this),
                      },
                    ]}
                    isDismissableByDefaultMeans={this.state.demoIsDismissableByDefaultMeans}
                  >
                    {'This is just some basic prompt example with single button.'}
                  </KoboPrompt>
                </div>
              </bem.SimpleTable__cell>
            </bem.SimpleTable__row>
          </bem.SimpleTable__body>
        </bem.SimpleTable>
      </section>
    );
  }
}
