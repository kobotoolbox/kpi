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

  onChange(response) {
    let updatedList = this.props.items;
    updatedList[response].checked = !updatedList[response].checked;
    this.props.onChange(updatedList);
  }

  render() {
    return (
      <div className='project-downloads__column project-downloads__column--right'>
        <span className='project-downloads__title'>
          {this.props.label}
        </span>
        <ul className='project-downloads__questions-list'>
          {this.props.items.map((item, n) => {
            return (
              <li key={n}>
                <Checkbox
                  disabled={item.disabled || false}
                  checked={item.checked || false}
                  onChange={this.onChange.bind(this, n)}
                  label={item.label}
                />
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
}

export default MultiCheckbox;
