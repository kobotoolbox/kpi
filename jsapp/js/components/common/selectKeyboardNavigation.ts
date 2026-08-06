/**
 * Adds `PageUp`, `PageDown`, `Home` and `End` to our Select and MultiSelect.
 *
 * Mantine's combobox only handles `ArrowUp`, `ArrowDown`, `Enter`, `Escape` and
 * `Space` (see its `useComboboxTargetProps`). A native `<select>` handles the
 * paging keys too, so we fill the gap.
 *
 * How it works: Mantine remembers which option is highlighted in a ref (that we
 * can't get from props). We send the arrow key presses it already understands.
 * To jump 8 options down, we fire 8 `ArrowDown` events. Mantine tags
 * the highlighted option with `data-combobox-selected` straight away, so we
 * can read the DOM in between to see where we ended up.
 */

/** Attributes Mantine puts on `Combobox.Option` elements. */
const OPTION_SELECTOR = '[data-combobox-option]'
const DISABLED_SELECTOR = '[data-combobox-disabled]'
const SELECTED_SELECTOR = '[data-combobox-selected]'

const HANDLED_KEYS = ['PageUp', 'PageDown', 'Home', 'End']

/** Fallback when we can't measure an option's height, so paging still moves. */
const FALLBACK_PAGE_SIZE = 10

/**
 * Mantine only puts `aria-controls` on the input while the dropdown is open, so
 * no id also means there is no open list to navigate.
 */
const getListbox = (input: HTMLElement): HTMLElement | null => {
  const listboxId = input.getAttribute('aria-controls')
  return listboxId ? document.getElementById(listboxId) : null
}

/**
 * Options in DOM order, without the disabled ones. Arrow keys skip disabled
 * options, so leaving them out keeps our counting and Mantine's in sync.
 */
const getSelectableOptions = (listbox: HTMLElement): HTMLElement[] =>
  Array.from(listbox.querySelectorAll<HTMLElement>(`${OPTION_SELECTOR}:not(${DISABLED_SELECTOR})`))

/**
 * Finds the element that actually scrolls. It's a `ScrollArea` viewport sitting
 * inside the listbox, but only when `withScrollArea` is on, so we look for
 * something with overflow instead of matching a class name.
 */
const getScrollContainer = (option: HTMLElement, listbox: HTMLElement): HTMLElement | null => {
  let element = option.parentElement

  while (element) {
    if (element.scrollHeight > element.clientHeight + 1) {
      return element
    }
    if (element === listbox) {
      return null
    }
    element = element.parentElement
  }

  return null
}

/** How many options fit on screen, which is what one page up or down means. */
const getPageSize = (option: HTMLElement, listbox: HTMLElement, optionCount: number): number => {
  const scrollContainer = getScrollContainer(option, listbox)

  // Nothing scrolls, so the whole list is already visible and a page is all of it.
  if (!scrollContainer) {
    return optionCount
  }

  const optionHeight = option.offsetHeight
  if (!optionHeight) {
    return FALLBACK_PAGE_SIZE
  }

  return Math.max(1, Math.floor(scrollContainer.clientHeight / optionHeight))
}

const pressArrow = (input: HTMLElement, code: 'ArrowUp' | 'ArrowDown', times: number) => {
  for (let i = 0; i < times; i++) {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: code, code, bubbles: true, cancelable: true }))
  }
}

/**
 * Call this from a Select's `onKeyDown`.
 *
 * The keys only do something while the dropdown is open. With it closed we leave
 * them alone so `Home` and `End` still move the caret in the search box, the way
 * they do in any text input.
 */
export const handleSelectNavigationKeys = (event: React.KeyboardEvent<HTMLInputElement>) => {
  if (event.defaultPrevented || event.nativeEvent.isComposing || !HANDLED_KEYS.includes(event.key)) {
    return
  }

  const input = event.currentTarget
  const listbox = getListbox(input)

  // Dropdown is shut, so just open it like `ArrowDown` does. There are no
  // options in the DOM yet, so there is nothing to page through.
  if (!listbox) {
    if (event.key === 'Home' || event.key === 'End') {
      return
    }
    event.preventDefault()
    pressArrow(input, event.key === 'PageUp' ? 'ArrowUp' : 'ArrowDown', 1)
    return
  }

  const options = getSelectableOptions(listbox)
  if (options.length === 0) {
    return
  }

  event.preventDefault()

  // Nothing highlighted yet, which happens when the user opened the dropdown by
  // clicking. Send one arrow press to get a highlight on screen, so we can read
  // our starting position instead of guessing Mantine's index.
  if (!listbox.querySelector(SELECTED_SELECTOR)) {
    pressArrow(input, 'ArrowDown', 1)
  }

  const selected = listbox.querySelector<HTMLElement>(SELECTED_SELECTOR)
  const from = selected ? options.indexOf(selected) : -1
  if (from === -1) {
    return
  }

  const lastIndex = options.length - 1
  const pageSize = getPageSize(options[from], listbox, options.length)

  let target: number
  switch (event.key) {
    case 'PageUp':
      target = from - pageSize
      break
    case 'PageDown':
      target = from + pageSize
      break
    case 'Home':
      target = 0
      break
    default:
      target = lastIndex
  }
  // Stop at the ends rather than wrapping around, which is what a native select
  // does. Arrow keys are the ones that wrap.
  target = Math.min(Math.max(target, 0), lastIndex)

  if (target === from) {
    return
  }

  // Go whichever way is fewer presses. Arrow keys wrap, so from the top of the
  // list `End` is a single `ArrowUp` rather than one press per option. Our
  // language pickers have hundreds of options, so the difference is worth it.
  const downSteps = (target - from + options.length) % options.length
  const upSteps = (from - target + options.length) % options.length
  if (downSteps <= upSteps) {
    pressArrow(input, 'ArrowDown', downSteps)
  } else {
    pressArrow(input, 'ArrowUp', upSteps)
  }

  // Wrapping around is Mantine's `loop` option. It defaults to on and we never
  // turn it off, but if that ever changes the jump above stops at the end of the
  // list instead of wrapping, leaving us short. Walk the remaining gap directly.
  const landedOn = listbox.querySelector<HTMLElement>(SELECTED_SELECTOR)
  const landed = landedOn ? options.indexOf(landedOn) : -1
  if (landed !== -1 && landed !== target) {
    pressArrow(input, landed < target ? 'ArrowDown' : 'ArrowUp', Math.abs(target - landed))
  }
}
