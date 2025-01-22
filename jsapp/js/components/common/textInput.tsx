import React, {forwardRef} from 'react';
import {
  TextInput as TextInputMantine,
  type TextInputProps as TextInputPropsMantine,
} from '@mantine/core';
import Icon from './icon';
import {IconName} from 'jsapp/fonts/k-icons';

export interface TextInputProps
  extends Omit<TextInputPropsMantine, 'leftSection' | 'size' | 'rightSection'> {
  leftIconName: IconName;
  rightIconName: IconName;
  size: 'sm' | 'md' | 'lg';
}

// TODO: Find a way to move icon handling to the base Input component
// so we don't need to repeat this code for other input types
const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({leftIconName, rightIconName, ...others}, ref) => {
    const leftSection = leftIconName ? (
      <Icon name={leftIconName} size='s' />
    ) : null;
    const rightSection = others.error ? (
      <Icon name='alert' size='s' />
    ) : rightIconName ? (
      <Icon name={leftIconName} size='s' />
    ) : null;
    return (
      <TextInputMantine
        {...others}
        ref={ref}
        error={others.error}
        leftSection={leftSection}
        rightSection={rightSection}
      />
    );
  }
);

export default TextInput;
