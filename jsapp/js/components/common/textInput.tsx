import React, {useEffect, useState} from 'react';
import {
  TextInput as MantineTextInput,
  type TextInputProps,
} from '@mantine/core';
import Icon from './icon';

interface CustomTextInputProps extends Omit<TextInputProps, 'onChange'> {
  onChange?: (newValue: string) => void;
  renderFocused?: boolean;
}

export const TextInput: React.FC<CustomTextInputProps> = (props) => {
  const {error, disabled, rightSection, ...rest} = props;
  const [value, setValue] = useState(props.value || '');
  const inputReference: React.MutableRefObject<null | HTMLInputElement> =
    React.createRef();

  useEffect(() => {
    if (props.renderFocused) {
      inputReference.current?.focus();
    }
  }, []);

  const onValueChange = (newValue: string) => {
    if (props.readOnly || !props.onChange) {
      return;
    }
    props.onChange(newValue);
  };

  return (
    <MantineTextInput
      {...rest}
      value={value}
      onInput={(evt: React.ChangeEvent<HTMLInputElement>) => {
        onValueChange(evt.currentTarget.value);
      }}
      onChange={() => false}
      ref={inputReference}
      error={error}
      disabled={disabled}
      rightSection={
        error ? <Icon name='alert' color='mid-red' /> : rightSection
      }
      styles={(theme) => {
        return {
          input: {
            borderColor: disabled
              ? theme.colors.gray[2]
              : error
                ? theme.colors.red[7]
                : theme.colors.gray[6],
            color: disabled ? theme.colors.gray[2] : theme.colors.gray[1],
          },
        };
      }}
    />
  );
};
