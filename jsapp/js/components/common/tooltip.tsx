import React from 'react';

interface TooltipProps {
  text?: string;
  position?: string;
  className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({
  text,
  position,
  className,
  children,
}) => {
  const tooltipClass = `tooltip ${position || ''} ${className || ''}`;

  return (
    <div data-tip={text} className={tooltipClass}>
      {children}
    </div>
  );
};

export default Tooltip;
