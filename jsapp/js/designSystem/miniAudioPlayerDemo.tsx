import React from 'react';
import bem from 'js/bem';
import MiniAudioPlayer from 'js/components/common/miniAudioPlayer';
import TextBox from 'js/components/common/textBox';

interface MiniAudioPlayerDemoState {
  demoUrl: string;
}

const defaultUrl = 'https://ia902203.us.archive.org/11/items/testmp3testfile/mpthreetest.mp3';

export default class MiniAudioPlayerDemo extends React.Component<{}, MiniAudioPlayerDemoState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      demoUrl: defaultUrl,
    };
  }

  onUrlChange(newLabel: string) {
    this.setState({demoUrl: newLabel});
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
                </form>
              </bem.SimpleTable__cell>
              <bem.SimpleTable__cell>
                <div className='demo__preview'>
                  <MiniAudioPlayer mediaURL={this.state.demoUrl}/>
                </div>
              </bem.SimpleTable__cell>
            </bem.SimpleTable__row>
          </bem.SimpleTable__body>
        </bem.SimpleTable>
      </section>
    );
  }
}
