import React from 'react';

interface TooltipProps {
  text?: string;
  ariaLabel?: string;
  className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({
  text,
  ariaLabel,
  className,
  children,
}) => (
  <span
    data-tip={text}
    className={className + '-tooltip'}
    aria-label={ariaLabel}
  >
    {children}
  </span>
);
export default Tooltip;
