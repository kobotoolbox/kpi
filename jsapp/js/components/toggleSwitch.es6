/**
 * A toggle switch generic component. Operates same as checkbox, different look.
 *
 * Properties:
 * - checked <boolean>
 * - onChange <function>: required
 * - label <string>
 *
 * TODO: would be best to move it to `jsapp/js/components/generic` directory.
 */

import React from 'react';
import autoBind from 'react-autobind';
import {bem} from '../bem';

class ToggleSwitch extends React.Component {
  constructor(props){
    if (typeof props.onChange !== 'function') {
      throw new Error('onChange callback missing!');
    }
    super(props);
    autoBind(this);
  }

  onChange(evt) {
    this.props.onChange(evt.currentTarget.checked);
  }

  render() {
    return (
      <bem.Checkbox>
        <bem.Checkbox__wrapper>
          <label className="switch">
            <input type="checkbox"/>
            <span className="slider round"/>
          </label>
    
          {this.props.label &&
            <bem.Checkbox__label htmlFor={this.props.id}>
              {this.props.label}
            </bem.Checkbox__label>
          }
        </bem.Checkbox__wrapper>
      </bem.Checkbox>
    );
  }
}

export default ToggleSwitch;
