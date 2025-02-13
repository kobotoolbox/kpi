import {Button as ButtonMantine, createPolymorphicComponent, Tooltip} from '@mantine/core';
import type {ButtonProps as ButtonPropsMantine, TooltipProps} from '@mantine/core/lib/components';
import {forwardRef} from 'react';

// See boilerpate at: https://mantine.dev/guides/polymorphic/#wrapping-polymorphic-components

export interface ButtonProps extends ButtonPropsMantine {
  tooltip?: React.ReactNode;
  tooltipProps?: Partial<Omit<TooltipProps, 'label'>>;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({tooltip, tooltipProps, ...others}, ref) => {
  if (!tooltip) {
    return (
      <ButtonMantine {...others} ref={ref} />
    );
  }

  return (
    <Tooltip label={tooltip} {...tooltipProps}>
      <ButtonMantine {...others} ref={ref} />
    </Tooltip>
  );
});
Button.displayName = 'Button';

export default createPolymorphicComponent<'button', ButtonProps>(Button);
