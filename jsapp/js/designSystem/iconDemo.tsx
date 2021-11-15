import React from 'react'
import Select from 'react-select'
import bem from 'js/bem';
import Radio from 'js/components/common/radio'
import Icon, {IconSize} from 'js/components/common/icon'
import {IconNames} from 'jsapp/fonts/k-icons'

const iconSizes: IconSize[] = ['xs', 's', 'm', 'l', 'xl']

const iconNamesOptions: IconNameOption[] = []
for (let iconName in IconNames) {
  // Hacking TypeScript: https://stackoverflow.com/a/51281023/2311247
  const typedIconName: IconNames = IconNames[iconName as keyof typeof IconNames]
  iconNamesOptions.push({
    label: typedIconName,
    value: typedIconName
  })
}

type IconDemoState = {
  demoSize: IconSize
  demoName: IconNameOption
}

type IconNameOption = {
  value: IconNames,
  label: IconNames
}

const defaultIcon: IconNameOption = {
  label: IconNames.trash,
  value: IconNames.trash
}

export default class DesignSystemRoute extends React.Component<{}, IconDemoState> {
  constructor(props: {}) {
    super(props)
    this.state = {
      demoSize: 'l',
      demoName: defaultIcon,
    }
  }

  onSizeChange({}: any, newSize: IconSize) {
    this.setState({demoSize: newSize})
  }

  onNameChange(newName: IconNameOption | null) {
    this.setState({demoName: newName ? newName : defaultIcon})
  }

  render() {
    return (
      <section>
        <h1><code>&lt;Icon&gt;</code> component</h1>

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
                        title='size'
                        name='size'
                        selected={this.state.demoSize}
                        options={iconSizes.map(
                          (type: IconSize) => {return {value: type, label: type}}
                        )}
                        onChange={this.onSizeChange.bind(this)}
                      />
                    </div>

                    <div className='demo__form-config'>
                      <label htmlFor='icon-name'>name</label>
                      <Select
                        inputId='icon-name'
                        value={this.state.demoName}
                        isClearable={false}
                        options={iconNamesOptions}
                        onChange={this.onNameChange.bind(this)}
                      />
                    </div>
                  </div>
                </form>
              </bem.SimpleTable__cell>
              <bem.SimpleTable__cell>
                <div className='demo__preview'>
                  <Icon
                    size={this.state.demoSize}
                    name={this.state.demoName?.value}
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
