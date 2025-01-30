import React from 'react';
import autoBind from 'react-autobind';
import bem, {makeBem} from 'js/bem';
import './checkbox.scss';

bem.Checkbox = makeBem(null, 'checkbox');
bem.Checkbox__wrapper = makeBem(bem.Checkbox, 'wrapper', 'label');
bem.Checkbox__input = makeBem(bem.Checkbox, 'input', 'input');
bem.Checkbox__label = makeBem(bem.Checkbox, 'label', 'span');

interface CheckboxProps {
  checked: boolean;
  disabled?: boolean;
  /** `onChange` handler is obligatory, unless `onClick` is being provided */
  onChange?: (isChecked: boolean) => void;
  /**
   * Useful if you need to hijack the event, e.g. checkbox parent is clickable
   * and clicking the checkbox shouldn't cause that parent click - we can use
   * `evt.stopPropagation()` and be happy.
   */
  onClick?: (evt: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => void;
  label?: React.ReactNode;
  /** Only needed if checkbox is in submittable form. */
  name?: string;
  'data-cy'?: string;
}

/** A checkbox generic component. */
class Checkbox extends React.Component<CheckboxProps, {}> {
  constructor(props: CheckboxProps) {
    if (typeof props.onChange !== 'function') {
      throw new Error('onChange callback missing!');
    }
    super(props);
    autoBind(this);
  }

  onChange(evt: React.ChangeEvent<HTMLInputElement>) {
    if (this.props.onChange) {
      this.props.onChange(evt.currentTarget.checked);
    }
  }

  onClick(evt: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) {
    if (this.props.onClick) {
      this.props.onClick(evt);
    }
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
            onClick={this.onClick}
            checked={this.props.checked}
            disabled={this.props.disabled}
            data-cy={this.props['data-cy']}
          />

          {this.props.label && (
            <bem.Checkbox__label>{this.props.label}</bem.Checkbox__label>
          )}
        </bem.Checkbox__wrapper>
      </bem.Checkbox>
    );
  }
}

export default Checkbox;
