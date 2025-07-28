# KoBoToolbox 2025 Color Theme Implementation Guide

## Overview

This guide outlines the complete strategy for implementing the 2025 design guidelines color theme across the KoBoToolbox KPI application. The implementation uses a phased approach to ensure minimal disruption while providing a modern, accessible, and maintainable color system.

## Current Architecture Analysis

### Existing Color Systems
1. **Legacy SCSS Variables** (`jsapp/scss/colors.scss`)
   - HSL-based color definitions
   - Direct usage throughout older components
   - Well-organized neutral scale and brand colors

2. **Mantine Theme System** (`jsapp/js/theme/kobo/index.ts`)
   - Modern React component theming
   - CSS custom properties support
   - Component-specific overrides

3. **CSS Modules** (`jsapp/js/theme/kobo/*.module.css`)
   - Scoped component styles
   - Use of CSS custom properties
   - Modern CSS practices

## Implementation Strategy

### Phase 1: Foundation Setup ✅
**Files Created:**
- `jsapp/scss/colors-2025.scss` - New color system foundation
- `jsapp/js/theme/kobo/theme-2025.ts` - Updated Mantine theme
- `jsapp/scss/mixins-2025.scss` - Utility mixins and classes

### Phase 2: Color Definition Integration
**Action Required:** Update placeholder values with actual 2025 design guidelines

**Steps:**
1. Replace all `#placeholder` values in `colors-2025.scss` with actual hex/HSL values
2. Update the Mantine theme arrays in `theme-2025.ts`
3. Test color contrast ratios for WCAG 2.1 AA compliance

### Phase 3: Gradual Migration
**Recommended Approach:**

1. **Start with New Components**
   ```scss
   // In new component files
   @use 'scss/colors-2025' as colors2025;
   @use 'scss/mixins-2025' as mixins2025;
   
   .new-component {
     @include mixins2025.button-primary-2025;
   }
   ```

2. **Update Existing Components Incrementally**
   ```scss
   // Add 2025 modifier classes to existing components
   .kobo-button {
     // Existing styles remain unchanged
     
     &.kobo-button--2025 {
       @include mixins2025.button-primary-2025;
     }
   }
   ```

3. **React Components with Mantine**
   ```tsx
   // Use the new 2025 theme
   import { themeKobo2025 } from '#/theme/kobo/theme-2025'
   
   <MantineProvider theme={themeKobo2025}>
     {/* Components automatically use 2025 colors */}
   </MantineProvider>
   ```

### Phase 4: Legacy System Retirement
Once migration is complete, gradually remove old color definitions.

## File Structure and Responsibilities

```
jsapp/scss/
├── colors.scss              # Legacy colors (to be phased out)
├── colors-2025.scss         # NEW: 2025 color foundation
├── mixins-2025.scss         # NEW: 2025 utility mixins
├── _variables.scss          # Updated to import 2025 colors
└── main.scss                # Updated to include 2025 system

jsapp/js/theme/kobo/
├── index.ts                 # Current theme (legacy compatibility)
├── theme-2025.ts            # NEW: 2025 Mantine theme
└── *.module.css             # Component styles (gradually updated)
```

## Usage Examples

### 1. SCSS/CSS Implementation

```scss
// Import the new system
@use 'scss/colors-2025' as colors;
@use 'scss/mixins-2025' as mixins;

// Use semantic color variables
.my-component {
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-primary);
  
  // Or use mixins for common patterns
  @include mixins.card-2025;
}

// Use utility classes for quick styling
.success-message {
  @extend .bg-success-2025;
}

// Component-specific styling
.primary-button {
  @include mixins.button-primary-2025;
}
```

### 2. React/TypeScript Implementation

```tsx
// Using the new Mantine theme
import { Button, Alert } from '@mantine/core'
import { themeKobo2025, getSemanticColor } from '#/theme/kobo/theme-2025'

// Automatic theme application
<Button variant="filled">Primary Action</Button>
<Alert type="success">Success message</Alert>

// Programmatic color access
const dynamicStyle = {
  backgroundColor: getSemanticColor('primary', 100),
  color: getSemanticColor('primary', 800),
}
```

### 3. CSS Custom Properties (Most Flexible)

```css
/* Direct use of CSS custom properties */
.custom-component {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border: 1px solid var(--color-border-focus);
}

/* Responsive to theme changes */
.status-indicator {
  color: var(--color-success);
}

.status-indicator[data-status="error"] {
  color: var(--color-error);
}
```

## Color Semantic Guidelines

### Primary Colors
- **Primary Blue**: Main brand color, primary CTAs, links
- **Secondary Teal**: Secondary actions, highlights
- **Accent Purple**: Special highlights, featured content

### Semantic Colors
- **Success Green**: Confirmations, completed states, positive feedback
- **Warning Amber**: Cautions, pending states, attention needed
- **Error Red**: Errors, destructive actions, critical alerts
- **Info Blue**: Informational messages, tooltips, guidance

### Neutral Colors
- **Text**: Primary (headings), Secondary (body), Tertiary (captions)
- **Backgrounds**: Primary (white), Secondary (light gray), Tertiary (medium gray)
- **Borders**: Primary (visible), Secondary (subtle), Focus (interactive)

## Accessibility Considerations

### WCAG 2.1 AA Compliance
- All text/background combinations maintain 4.5:1 contrast ratio minimum
- Interactive elements maintain 3:1 contrast ratio minimum
- Color is never the only means of conveying information

### Implementation Features
- High contrast mode support via `@media (prefers-contrast: high)`
- Reduced motion support via `@media (prefers-reduced-motion: reduce)`
- Color blindness considerations with pattern/icon fallbacks

## Testing Strategy

### Color Contrast Testing
```bash
# Use tools like:
# - WebAIM Contrast Checker
# - Chrome DevTools Lighthouse
# - axe accessibility testing
```

### Cross-Browser Testing
- Test CSS custom property support (IE11+ required)
- Verify color consistency across browsers
- Test dark mode implementation (future)

### Component Testing
- Visual regression testing with updated colors
- Accessibility testing with screen readers
- User testing for color perception

## Migration Checklist

### Before Implementation
- [ ] Receive complete 2025 design guidelines with specific color codes
- [ ] Review and approve color accessibility compliance
- [ ] Plan component migration priority order

### During Implementation
- [ ] Update `colors-2025.scss` with real color values
- [ ] Update `theme-2025.ts` with corresponding Mantine colors
- [ ] Test all semantic color combinations for contrast
- [ ] Update component styles incrementally
- [ ] Maintain backward compatibility during transition

### After Implementation
- [ ] Conduct comprehensive visual testing
- [ ] Perform accessibility audit
- [ ] Gather user feedback
- [ ] Plan legacy color system removal
- [ ] Document final color usage guidelines

## Benefits of This Approach

1. **Gradual Migration**: No breaking changes during transition
2. **Maintainability**: Centralized color definitions with semantic naming
3. **Accessibility**: Built-in WCAG compliance and high contrast support
4. **Flexibility**: CSS custom properties enable dynamic theming
5. **Modern Standards**: Leverages latest CSS and React theming practices
6. **Future-Proof**: Foundation for dark mode and additional themes

## Next Steps

1. **Immediate**: Provide the specific 2025 design guideline colors to replace placeholders
2. **Short-term**: Begin with high-visibility components (buttons, navigation, alerts)
3. **Medium-term**: Migrate form components and data visualization
4. **Long-term**: Complete legacy system removal and implement dark mode

This implementation provides a robust foundation for the 2025 design guidelines while maintaining the stability and usability of the existing KoBoToolbox application.
