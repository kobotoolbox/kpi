import React from 'react';
import autoBind from 'react-autobind';
import {bem} from 'js/bem';

/**
 * A generic dropdown component that accepts any content inside. If you need a
 * selector dropdown, please look elsewhere.
 *
 * @prop {boolean} opened
 * @prop {function} onClose
 * @prop {node} trigger
 * @prop {function} content
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
