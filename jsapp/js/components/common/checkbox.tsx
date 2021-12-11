import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import './checkbox-and-radio.scss';

type CheckboxProps = {
  checked: boolean
  disabled?: boolean
  onChange: Function
  label: string
  /** Only needed if checkbox is in submittable form. */
  name?: string
};

/** A checkbox generic component. */
class Checkbox extends React.Component<CheckboxProps, {}> {
  constructor(props: CheckboxProps){
    if (typeof props.onChange !== 'function') {
      throw new Error('onChange callback missing!');
    }
    super(props);
    autoBind(this);
  }

  onChange(evt: React.ChangeEvent<HTMLInputElement>) {
    this.props.onChange(evt.currentTarget.checked);
  }

  render() {
    const wrapperModifiers = [];
    if (this.props.disabled) {
      // needed to disable pointer cursor
      wrapperModifiers.push('disabled');
    }

    return (
      <bem.Checkbox m={wrapperModifiers}>
        {/*
          * The wrapper element is `<label>` to make everything inside of it
          * clickable, so we don't need `id`s.
          */}
        <bem.Checkbox__wrapper>
          <bem.Checkbox__input
            type='checkbox'
            name={this.props.name}
            onChange={this.onChange}
            checked={this.props.checked}
            disabled={this.props.disabled}
          />

          {this.props.label &&
            <bem.Checkbox__label>
              {this.props.label}
            </bem.Checkbox__label>
          }
        </bem.Checkbox__wrapper>
      </bem.Checkbox>
    );
  }
}

export default Checkbox;
