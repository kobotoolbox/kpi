import React from 'react';
import autoBind from 'react-autobind';
import bem, {makeBem} from 'js/bem';
import './radio.scss';

bem.Radio = makeBem(null, 'radio');
bem.Radio__row = makeBem(bem.Radio, 'row', 'label');
bem.Radio__input = makeBem(bem.Radio, 'input', 'input');
bem.Radio__label = makeBem(bem.Radio, 'label', 'span');

export interface RadioOption {
  label: string;
  value: string;
  /** Disables just this option. */
  isDisabled?: boolean;
}

interface RadioProps {
  options: RadioOption[];
  /** Displays a label/title on top of the radio options. */
  title?: string;
  /** Internal ID useful for the identification of radio. */
  name: string;
  onChange: (newSelectedValue: string, radioName: string) => void;
  /** The `value` of selected option. */
  selected: string;
  /** Disables whole radio component. */
  isDisabled?: boolean;
  /** This is `false` by default */
  isClearable?: boolean;
  'data-cy'?: string;
}

/** A radio input generic component. */
class Radio extends React.Component<RadioProps> {
  constructor(props: RadioProps){
    if (typeof props.onChange !== 'function') {
      throw new Error('onChange callback missing!');
    }
    super(props);
    autoBind(this);
  }

  onChange(evt: React.ChangeEvent<HTMLInputElement>) {
    this.props.onChange(evt.currentTarget.value, this.props.name);
  }

  onClick(evt: React.ChangeEvent<HTMLInputElement>) {
    // For clearable radio, we unselect checked option when clicked,
    // Note: we can't simply check `evt.currentTarget.checked`, because
    // the input toggles before `onClick` event occurs, so it is always checked
    if (
      this.props.isClearable &&
      this.props.selected === evt.currentTarget.value
    ) {
      this.props.onChange('', this.props.name);
    }
  }

  render() {
    return (
      <bem.Radio m={{'disabled': Boolean(this.props.isDisabled)}}>
        {this.props.title &&
          <bem.Radio__row m='title'>{this.props.title}</bem.Radio__row>
        }
        {this.props.options.map((option) => (
            <bem.Radio__row key={option.value}>
              <bem.Radio__input
                type='radio'
                value={option.value}
                name={this.props.name}
                onChange={this.onChange.bind(this)}
                onClick={this.onClick.bind(this)}
                checked={this.props.selected === option.value}
                disabled={this.props.isDisabled || option.isDisabled}
                data-cy={this.props['data-cy']}
              />

              <bem.Radio__label>
                {option.label}
              </bem.Radio__label>
            </bem.Radio__row>
          ))}
      </bem.Radio>
    );
  }
}

export default Radio;
