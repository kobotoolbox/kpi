import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import Checkbox from 'js/components/common/checkbox';
import './multiCheckbox.scss';

/**
 * @namespace MultiCheckboxItem
 * @prop {boolean} checked
 * @prop {boolean} disabled
 * @prop {string} label
 * @prop … any other properties will be passed back with onChange
 */

/**
 * A MultiCheckbox generic component.
 *
 * @prop {MultiCheckboxItem[]} items
 * @prop {function} onChange - returns whole list whenever any item changes
 */
class MultiCheckbox extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
  }

  onChange(itemIndex, isChecked) {
    let updatedList = this.props.items;
    updatedList[itemIndex].checked = isChecked;
    this.props.onChange(updatedList);
  }

  render() {
    return (
      <bem.MultiCheckbox>
        {this.props.items.map((item, itemIndex) => {
          return (
            <bem.MultiCheckbox__item key={itemIndex}>
              <Checkbox
                checked={item.checked}
                disabled={item.disabled}
                onChange={this.onChange.bind(this, itemIndex)}
                label={item.label}
              />
            </bem.MultiCheckbox__item>
          );
        })}
      </bem.MultiCheckbox>
    );
  }
}

export default MultiCheckbox;
