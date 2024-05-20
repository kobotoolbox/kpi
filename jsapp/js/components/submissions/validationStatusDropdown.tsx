import React from 'react';
import bem from 'js/bem';
import Select, {components, OptionProps, SingleValueProps, DropdownIndicatorProps} from 'react-select';
import {VALIDATION_STATUSES_LIST} from 'js/constants';
import type {ValidationStatusName} from 'js/constants';
import './validationStatusDropdown.scss';

export interface ValidationStatusOption {
  value: ValidationStatusName | '' | null;
  label: string;
}

export const SHOW_ALL_OPTION: ValidationStatusOption = Object.freeze({
  value: '',
  label: t('Show All'),
});

interface ValidationStatusDropdownProps {
  onChange: (newValue: ValidationStatusOption['value']) => void;
  currentValue: ValidationStatusOption;
  isDisabled?: boolean;
  /** For gray background, includes additional option */
  isForHeaderFilter?: boolean;
}

function ValidationStatusDropdown(props: ValidationStatusDropdownProps) {
  // for rendering options as colorful badges
  function CustomOption(innerProps: OptionProps<ValidationStatusOption>) {
    const badgeModifiers = [String(innerProps.getValue())];
    if (innerProps.isSelected) {
      badgeModifiers.push('selected');
    }

    return (
      <bem.KoboSelect__optionWrapper>
        <bem.KoboSelect__optionBadge m={badgeModifiers}>
          <components.Option {...innerProps} />
        </bem.KoboSelect__optionBadge>
      </bem.KoboSelect__optionWrapper>
    );
  }

  // for rendering the selected value as colorful badge
  function CustomSingleValue({ children, ...innerProps }: SingleValueProps<ValidationStatusOption>) {
    let value;
    const valueArray = innerProps.getValue();
    if (valueArray && valueArray[0]) {
      value = valueArray[0].value;
    }

    const badgeModifiers = [String(value)];

    return (
      <bem.KoboSelect__optionBadge m={badgeModifiers}>
        {children}
      </bem.KoboSelect__optionBadge>
    );
  }

  // for rendering the selected value as colorful badge
  function CustomDropdownIndicator(innerProps: DropdownIndicatorProps<ValidationStatusOption>) {
    return (
    <components.DropdownIndicator {...innerProps}>
      <i className='k-icon k-icon-caret-down'/>
    </components.DropdownIndicator>
    );
  }

  // clone the original list array
  const optionsArray: Array<{value: ValidationStatusName | '' | null; label: string}> = [...VALIDATION_STATUSES_LIST];
  if (props.isForHeaderFilter) {
    optionsArray.unshift(SHOW_ALL_OPTION);
  }

  const selectClassNames = [
    'kobo-select',
    'kobo-select--validation',
  ];

  if (props.isForHeaderFilter) {
    selectClassNames.push('kobo-select--for-nonwhite-background');
  }

  return (
    <Select
      components={{
        Option: CustomOption,
        SingleValue: CustomSingleValue,
        DropdownIndicator: CustomDropdownIndicator,
      }}
      isDisabled={props.isDisabled}
      isClearable={false}
      isSearchable={false}
      value={props.currentValue}
      options={optionsArray}
      onChange={(newValue) => {
        if (newValue !== null && 'value' in newValue) {
          props.onChange(newValue.value);
        } else {
          props.onChange(null);
        }
      }}
      className={selectClassNames.join(' ')}
      classNamePrefix='kobo-select'
      menuPlacement='auto'
    />
  );
}

export default ValidationStatusDropdown;
