import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import Select, {components} from 'react-select';
import {VALIDATION_STATUSES_LIST} from 'js/constants';
import './validationStatusDropdown.scss';

export const SHOW_ALL_OPTION = Object.freeze({
  value: '',
  label: t('Show All'),
});

/**
 * @prop onChange
 * @prop isDisabled
 * @prop currentValue
 * @prop isForHeaderFilter - for gray background, includes additional option
 */
class ValidationStatusDropdown extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
  }

  render() {
    // for rendering options as colorful badges
    const CustomOption = (props) => {
      const badgeModifiers = [props.value];
      if (props.isSelected) {
        badgeModifiers.push('selected');
      }

      return (
        <bem.KoboSelect__optionWrapper>
          <bem.KoboSelect__optionBadge m={badgeModifiers}>
            <components.Option {...props} />
          </bem.KoboSelect__optionBadge>
        </bem.KoboSelect__optionWrapper>
      );
    };

    // for rendering the selected value as colorful badge
    const CustomSingleValue = ({ children, ...props }) => {
      let value;
      const valueArray = props.getValue();
      if (valueArray && valueArray[0]) {
        value = valueArray[0].value;
      }

      const badgeModifiers = [value];

      return (
        <bem.KoboSelect__optionBadge m={badgeModifiers}>
          {children}
        </bem.KoboSelect__optionBadge>
      );
    };

    // for rendering the selected value as colorful badge
    const CustomDropdownIndicator = (props) => (
      <components.DropdownIndicator {...props}>
        <i className='k-icon k-icon-caret-down'/>
      </components.DropdownIndicator>
    );

    // clone the array
    const optionsArray = [...VALIDATION_STATUSES_LIST];
    if (this.props.isForHeaderFilter) {
      optionsArray.unshift(SHOW_ALL_OPTION);
    }

    const selectClassNames = [
      'kobo-select',
      'kobo-select--validation',
    ];

    if (this.props.isForHeaderFilter) {
      selectClassNames.push('kobo-select--for-nonwhite-background');
    }

    return (
      <Select
        components={{
          Option: CustomOption,
          SingleValue: CustomSingleValue,
          DropdownIndicator: CustomDropdownIndicator,
        }}
        isDisabled={this.props.isDisabled}
        isClearable={false}
        isSearchable={false}
        value={this.props.currentValue}
        options={optionsArray}
        onChange={this.props.onChange}
        className={selectClassNames.join(' ')}
        classNamePrefix='kobo-select'
        menuPlacement='auto'
      />
    );
  }
}

export default ValidationStatusDropdown;
