// A Kobo Select that adheres closely to built-in browser <select> keyboard
// shortcut conventions.

// Note:
// - Common "Kobo Select" has a visual search filter that isn't implemented here
//   (yet), as well as other styling props.

import React, {useState, useEffect, useRef} from 'react';
import cx from 'classnames';
import styles from './koboAccessibleSelect.module.scss';
import type {IconName} from 'jsapp/fonts/k-icons';
import Icon from 'js/components/common/icon';

const NOTHING_SELECTED: KoboSelectOption = {value: '', label: ''};

export default function KoboSelect3(props: KoboSelect3Props) {
  // PROPS, the important ones:
  //   value?: string; The selected option's string value.
  //   options: KoboSelectOption[] = { label: string, value: string, icon?}[]

  // STATE
  const [expanded, setExpanded] = useState(false); // menu open or closed

  // REFS - used by event handlers.
  const indexRef = useRef(-1);
  const optionRef = useRef<KoboSelectOption>(NOTHING_SELECTED);
  // DOM refs are for viewport scrolling and focus
  const triggerElRef = useRef<HTMLButtonElement>(null);
  const menuElRef = useRef<HTMLDivElement>(null);

  // Induce a re-render manually.
  const forceUpdate = React.useReducer(() => ({}), {})[1] as () => void;

  // HELPERS - some pure, some mutating
  const optionAt = (i: number) => {
    // Range check
    if (i > -1 && i < props.options.length) {
      return props.options[i];
    } else {
      return NOTHING_SELECTED;
    }
  };
  const findPropOption = () =>
    props.options.find((o) => o.value === props.value) || NOTHING_SELECTED;
  const indexOfPropOption = () =>
    props.options.findIndex((o) => o.value === props.value);
  const homeIndex = () => (props.isClearable ? -1 : 0); // first or deselection
  const endIndex = () => props.options.length - 1;
  const openMenu = () => {
    setExpanded(true);
  };
  const closeMenu = () => {
    setExpanded(false);
  };
  const toggleMenu = () => {
    setExpanded((b) => !b);
  };
  const resetRefs = () => {
    // Reset refs to prop value; we do this in more than one place
    indexRef.current = indexOfPropOption();
    optionRef.current = optionAt(indexRef.current);
  };
  const commitOption = () => {
    if (optionRef.current.value !== (props.value || '')) {
      props.onChange?.(optionRef.current.value || null);
    }
  };
  // Commented out - the browser doesn't do this for normal <select>.
  // const scrollTriggerIntoView = () => {
  //   triggerElRef.current?.scrollIntoView({block: 'nearest'});
  // };
  const scrollOptionIntoView = () => {
    const optionEl =
      menuElRef.current?.querySelector(
        `[data-value='${optionRef.current.value}']`
      ) || menuElRef.current?.querySelector('[data-value]'); // goto top if none
    optionEl?.scrollIntoView({block: 'nearest'});
  };
  // Comparison helpers, for letter matching
  const closestAscii = (str: string) => {
    const combining = /[\u0300-\u036F]/g;
    return str.normalize('NFKD').replace(combining, '');
  };
  const matchesBeginningOf = (needle: string, haystack: string) =>
    closestAscii(haystack)
      .toLowerCase()
      .startsWith(closestAscii(needle).toLowerCase());
  const jumpToNextPrefixMatch = (prefix: string) => {
    const start = (indexRef.current + 1) % props.options.length;
    for (let i = 0; i < props.options.length; i++) {
      const checkIndex = (start + i) % props.options.length;
      const checkOption = optionAt(checkIndex);
      if (matchesBeginningOf(prefix, checkOption.label)) {
        indexRef.current = checkIndex;
        optionRef.current = checkOption;
        break;
      }
    }
  };

  // If there's a valid selection, indexRef and optionRef are up-to-date.
  // Otherwise, indexRef is -1 and optionRef is NOTHING_SELECTED.
  if (!expanded) {
    resetRefs();
  }

  // Do what we need to do if the options list changes
  useEffect(() => {
    resetRefs();
    if (expanded) {
      scrollOptionIntoView();
    }
  }, [props.options]);

  // Ensure selected option is visible as the menu opens
  useEffect(() => {
    if (expanded) {
      scrollOptionIntoView();
    }
  }, [expanded]);

  // Refs and helpers for letter cycling / prefix matching.
  const cycle = useRef(true);
  const buffer = useRef('');
  const lastLetterTime = useRef(0); // millis
  const beginMatchMode = () => {
    cycle.current = false;
  };
  const cancelMatchMode = () => {
    cycle.current = true;
    buffer.current = '';
  };
  const emulateBrowserSelectLetterMatching = (eventKey: string) => {
    // Some non-letter keys cancel MATCH mode regardless of timing
    if (/(Tab|Enter|Esc|Home|End|Arrow|Page)/.test(eventKey)) {
      cancelMatchMode();
      return;
    }

    // The rest of this function deals with single-letter keystroke events.
    if (eventKey.length > 1) {
      return;
    }

    // Check what time it is.
    // If it's been more than a second since the last letter, we revert to
    // CYCLE mode.
    const now = Date.now(); // current time in milliseconds
    if (now - lastLetterTime.current > 1000) {
      cancelMatchMode();
    }
    lastLetterTime.current = now; // remember time of this letter keystroke

    // Begin MATCH mode if encountering a new letter while in cycle mode
    // Example: a, a, r --> cycle 'a', cycle 'a', match 'aar'.
    //        -----------a----a------r------ (wait 1s) -- d
    //        aardvark  (a)         (r)
    //        ångström       (a)
    //        atom
    //        disco                                      (d)
    if (
      cycle.current &&
      buffer.current.length > 0 &&
      // Compare key (e.g. 'a') with first letter of (cycled) buffer, ('aaa')
      !matchesBeginningOf(eventKey, buffer.current)
    ) {
      beginMatchMode();
    }

    // Space ' ' doesn't cycle or start a buffer, but it may appear in a match
    if (eventKey === ' ' && buffer.current.length === 0) {
      return;
    }

    // Append the current letter to the letter buffer.
    buffer.current += eventKey;

    // Cycle options with letter initial, or match the buffer, based on the mode.
    if (cycle.current) {
      // CYCLE
      jumpToNextPrefixMatch(eventKey);
    } else {
      // MATCH
      //   Stay on the current option if it still matches.
      //   Otherwise, try to cycle to a better match.
      //                          eslint-disable-next-line no-lonely-if
      if (!matchesBeginningOf(buffer.current, optionRef.current.label)) {
        jumpToNextPrefixMatch(buffer.current);
      }
    }
  };

  const keyDownHandler = (e: React.KeyboardEvent<Node>) => {
    // Alt+ArrowUp or Alt+ArrowDown toggles the menu without changing selection
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      toggleMenu();
      return;
    }

    // Arrows, Page, and Home/End keys change the selection
    switch (e.key) {
      // e.preventDefault() prevents these keys from scrolling the viewport

      // Select previous option
      case 'ArrowLeft':
      case 'ArrowUp':
        indexRef.current = Math.max(indexRef.current - 1, homeIndex());
        optionRef.current = optionAt(indexRef.current);
        e.preventDefault();
        break;

      // Select next option
      case 'ArrowRight':
      case 'ArrowDown':
        indexRef.current = Math.min(indexRef.current + 1, endIndex());
        optionRef.current = optionAt(indexRef.current);
        e.preventDefault();
        break;

      // Select first option (if clearable, clears the selection)
      case 'PageUp':
      case 'Home':
        indexRef.current = homeIndex();
        optionRef.current = optionAt(indexRef.current);
        e.preventDefault();
        break;

      // Select last option
      case 'PageDown':
      case 'End':
        indexRef.current = endIndex();
        optionRef.current = optionAt(indexRef.current);
        e.preventDefault();
        break;
    }

    // Letter keystroke matching lives in a helper function
    emulateBrowserSelectLetterMatching(e.key);

    // Menu open/close affects what the Tab/Enter/Space/Esc keys do,
    // and whether the selection "commits" (sends a change event) or not
    if (expanded) {
      scrollOptionIntoView();
      switch (e.key) {
        case 'Tab':
        case 'Enter':
          commitOption();
          closeMenu();
          break;
        case 'Escape':
          resetRefs(); // Revert selection to props value
          closeMenu();
          break;
      }
    } else {
      // If the menu is closed, immediately commit selection changes.
      commitOption();
      switch (e.key) {
        case ' ':
        case 'Enter':
          openMenu();
          // scrollTriggerIntoView();
          break;
      }
    }

    // Most of the code paths above change indexRef and optionRef.
    // We'd like to trigger a re-render.
    forceUpdate();
  };

  const triggerBlurHandler = () => {
    closeMenu();
  };
  const triggerMouseDownHandler = (e: React.MouseEvent) => {
    if (e.button === 0) {
      toggleMenu();
    }
  };

  // Mousedown.
  const optionMouseHandler = (e: React.MouseEvent) => {
    const optionValue = (e.target as HTMLElement).dataset?.value;
    // If that's a valid option, commit it!
    const index = props.options.findIndex((o) => o.value === optionValue);
    if (index > -1) {
      indexRef.current = index;
      optionRef.current = optionAt(index);
      // Commit if it's a left or middle click!
      if (e.button < 2 && (e.type === 'mouseup' || e.type === 'mousedown')) {
        commitOption();
        closeMenu();
        setTimeout(() => triggerElRef.current?.focus(), 0);
      }
    }
    forceUpdate();
  };
  const preventDefault = (e: React.UIEvent) => {
    e.preventDefault();
  };

  return (
    <div className={cx(styles.root, props.size && styles[props.size])}>
      <label className={styles.label} htmlFor={'select-' + props.name}>
        {props.label}
        {props.required && <span className={styles.redAsterisk}> * </span>}
      </label>
      {/* Trigger */}
      <button
        className={cx(
          styles.trigger,
          props.value || styles.placeholding,
          props.error && styles.hasError
        )}
        type='button'
        // ARIA. There's room for improvement here.
        // https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/combobox_role
        role='combobox'
        aria-required={props.required}
        aria-expanded={expanded}
        aria-controls={props.name + '_dropdown'}
        // label 'for'. Could use new React 'useId' once available
        id={'select-' + props.name}
        // interactivity
        onKeyDown={keyDownHandler}
        onMouseDown={triggerMouseDownHandler}
        onBlur={triggerBlurHandler}
        ref={triggerElRef}
      >
        <label className={styles.selectedOptionLabel}>
          {/* TODO: display the icon of current option next to its label */}
          {findPropOption().label || props.placeholder || t('Select…')}
        </label>
        <Icon name={expanded ? 'angle-up' : 'angle-down'} size='xs' />
      </button>
      {/* Menu */}
      <div
        className={cx(
          styles.menu,
          props.noMaxMenuHeight && styles.noMaxMenuHeight
        )}
        id={props.name + '_dropdown'}
        role='listbox'
        aria-label={props.label}
        data-expanded={expanded}
        onMouseDown={optionMouseHandler}
        onMouseUp={optionMouseHandler}
        onMouseOver={optionMouseHandler}
        onContextMenu={preventDefault}
        ref={menuElRef}
      >
        {props.options.map((option) => (
          <div
            role='option'
            key={option.value}
            className={cx(
              styles.option,
              optionRef.current.value === option.value && styles.selected
            )}
            data-value={option.value}
          >
            {/* TODO: display the icon of each option next to its label */}
            {option.label}
          </div>
        ))}
      </div>
      <input
        type='hidden'
        name={props.name}
        value={props.value}
        required={props.required}
      />
      {/* Like other input fields */}
      {props.error && <p className={styles.error}>{props.error}</p>}
    </div>
  );
}

/* Interfaces! */
interface KoboSelect3Props {
  name: string;
  required?: boolean;
  // disabled?: boolean; // TODO: support disabled
  error?: string;
  /**
   * Callback function telling which option is selected now.
   * Passes either option id or `null` when cleared.
   */
  onChange?: (newSelectedOption: string | null) => void; // TODO: should this return void?

  // children-like
  options: KoboSelectOption[];
  /** Pass the value or null for no selection. */
  value?: string;

  /** Label, displayed above the component */
  label?: string;
  /** Placeholder text, when nothing is selected */
  placeholder?: string;
  isClearable?: boolean; // TODO, something that can be clicked/touched.
  /** Display a spinner if pending. Not implemented. */
  // isPending?: boolean; // TODO

  // design system
  // size?: 'l' | 'm' | 's' | 'fit'; // 'fit' uses min-content
  // type?: 'blue' | 'gray' | 'outline'; // oops, all 'outline'
  size?: 'l' | 'm' | 's' | 'fit';
  type?: 'outline';
  noMaxMenuHeight?: boolean; // Override 4.5 item height limit

  // Testing
  // 'data-cy'?: string;  // not yet needed
}

/** Needs to be exported to be referenced in the test file. */
export interface KoboSelectOption {
  /** Must be unique! */
  value: string;
  /** Should be unique, too! */
  label: string;
  icon?: IconName;
}
