import React from 'react';
import autoBind from 'react-autobind';
import {bem} from 'js/bem';

/**
 * A generic dropdown component that accepts any content inside. If you need a
 * selector dropdown, please look at `react-select`.
 *
 * @prop {boolean} opened
 * @prop {function} onClose
 *
 * @prop {boolean} [closeOnMenuClick] `false` by default - closes menu whenever user clicks inside it, useful for simple menu with a list of actions
 * @prop {boolean} [closeOnBlur] `false` by default - closes menu when it loses focus (e.g. user clicked outside)
 * @prop {boolean} [closeOnMouseLeave] `false` by default
 * @prop {boolean} [closeOnEsc] `false` by default
 * @prop {node} trigger
 * @prop {function} content the content of dropdown, anything's allowed
 */
class KoboDropdown extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
  }

  onClose(evt) {
    this.props.onClose(evt);
  }

  render() {
    return (
      <bem.KoboDropdown>
        <bem.KoboDropdown__wrapper>
          <bem.KoboDropdown__input
            type='checkbox'
            name={this.props.name}
            id={this.props.id}
            onChange={this.onChange}
            checked={this.props.checked}
            disabled={this.props.disabled}
          />

          {this.props.label &&
            <bem.KoboDropdown__label htmlFor={this.props.id}>
              {this.props.label}
            </bem.KoboDropdown__label>
          }
        </bem.KoboDropdown__wrapper>
      </bem.KoboDropdown>
    );
  }
}

export default KoboDropdown;
