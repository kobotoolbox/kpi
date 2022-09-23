import React from 'react';
import bem from 'js/bem';
import Checkbox from 'js/components/common/checkbox';
import MiniAudioPlayer from 'js/components/common/miniAudioPlayer';
import TextBox from 'js/components/common/textBox';

interface MiniAudioPlayerDemoState {
  demoUrl: string;
  demoPreload: boolean;
}

const defaultUrl = 'https://ia800304.us.archive.org/20/items/OTRR_Gunsmoke_Singles/Gunsmoke%2052-04-26%20%28001%29%20Billy%20the%20Kid.mp3';

export default class MiniAudioPlayerDemo extends React.Component<{}, MiniAudioPlayerDemoState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      demoUrl: defaultUrl,
      demoPreload: false,
    };
  }

  onUrlChange(newLabel: string) {
    this.setState({demoUrl: newLabel});
  }

  onPreloadChange(isChecked: boolean) {
    this.setState({demoPreload: isChecked});
  }

  render() {
    return (
      <section>
        <h1><code>&lt;MiniAudioPlayer&gt;</code> component</h1>

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
                  <div className='demo__form-row'>
                    <div className='demo__form-config'>
                      <TextBox
                        label='text'
                        customModifiers='on-white'
                        onChange={this.onUrlChange.bind(this)}
                        value={this.state.demoUrl}
                      />
                    </div>
                  </div>

                  <div className='demo__form-row'>
                    <div className='demo__form-config'>
                      <Checkbox
                        label='preload?'
                        onChange={this.onPreloadChange.bind(this)}
                        checked={this.state.demoPreload}
                      />
                    </div>
                  </div>
                </form>
              </bem.SimpleTable__cell>
              <bem.SimpleTable__cell>
                <div className='demo__preview'>
                  <MiniAudioPlayer
                    mediaURL={this.state.demoUrl}
                    preload={this.state.demoPreload}
                  />
                </div>
              </bem.SimpleTable__cell>
            </bem.SimpleTable__row>
          </bem.SimpleTable__body>
        </bem.SimpleTable>
      </section>
    );
  }
}
