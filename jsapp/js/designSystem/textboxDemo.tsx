import React from 'react'
import bem from 'js/bem';
import Checkbox from 'js/components/common/checkbox'
import TextBox, {AvailableType} from 'js/components/common/textBox'
import Radio from 'js/components/common/radio'

const textBoxTypes: AvailableType[] = ['text-multiline', 'text', 'email', 'password', 'url', 'number']

const errorsValues: {[val: string]: any} = {
  no: null,
  messageless: true,
  one: 'You need to type something else!',
  multi: [
    "First error is about one thing!",
    "Second error for the other thing!",
  ]
}

const errorsOptions = [
  {
    label: 'no error',
    value: 'no'
  },
  {
    label: 'error without any message',
    value: 'messageless'
  },
  {
    label: 'one error',
    value: 'one'
  },
  {
    label: 'multiple errors',
    value: 'multi'
  }
]

type TextBoxDemoState = {
  demoType: AvailableType
  demoErrors: string
  value: string
  demoLabel: string
  demoPlaceholder: string
  demoDescription: string
  demoIsReadOnly: boolean
  demoIsDisabled: boolean
  demoIsForWhiteBg: boolean
}

export default class TextBoxDemo extends React.Component<{}, TextBoxDemoState> {
  constructor(props: {}) {
    super(props)
    this.state = {
      demoType: 'text',
      demoErrors: 'no',
      value: '',
      demoLabel: 'Your real name',
      demoPlaceholder: 'Type your name…',
      demoDescription: 'We need your first and last name only.',
      demoIsReadOnly: false,
      demoIsDisabled: false,
      demoIsForWhiteBg: false,
    }
  }

  onTypeChange({}: any, newType: AvailableType) {
    this.setState({demoType: newType})
  }

  onErrorsChange({}: any, newErrors: string) {
    this.setState({demoErrors: newErrors})
  }

  onValueChange(newValue: string) {
    this.setState({value: newValue})
  }

  onLabelChange(newLabel: string) {
    this.setState({demoLabel: newLabel})
  }

  onPlaceholderChange(newPlaceholder: string) {
    this.setState({demoPlaceholder: newPlaceholder})
  }

  onDescriptionChange(newDescription: string) {
    this.setState({demoDescription: newDescription})
  }

  onIsReadOnlyChange(isChecked: boolean) {
    this.setState({demoIsReadOnly: isChecked})
  }

  onIsDisabledChange(isChecked: boolean) {
    this.setState({demoIsDisabled: isChecked})
  }

  onIsForWhiteBgChange(isChecked: boolean) {
    this.setState({demoIsForWhiteBg: isChecked})
  }

  render() {
    return (
      <section>
        <h1><code>&lt;TextBox&gt;</code> component</h1>

        <p>When you use <code>text-multiline</code> options, the input changes into <code>textarea</code> and accepts ENTER key for creating new lines of text.</p>

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
                      <Radio
                        title='type'
                        name='type'
                        selected={this.state.demoType}
                        options={textBoxTypes.map(
                          (type: AvailableType) => {return {value: type, label: type}}
                        )}
                        onChange={this.onTypeChange.bind(this)}
                      />
                    </div>

                    <div className='demo__form-config'>
                      <Radio
                        title='errors'
                        name='errors'
                        selected={this.state.demoErrors}
                        options={errorsOptions}
                        onChange={this.onErrorsChange.bind(this)}
                      />
                    </div>
                  </div>

                  <div className='demo__form-row'>
                    <div className='demo__form-config'>
                      <TextBox
                        label='label'
                        customModifiers='on-white'
                        onChange={this.onLabelChange.bind(this)}
                        value={this.state.demoLabel}
                      />
                    </div>

                    <div className='demo__form-config'>
                      <TextBox
                        label='description'
                        customModifiers='on-white'
                        onChange={this.onDescriptionChange.bind(this)}
                        value={this.state.demoDescription}
                      />
                    </div>
                  </div>

                  <div className='demo__form-row'>
                    <div className='demo__form-config'>
                      <TextBox
                        label='placeholder'
                        customModifiers='on-white'
                        onChange={this.onPlaceholderChange.bind(this)}
                        value={this.state.demoPlaceholder}
                      />
                    </div>

                    <div className='demo__form-config'>
                      <Checkbox
                        label='is for white background'
                        onChange={this.onIsForWhiteBgChange.bind(this)}
                        checked={this.state.demoIsForWhiteBg}
                      />
                    </div>
                  </div>

                  <div className='demo__form-row'>
                    <div className='demo__form-config'>
                      <Checkbox
                        label='is read only'
                        onChange={this.onIsReadOnlyChange.bind(this)}
                        checked={this.state.demoIsReadOnly}
                      />
                    </div>

                    <div className='demo__form-config'>
                      <Checkbox
                        label='is disabled'
                        onChange={this.onIsDisabledChange.bind(this)}
                        checked={this.state.demoIsDisabled}
                      />
                    </div>
                  </div>
                </form>
              </bem.SimpleTable__cell>
              <bem.SimpleTable__cell>
                <div className='demo__preview'>
                  <TextBox
                    type={this.state.demoType}
                    value={this.state.value}
                    onChange={this.onValueChange.bind(this)}
                    errors={errorsValues[this.state.demoErrors]}
                    label={this.state.demoLabel}
                    placeholder={this.state.demoPlaceholder}
                    description={this.state.demoDescription}
                    readOnly={this.state.demoIsReadOnly}
                    disabled={this.state.demoIsDisabled}
                    customModifiers={this.state.demoIsForWhiteBg ? 'on-white' : undefined}
                  />
                </div>
              </bem.SimpleTable__cell>
            </bem.SimpleTable__row>
          </bem.SimpleTable__body>
        </bem.SimpleTable>
      </section>
    )
  }
}
