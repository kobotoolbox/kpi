import React from 'react';
import bem, {makeBem} from 'js/bem';
import Checkbox from 'js/components/common/checkbox';
import './multiCheckbox.scss';

bem.MultiCheckbox = makeBem(null, 'multi-checkbox', 'ul');
bem.MultiCheckbox__item = makeBem(bem.MultiCheckbox, 'item', 'li');

export type MultiCheckboxType = 'bare' | 'frame';

export interface MultiCheckboxItem {
  /** any other properties will be passed back with onChange */
  [propName: string]: any;
  checked: boolean;
  disabled?: boolean;
  label: string;
}

interface MultiCheckboxProps {
  /** Influences how the component looks. */
  type: MultiCheckboxType;
  items: MultiCheckboxItem[];
  /** Use this to disable all checkboxes - useful for blocking changes while loading. */
  disabled?: boolean;
  /** Returns whole list whenever any item changes */
  onChange: (items: MultiCheckboxItem[]) => void;
}

/**
 * A MultiCheckbox generic component.
 * Use optional `bem.MultiCheckbox__wrapper` to display a frame around it.
 */
class MultiCheckbox extends React.Component<MultiCheckboxProps> {
  onChange(itemIndex: number, isChecked: boolean) {
    const updatedList = this.props.items;
    updatedList[itemIndex].checked = isChecked;
    this.props.onChange(updatedList);
  }

  render() {
    return (
      <bem.MultiCheckbox m={`type-${this.props.type}`}>
        {this.props.items.map((item, itemIndex) => (
          <bem.MultiCheckbox__item key={itemIndex}>
            <Checkbox
              checked={item.checked}
              disabled={this.props.disabled || item.disabled}
              onChange={this.onChange.bind(this, itemIndex)}
              label={item.label}
            />
          </bem.MultiCheckbox__item>
        ))}
      </bem.MultiCheckbox>
    );
  }
}

export default MultiCheckbox;
