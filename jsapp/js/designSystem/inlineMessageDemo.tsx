import React from 'react';
import Select from 'react-select';
import bem from 'js/bem';
import type {InlineMessageType} from 'js/components/common/inlineMessage';
import Radio from 'js/components/common/radio';
import TextBox from 'js/components/common/textBox';
import InlineMessage from 'js/components/common/inlineMessage';
import {IconNames} from 'jsapp/fonts/k-icons';

const inlineMessageTypes: InlineMessageType[] = ['default', 'error', 'success', 'warning'];

const iconNamesOptions: IconNameOption[] = [];
for (const iconName in IconNames) {
  // Hacking TypeScript: https://stackoverflow.com/a/51281023/2311247
  const typedIconName: IconNames = IconNames[iconName as keyof typeof IconNames];
  iconNamesOptions.push({
    label: typedIconName,
    value: typedIconName,
  });
}

interface InlineMessageDemoState {
  demoType: InlineMessageType;
  demoIcon: IconNameOption | null;
  demoMessage: string;
}

interface IconNameOption {
  value: IconNames;
  label: IconNames;
}

const defaultMessage = 'If debugging is the process of removing software bugs, then programming must be the process of putting them in.';

export default class InlineMessageDemo extends React.Component<{}, InlineMessageDemoState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      demoType: 'warning',
      demoIcon: null,
      demoMessage: defaultMessage,
    };
  }

  onTypeChange(newType: string) {
    const newTypeCasted = newType as InlineMessageType;
    this.setState({demoType: newTypeCasted});
  }

  onIconChange(newIcon: IconNameOption | null) {
    this.setState({demoIcon: newIcon ? newIcon : null});
  }

  onMessageChange(newMessage: string) {
    this.setState({demoMessage: newMessage});
  }

  render() {
    return (
      <section>
        <h1><code>&lt;InlineMessage&gt;</code> component</h1>

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
                      <Radio
                        title='type'
                        name='type'
                        selected={this.state.demoType}
                        options={inlineMessageTypes.map(
                          (type: InlineMessageType) => {return {value: type, label: type};}
                        )}
                        onChange={this.onTypeChange.bind(this)}
                      />
                    </div>
                  </div>

                  <div className='demo__form-row'>
                    <div className='demo__form-config'>
                      <label htmlFor='start-icon'>start icon</label>
                      <Select
                        inputId='start-icon'
                        value={this.state.demoIcon}
                        isClearable
                        options={iconNamesOptions}
                        onChange={this.onIconChange.bind(this)}
                      />
                    </div>
                  </div>

                  <div className='demo__form-row'>
                    <div className='demo__form-config'>
                      <TextBox
                        label='text'
                        customModifiers='on-white'
                        onChange={this.onMessageChange.bind(this)}
                        value={this.state.demoMessage}
                      />
                    </div>
                  </div>
                </form>
              </bem.SimpleTable__cell>
              <bem.SimpleTable__cell m='align-top'>
                <div className='demo__preview'>
                  <InlineMessage
                    type={this.state.demoType}
                    icon={this.state.demoIcon?.value}
                    message={this.state.demoMessage}
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
