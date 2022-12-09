import React from 'react';
import bem from 'js/bem';
import TextBox from 'js/components/common/textBox';
import Radio from 'js/components/common/radio';
import Badge from 'js/components/common/badge';
import type {BadgeColor, BadgeSize} from 'js/components/common/badge';
import {IconNames} from 'jsapp/fonts/k-icons';
import KoboSelect from 'js/components/common/koboSelect';

const badgeColors: BadgeColor[] = ['cloud', 'light-amber', 'light-blue', 'light-teal'];
const badgeSizes: BadgeSize[] = ['s', 'm', 'l'];

const iconNamesOptions: IconNameOption[] = [];
for (let iconName in IconNames) {
  // Hacking TypeScript: https://stackoverflow.com/a/51281023/2311247
  const typedIconName: IconNames = IconNames[iconName as keyof typeof IconNames];
  iconNamesOptions.push({
    label: typedIconName,
    id: typedIconName,
  });
}

interface BadgeDemoState {
  demoColor: BadgeColor;
  demoSize: BadgeSize;
  demoIcon?: IconNames;
  demoLabel: string;
}

interface IconNameOption {
  id: IconNames;
  label: IconNames;
}

const defaultLabel = 'deployed';
const defaultIcon: IconNames = IconNames['project-deployed'];

export default class BadgeDemo extends React.Component<{}, BadgeDemoState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      demoColor: 'cloud',
      demoSize: 's',
      demoIcon: defaultIcon,
      demoLabel: defaultLabel,
    };
  }

  onColorChange(newColor: string) {
    const newColorCasted = newColor as BadgeColor;
    this.setState({demoColor: newColorCasted});
  }

  onSizeChange(newSize: string) {
    const newSizeCasted = newSize as BadgeSize;
    this.setState({demoSize: newSizeCasted});
  }

  onIconChange(newIcon: string | null) {
    const newIconCasted = newIcon as IconNames;
    this.setState({demoIcon: newIconCasted ? newIconCasted : undefined});
  }

  onLabelChange(newLabel: string) {
    this.setState({demoLabel: newLabel});
  }

  render() {
    return (
      <section>
        <h1><code>&lt;Badge&gt;</code> component</h1>

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
                        title='color'
                        name='color'
                        selected={this.state.demoColor}
                        options={badgeColors.map(
                          (type: BadgeColor) => ({value: type, label: type})
                        )}
                        onChange={this.onColorChange.bind(this)}
                      />
                    </div>

                    <div className='demo__form-config'>
                      <Radio
                        title='size'
                        name='size'
                        selected={this.state.demoSize}
                        options={badgeSizes.map(
                          (type: BadgeSize) => ({value: type, label: type})
                        )}
                        onChange={this.onSizeChange.bind(this)}
                      />
                    </div>
                  </div>

                  <div className='demo__form-row'>
                    <div className='demo__form-config'>
                      <label>icon</label>
                      <KoboSelect
                        name='badge_demo_icon'
                        type='outline'
                        size='s'
                        isClearable
                        isSearchable
                        options={iconNamesOptions}
                        selectedOption={this.state.demoIcon || null}
                        onChange={this.onIconChange.bind(this)}
                      />
                    </div>

                    <div className='demo__form-config'>
                      <TextBox
                        label='text'
                        customModifiers='on-white'
                        onChange={this.onLabelChange.bind(this)}
                        value={this.state.demoLabel}
                      />
                    </div>
                  </div>
                </form>
              </bem.SimpleTable__cell>
              <bem.SimpleTable__cell m='align-top'>
                <div className='demo__preview'>
                  <Badge
                    color={this.state.demoColor}
                    size={this.state.demoSize}
                    icon={this.state.demoIcon}
                    label={this.state.demoLabel}
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
