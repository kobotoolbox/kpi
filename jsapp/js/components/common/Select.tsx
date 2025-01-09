import type {SelectProps, ComboboxItem} from '@mantine/core';
import {Box, CloseButton, Select as MantineSelect} from '@mantine/core';
import Icon from './icon';
import {useState} from 'react';

declare module '@mantine/core/lib/components/Select' {
  /** @deprecated use Kobo implementation instead. (deprecating a new interface because can't augment variables) */
  export interface Select {}
}

export const Select = (props: SelectProps) => {
  const [value, setValue] = useState<string | null>(props.value || null);
  const [isOpened, setIsOpened] = useState(
    props.defaultDropdownOpened || false
  );

  const onChange = (newValue: string | null, option: ComboboxItem) => {
    setValue(newValue);
    props.onChange?.(newValue, option);
  };

  const clear = () => {
    setValue(null);
    props.onClear?.();
  };

  const clearButton =
    props.clearable && value && !props.disabled && !props.readOnly ? (
      <CloseButton size={props.size} variant='transparent' onClick={clear} />
    ) : null;

  return (
    <MantineSelect
      {...props}
      value={value}
      onChange={onChange}
      onDropdownOpen={() => setIsOpened(true)}
      onDropdownClose={() => setIsOpened(false)}
      rightSection={
        <>
          {clearButton}
          <Box pr='xs'>
            <Icon name={isOpened ? 'caret-up' : 'caret-down'} size='xxs' />
          </Box>
        </>
      }
    />
  );
};
