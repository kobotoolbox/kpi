import React from 'react';
import autoBind from 'react-autobind';
import bem from '../bem';

/*
Properties:
- value <boolean>
- onChange <function>: required
- label <string>
*/
class Checkbox extends React.Component {
  constructor(props){
    if (typeof props.onChange !== 'function') {
      throw new Error('onChange callback missing!')
    }
    super(props);
    this.state = {
      checked: props.checked
    }
    autoBind(this);
  }

  onChange(evt) {
    this.setState({checked: evt.currentTarget.checked});
    this.props.onChange(evt.currentTarget.checked);
  }

  render() {
    return (
      <bem.Checkbox>
        <bem.Checkbox__wrapper>
          <bem.Checkbox__input
            type='checkbox'
            name={this.props.name}
            id={this.props.id}
            onChange={this.onChange}
            checked={this.state.checked}
          />

          {this.props.label &&
            <bem.Checkbox__label htmlFor={this.props.id}>
              {this.props.label}
            </bem.Checkbox__label>
          }
        </bem.Checkbox__wrapper>
      </bem.Checkbox>
    )
  }
}

export default Checkbox;
