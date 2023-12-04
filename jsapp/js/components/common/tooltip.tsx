import React from 'react';

export interface TooltipProps {
  text: string;
  ariaLabel: string;
  alignment?: 'right' | 'left' | '';
}

/**
 * Tooltip component that is necessary for managing dynamic content and
 * accessibility features, such as readability. While we have the tooltip.scss
 * component, that provides styling but not other functionaltiy such as
 * allowing tooltips to work on disabled buttons.
 *
 * @param {string} text - Content of the tooltip.
 * @param {string} ariaLabel - Accessible label for screen readers.
 * @param {'right' | 'left' | ''} alignment - Position of the tooltip (centered
 * if undefined or set to an empty string).
 * @param {React.ReactNode} children - Button that triggers the tooltip when
 * hovered.
 */
const Tooltip: React.FC<TooltipProps> = ({
  text,
  ariaLabel,
  alignment,
  children,
}) => (
  <span
    data-tip={text}
    className={`${alignment}-tooltip`}
    aria-label={ariaLabel}
  >
    {children}
  </span>
);
export default Tooltip;
