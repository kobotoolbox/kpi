import {TextInput} from '@mantine/core';

interface SimpleTextInputProps {
  label?: string;
  description?: string;
  placeholder?: string;
}

export function SimpleTextInput(props: SimpleTextInputProps) {
  return (
    <TextInput
      label={props.label}
      description={props.description}
      placeholder={props.placeholder}
    />
  );
}
