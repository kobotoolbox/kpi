import React from 'react';

export type TooltipAlignment = 'right' | 'left' | 'center';

export interface TooltipProps {
  /** Content of the tooltip */
  text: string;
  /** Accessible label for screen readers */
  ariaLabel: string;
  /** Position of the tooltip (centered as default) */
  alignment?: TooltipAlignment;
  children?: React.ReactNode;
}

/**
 * Tooltip component that is necessary for managing dynamic content and
 * accessibility features, such as readability. While we have the tooltip.scss
 * component, that provides styling but not other functionaltiy such as
 * allowing tooltips to work on disabled buttons.
 */
const Tooltip: React.FC<TooltipProps> = ({
  text,
  ariaLabel,
  alignment,
  children,
}) => (
  <span
    data-tip={text}
    className={`${alignment || 'center'}-tooltip`}
    aria-label={ariaLabel}
  >
    {children}
  </span>
);
export default Tooltip;
