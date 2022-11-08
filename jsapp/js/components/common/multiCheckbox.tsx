import React from 'react';
import bem from 'js/bem';
import Checkbox from 'js/components/common/checkbox';
import './multiCheckbox.scss';

export interface MultiCheckboxItem {
  /** any other properties will be passed back with onChange */
  [propName: string]: any;
  checked: boolean;
  disabled?: boolean;
  label: string;
}

interface MultiCheckboxProps {
  items: MultiCheckboxItem[];
  /** Returns whole list whenever any item changes */
  onChange: (items: MultiCheckboxItem[]) => void;
}

/** A MultiCheckbox generic component. */
class MultiCheckbox extends React.Component<MultiCheckboxProps> {
  onChange(itemIndex: number, isChecked: boolean) {
    const updatedList = this.props.items;
    updatedList[itemIndex].checked = isChecked;
    this.props.onChange(updatedList);
  }

  render() {
    return (
      <bem.MultiCheckbox>
        {this.props.items.map((item, itemIndex) => (
          <bem.MultiCheckbox__item key={itemIndex}>
            <Checkbox
              checked={item.checked}
              disabled={item.disabled}
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
