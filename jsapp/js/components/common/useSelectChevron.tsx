import { useMemo, useState } from 'react'

import type { IconSize } from './icon'
import Icon from './icon'

// Chevrons track the input's font size rather than its height, so they stay in
// proportion with the label text next to them.
const iconSizeMap: Record<string, IconSize> = {
  xs: 'xxs',
  sm: 'xs',
  md: 'xs',
  lg: 's',
  xl: 'm',
}

interface UseSelectChevronParams {
  size?: unknown
  rightSection?: React.ReactNode
  rightSectionWidth?: number | string
  defaultDropdownOpened?: boolean
}

/**
 * Shared right-section behavior for `Select` and `MultiSelect` wrappers.
 *
 * This hook centralizes chevron rendering and dropdown-open state so both
 * controls present the same icon behavior (angle-up while open, angle-down
 * while closed) when callers do not provide a custom `rightSection`.
 *
 * It also enforces a stable default `rightSectionWidth` to prevent horizontal
 * jitter when clear and chevron controls appear/disappear.
 */
export const useSelectChevron = ({
  size,
  rightSection,
  rightSectionWidth,
  defaultDropdownOpened,
}: UseSelectChevronParams) => {
  // Keep local opened state so fallback chevron can reflect dropdown visibility.
  const [isOpened, setIsOpened] = useState(defaultDropdownOpened || false)

  const iconSize = typeof size === 'string' ? iconSizeMap[size] : iconSizeMap.md
  // Respect caller-provided right section. If omitted, render Kobo chevron.
  const resolvedRightSection = useMemo(() => {
    if (rightSection) {
      return rightSection
    }

    return <Icon name={isOpened ? 'angle-up' : 'angle-down'} size={iconSize} />
  }, [iconSize, isOpened, rightSection])

  return {
    rightSection: resolvedRightSection,
    // Stable default width prevents clear/chevron horizontal jitter between states.
    rightSectionWidth: rightSectionWidth ?? 44,
    onDropdownOpen: () => setIsOpened(true),
    onDropdownClose: () => setIsOpened(false),
  }
}
