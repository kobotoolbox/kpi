import React from 'react'
import bem from 'js/bem';
import KoboDropdown, {KoboDropdownPlacements} from 'js/components/common/koboDropdown'
import Checkbox from 'js/components/common/checkbox'
import Radio from 'js/components/common/radio'

type KoboDropdownDemoState = {
  demoPlacement: KoboDropdownPlacements
  demoIsDisabled: boolean
  demoHideOnMenu: boolean
}

interface Option {
  value: string
  label: string
}

const placementsOptions: Option[] = []
for (let theme in KoboDropdownPlacements) {
  // Hacking TypeScript: https://stackoverflow.com/a/51281023/2311247
  const typedTheme: KoboDropdownPlacements = KoboDropdownPlacements[theme as keyof typeof KoboDropdownPlacements]
  placementsOptions.push({
    label: typedTheme,
    value: typedTheme
  })
}

export default class KoboDropdownDemo extends React.Component<{}, KoboDropdownDemoState> {
  constructor(props: {}) {
    super(props)
    this.state = {
      demoPlacement: KoboDropdownPlacements['down-center'],
      demoIsDisabled: false,
      demoHideOnMenu: true,
    }
  }

  onPlacementChange({}: any, newPlacement: KoboDropdownPlacements) {
    this.setState({demoPlacement: newPlacement})
  }

  onIsDisabledChange(isChecked: boolean) {
    this.setState({demoIsDisabled: isChecked})
  }

  onHideOnMenuClickChange(isChecked: boolean) {
    this.setState({demoHideOnMenu: isChecked})
  }

  render() {
    return (
      <section>
        <h1><code>&lt;KoboDropdown&gt;</code> component</h1>

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
                        title='color'
                        name='color'
                        selected={this.state.demoPlacement}
                        options={placementsOptions}
                        onChange={this.onPlacementChange.bind(this)}
                      />
                    </div>
                  </div>

                  <div className='demo__form-row'>
                    <div className='demo__form-config'>
                      <Checkbox
                        label='is disabled'
                        onChange={this.onIsDisabledChange.bind(this)}
                        checked={this.state.demoIsDisabled}
                      />
                    </div>

                    <div className='demo__form-config'>
                      <Checkbox
                        label='hide on inside menu click'
                        onChange={this.onHideOnMenuClickChange.bind(this)}
                        checked={this.state.demoHideOnMenu}
                      />
                    </div>
                  </div>
                </form>
              </bem.SimpleTable__cell>
              <bem.SimpleTable__cell>
                <div className='demo__preview'>
                  <KoboDropdown
                    name='kobo-dropdown-demo'
                    placement={this.state.demoPlacement}
                    isDisabled={this.state.demoIsDisabled}
                    hideOnMenuClick={this.state.demoHideOnMenu}
                    triggerContent='click me'
                    menuContent={(
                      <ol>
                        <li>Some menu</li>
                        <li>Content is</li>
                        <li>Here, and</li>
                        <li>Says "hi"</li>
                      </ol>
                    )}
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
