import React from 'react';
import autoBind from 'react-autobind';
import Checkbox from 'js/components/common/checkbox';

/**
 * @namespace MultiCheckboxItem
 * @prop {boolean} checked
 * @prop {boolean} disabled
 * @prop {string} label
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
      <ul className='multi-checkbox multi-checkbox__list'>
        {this.props.items.map((item, itemIndex) => {
          return (
            <li className='multi-checkbox__list-item' key={itemIndex}>
              <Checkbox
                checked={item.checked}
                disabled={item.disabled}
                onChange={this.onChange.bind(this, itemIndex)}
                label={item.label}
              />
            </li>
          );
        })}
      </ul>
    );
  }
}

export default MultiCheckbox;
