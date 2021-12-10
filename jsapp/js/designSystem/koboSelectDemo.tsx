import React from 'react'
import bem from 'js/bem';
import KoboSelect from 'js/components/common/koboSelect'

export default class KoboDropdownDemo extends React.Component<{}, {}> {
  constructor(props: {}) {
    super(props)
  }

  onChange(id: string | null) {
    console.log('id', id)
  }

  render() {
    return (
      <section>
        <h1><code>&lt;KoboSelect&gt;</code> component</h1>

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
                TBD
              </bem.SimpleTable__cell>
              <bem.SimpleTable__cell>
                <div className='demo__preview'>
                  <KoboSelect
                    type='blue'
                    size='s'
                    isClearable={false}
                    isSearchable={false}
                    isDisabled={false}
                    isPending={false}
                    isFullWidth={false}
                    options={[
                      {
                        id: 'one',
                        label: 'One',
                        icon: 'alert'
                      },
                      {
                        id: 'two',
                        label: 'Two',
                        icon: 'information'
                      }
                    ]}
                    selectedOption='two'
                    onChange={this.onChange.bind(this)}
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
