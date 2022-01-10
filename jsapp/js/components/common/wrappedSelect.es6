import React from 'react';
import Select from 'react-select';

// a quick way to display validation errors on react-select dropdowns
// largely cribbed from components/dataAttachments/connectProjects.es6
//TODO: Use BEM elements instead
class WrappedSelect extends Select {
  render() {
    const selectClassNames = ['kobo-select__wrapper'];
    if (this.props.error) {
      selectClassNames.push('kobo-select__wrapper--error');
    }
    return(
      <div className={selectClassNames.join(' ')}>
        <label>
          {this.props.label}
          {super.render()}
        </label>
        <label className='select-errors'>
          {this.props.error}
        </label>
      </div>
    );
  }
}

export default WrappedSelect;
