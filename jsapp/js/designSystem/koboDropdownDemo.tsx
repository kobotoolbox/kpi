import React from 'react'
import bem from 'js/bem';
import KoboDropdown, {KoboDropdownThemes, KoboDropdownPlacements} from 'js/components/common/koboDropdown'
import Checkbox from 'js/components/common/checkbox'
import Radio from 'js/components/common/radio'

type KoboDropdownDemoState = {
  currentTheme: KoboDropdownThemes
  currentPlacement: KoboDropdownPlacements
  isDisabled: boolean
  hideOnMenuClick: boolean
  hideOnMenuOutsideClick: boolean
  hideOnEsc: boolean
}

interface Option {
  value: string
  label: string
}

const themesOptions: Option[] = []
for (let theme in KoboDropdownThemes) {
  // Hacking TypeScript: https://stackoverflow.com/a/51281023/2311247
  const typedTheme: KoboDropdownThemes = KoboDropdownThemes[theme as keyof typeof KoboDropdownThemes]
  themesOptions.push({
    label: typedTheme,
    value: typedTheme
  })
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
      currentTheme: KoboDropdownThemes.dark,
      currentPlacement: KoboDropdownPlacements['down-center'],
      isDisabled: false,
      hideOnMenuClick: true,
      hideOnMenuOutsideClick: true,
      hideOnEsc: true
    }
  }

  onThemeChange({}: any, newTheme: KoboDropdownThemes) {
    this.setState({currentTheme: newTheme})
  }

  onPlacementChange({}: any, newPlacement: KoboDropdownPlacements) {
    this.setState({currentPlacement: newPlacement})
  }

  onIsDisabledChange(isChecked: boolean) {
    this.setState({isDisabled: isChecked})
  }

  onHideOnMenuClickChange(isChecked: boolean) {
    this.setState({hideOnMenuClick: isChecked})
  }

  onHideOnMenuOutsideClickChange(isChecked: boolean) {
    this.setState({hideOnMenuOutsideClick: isChecked})
  }

  onHideOnEscChange(isChecked: boolean) {
    this.setState({hideOnEsc: isChecked})
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
                        title='type'
                        name='type'
                        selected={this.state.currentTheme}
                        options={themesOptions}
                        onChange={this.onThemeChange.bind(this)}
                      />
                    </div>

                    <div className='demo__form-config'>
                      <Radio
                        title='color'
                        name='color'
                        selected={this.state.currentPlacement}
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
                        checked={this.state.isDisabled}
                      />
                    </div>

                    <div className='demo__form-config'>
                      <Checkbox
                        label='hide with ESC key'
                        onChange={this.onHideOnEscChange.bind(this)}
                        checked={this.state.hideOnEsc}
                      />
                    </div>
                  </div>

                  <div className='demo__form-row'>
                    <div className='demo__form-config'>
                      <Checkbox
                        label='hide on inside menu click'
                        onChange={this.onHideOnMenuClickChange.bind(this)}
                        checked={this.state.hideOnMenuClick}
                      />
                    </div>

                    <div className='demo__form-config'>
                      <Checkbox
                        label='hide on outside menu click'
                        onChange={this.onHideOnMenuOutsideClickChange.bind(this)}
                        checked={this.state.hideOnMenuOutsideClick}
                      />
                    </div>
                  </div>
                </form>
              </bem.SimpleTable__cell>
              <bem.SimpleTable__cell>
                <div className='demo__preview'>
                  <KoboDropdown
                    theme={this.state.currentTheme}
                    placement={this.state.currentPlacement}
                    isDisabled={this.state.isDisabled}
                    hideOnMenuClick={this.state.hideOnMenuClick}
                    hideOnMenuOutsideClick={this.state.hideOnMenuOutsideClick}
                    hideOnEsc={this.state.hideOnEsc}
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
