import React from 'react';
import bem from 'js/bem';
import clonedeep from 'lodash.clonedeep';
import type {
  MultiCheckboxType,
  MultiCheckboxItem,
} from 'js/components/common/multiCheckbox';
import MultiCheckbox from 'js/components/common/multiCheckbox';
import Checkbox from 'js/components/common/checkbox';
import Button from 'js/components/common/button';
import KoboSelect from 'js/components/common/koboSelect';

interface MultiCheckboxDemoState {
  demoItems: MultiCheckboxItem[];
  demoIsDisabled: boolean;
  demoType: MultiCheckboxType;
}

const RANDOM_LABELS = [
  'I suspect my neighbour is a reptilian',
  'I do not suspect my neighbour is not a legendary living fossil',
  "I don't accept any terms.",
  'I have read the terms',
  'I confirm I am not lying about the above',
  'Please take all my sensitive data',
  'I am a human being',
  'I am not a human',
  'This is fun',
  'I hereby authorize this design system to everything',
  "No, I don't want your newsletter",
  'Is this it?',
  'Foo bar fum baz',
];

export default class MultiCheckboxDemo extends React.Component<{}, MultiCheckboxDemoState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      demoItems: [
        this.getRandomItem(),
        this.getRandomItem(),
        this.getRandomItem(),
      ],
      demoIsDisabled: false,
      demoType: 'bare',
    };
  }

  onIsDisabledChange(isChecked: boolean) {
    this.setState({demoIsDisabled: isChecked});
  }

  getRandomItem() {
    return {
      label: RANDOM_LABELS[Math.floor(Math.random() * RANDOM_LABELS.length)],
      checked: false,
    };
  }

  onAddRandomItem() {
    const newItems = clonedeep(this.state.demoItems);
    newItems.push(this.getRandomItem());
    this.onItemsChange(newItems);
  }

  onRemoveLastItem() {
    const newItems = clonedeep(this.state.demoItems);
    newItems.pop();
    this.onItemsChange(newItems);
  }

  onItemsChange(newItems: MultiCheckboxItem[]) {
    this.setState({demoItems: newItems});
  }

  onTypeChange(newType: string | null) {
    const newTypeCasted = newType as MultiCheckboxType;
    this.setState({demoType: newTypeCasted || 'bare'});
  }

  onCheckAll() {
    const newItems = clonedeep(this.state.demoItems);
    newItems.forEach((item) => item.checked = true);
    this.onItemsChange(newItems);
  }

  onUncheckAll() {
    const newItems = clonedeep(this.state.demoItems);
    newItems.forEach((item) => item.checked = false);
    this.onItemsChange(newItems);
  }

  render() {
    return (
      <section>
        <h1><code>&lt;MultiCheckbox&gt;</code> component</h1>

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
                      <Button
                        type='frame'
                        color='storm'
                        size='s'
                        label='check all'
                        onClick={this.onCheckAll.bind(this)}
                      />
                    </div>

                    <div className='demo__form-config'>
                      <Button
                        type='frame'
                        color='storm'
                        size='s'
                        label='uncheck all'
                        onClick={this.onUncheckAll.bind(this)}
                      />
                    </div>
                  </div>

                  <div className='demo__form-row'>
                    <div className='demo__form-config'>
                      <Button
                        type='frame'
                        color='storm'
                        size='s'
                        startIcon='plus'
                        label='add random item'
                        onClick={this.onAddRandomItem.bind(this)}
                      />
                    </div>

                    <div className='demo__form-config'>
                      <Button
                        type='frame'
                        color='storm'
                        size='s'
                        startIcon='minus'
                        label='remove last item'
                        onClick={this.onRemoveLastItem.bind(this)}
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
                      <label>Type:</label>

                      <KoboSelect
                        name='MultiCheckbox_type_demo'
                        type='gray'
                        size='s'
                        options={[
                          {label: 'bare', id: 'bare'},
                          {label: 'frame', id: 'frame'},
                        ]}
                        selectedOption={this.state.demoType}
                        onChange={this.onTypeChange.bind(this)}
                      />
                    </div>
                  </div>
                </form>
              </bem.SimpleTable__cell>
              <bem.SimpleTable__cell m='align-top'>
                <div className='demo__preview'>
                  <MultiCheckbox
                    type={this.state.demoType}
                    items={this.state.demoItems}
                    onChange={this.onItemsChange.bind(this)}
                    disabled={this.state.demoIsDisabled}
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
