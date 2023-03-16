import React, {useState, useEffect, useReducer, useRef} from 'react';

/**
 * Creates and updates styles for column widths based on drag events on resize handles.
 * Most of the logic is in the the event handler function.
 *
 * Usage notes
 * - The SCSS for the table cell widths define the default widths.
 * - When dragging a resize handle, this component overrides the width of a
 *   given column with a fixed width in px units.
 * - Header and row cells use [data-field={field.name}]
 * - Resizers, with [data-resize-fieldname={field.name}], are a direct child of
 *   a table header cell.
 *
 * Ideas
 * - Tweaking the default minimums/maximums
 *   - There's a console.log you can uncomment under mouseup that can help
 *     with choosing widths.
 *   - I changed a few just for example, based on what looked okay to me in
 *     English.
 *   - Dates truncate awkwardly, so I gave them more width.
 *   - Not in scope, but it might be possible to compute good defaults during
 *     initialization, from text widths of localized headings.
 * - Consequence of fluid widths
 *   - Try resizing different columns in different orders, sometimes neighbors
 *     adapt in unexpected ways.
 *   - Could use hard px values for defaults to avoid.
 * - Persistence
 *   - Widths are cleared on refresh (or unmount)
 *   - Future, could save them in localstorage, clearing on logout.
 * - Touch events
 *   - Haven't tested kpi on a touchscreen recently, but the code is adaptable.
 *   - Might be pretty simple to support by switching to pointer events.
 */

/**
 * A flexible subset of fieldnames mapped to widths in px.
 * Example:
 * {
 *   name:   100,  //  the "name" column will be 100px wide
 *   status: 150  // the "status" column will be 150px wide
 * }
 */
interface ColumnWidths {
  [key: string]: number;
}
interface ColumnWidthReducerAction {
  type: 'resize';
  column: string;
  width: number;
}
/**
 * Reducer for column width updates.
 * Almost too simple to justify its existence.
 *
 * Pulls a tiny bit of update logic out of the event handlers.
 */
function columnWidthReducer(
  columnWidths: ColumnWidths,
  action: ColumnWidthReducerAction
) {
  switch (action.type) {
    case 'resize':
      return {
        ...columnWidths,
        [action.column]: action.width,
      };
    default:
      return {...columnWidths};
  }
}

/**
 * The minimum resizing width for a given column.
 *
 * This prevents columns from being entirely cropped away.
 * Currently a minimum of 108px.
 * Can be hardcoded per-field.
 */
function minColWidth(fieldname: string) {
  const defaultMinimumWidth = 108;
  const minimums: ColumnWidths = {
    countries: 116,
    dateModified: 144,
    dateDeployed: 144,
  };
  return minimums[fieldname] || defaultMinimumWidth;
}
/**
 * The maximum resizing width for a given column.
 *
 * This is intended to reduce confusion from resizing 1 column absurdly wide.
 * Currently an arbitrary maximum 800px for all fields.
 * Can be hardcoded per-field.
 */
function maxColWidth(fieldname: string) {
  const defaultMaximumWidth = 800;
  const maximums: ColumnWidths = {};
  return maximums[fieldname] || defaultMaximumWidth;
}
/**
 * A helper to clamp between the minimum and maximum allowed resizing widths.
 */
function clampedColumnWidth(fieldname: string, width: number) {
  return Math.min(
    Math.max(width, minColWidth(fieldname)),
    maxColWidth(fieldname)
  );
}

/**
 * <ColumnResizer/>
 *
 * Creates and updates styles for column widths based on drag events on resize
 * handles.
 */
export default function ColumnResizer() {
  // State used in rendering new styles
  const [columnWidths, dispatch] = useReducer(
    columnWidthReducer,
    {} as ColumnWidths
  );
  // Polish. This could perhaps be merged into a single state with isDragging
  const [shouldRenderBodyCursor, setShouldRenderBodyCursor] = useState(false);

  // Refs, for use by event handlers. They won't trigger re-renders.
  /** Bool: Have we started dragging a resize handle? */
  const isDraggingRef = useRef(false);
  /** The field name of the column being resized. */
  const draggingColumnRef: React.MutableRefObject<string | null> = useRef(null);
  /** The pageX when we started interacting with the resize handler */
  const dragStartXRef: React.MutableRefObject<number | null> = useRef(null);
  /** The width of the header cell when we initially touched its resize handler */
  const dragStartWidthRef: React.MutableRefObject<number | null> = useRef(null);
  /** The pageX at the previous mousedown/mousemove.
      Used for de-duping mousemove */
  const dragPrevXRef = useRef(0);
  /** The column width we used in the previous mousedown/mousemove.
      Used for de-duping style re-renders. */
  const dragPrevWidthRef = useRef(0);

  /**
   * The singular DOM event handler for column resizing.
   * One consolidated function. It switches on event.type, delegates when
   * necessary, and exits early.
   */
  const handlerRef = useRef((e: Event) => {
    // TypeScript guard
    if (!(e instanceof MouseEvent)) {
      return;
    }

    // Mousemove
    //  - Only relevant if drag is already happening
    //  - Update column width state for current column
    if (
      e.type === 'mousemove' &&
      // Event logic
      isDraggingRef.current &&
      // Type safety
      draggingColumnRef.current !== null &&
      dragStartXRef.current !== null &&
      dragStartWidthRef.current !== null &&
      // De-dupe
      dragPrevXRef.current !== e.pageX // skip event if same x
    ) {
      const newWidth = clampedColumnWidth(
        draggingColumnRef.current,
        // Calculate desired width based on initial positions and current x
        dragStartWidthRef.current + (e.pageX - dragStartXRef.current)
      );
      // Update state for re-render only if the width is new after clamp
      if (newWidth !== dragPrevWidthRef.current) {
        dispatch({
          type: 'resize',
          column: draggingColumnRef.current,
          width: newWidth,
        });
      }
      // Set variables for de-duping
      dragPrevXRef.current = e.pageX; // to skip event early if same x
      dragPrevWidthRef.current = newWidth; // to skip state update if same width
      return;
    }

    // Mousedown
    //  - Start the dragging interaction (if on a resize handle)
    if (
      e.type === 'mousedown' &&
      e.button === 0 // Only on left (primary) mouse button
    ) {
      // Detect resize handle with [data-resize-fieldname={fieldname}]
      const fieldname = (e.target as HTMLElement).dataset.resizeFieldname;
      if (fieldname) {
        setShouldRenderBodyCursor(true);
        isDraggingRef.current = true;
        draggingColumnRef.current = fieldname;
        dragStartXRef.current = e.pageX;
        dragPrevXRef.current = e.pageX;

        // Capture the current width of the resizer's parent element, a
        // header cell, same width as all the row cells below it.
        const parent = (e.target as HTMLElement).parentElement;
        if (parent) {
          dragStartWidthRef.current = parent.offsetWidth;
          // box-sizing: border-box makes this very easy
        }
      }
      return;
    }

    // Mouseup (or contextmenu)
    //  - End the dragging interaction
    //  - Clear the cursor
    if (e.type === 'mouseup' || e.type === 'contextmenu') {
      // // Uncomment to help find good width settings
      // if (isDraggingRef.current) {
      //   console.log(
      //     'resized',
      //     draggingColumnRef.current,
      //     'to',
      //     dragPrevWidthRef.current,
      //     'px'
      //   );
      // }
      isDraggingRef.current = false;
      setShouldRenderBodyCursor(false);
      return;
    }
  });
  const eventTypes = ['mousedown', 'mouseup', 'mousemove', 'contextmenu'];

  // Mount/Unmount effect: Attach/remove handlers on the body
  useEffect(() => {
    // Mount! Add handlers on body
    eventTypes.forEach((eventType) => {
      document.body.addEventListener(eventType, handlerRef.current);
    });

    // Unmount! Remove handlers on body
    return () => {
      eventTypes.forEach((eventType) => {
        document.body.removeEventListener(eventType, handlerRef.current);
      });
    };
  }, []);

  // Log confirms minimal re-rendering.
  // console.log('Rendered resizer!');

  // Render a dynamic style tag to update all custom widths in a single step,
  // without modifying any attributes managed elsewhere by React.
  return (
    <>
      <style>
        {Object.keys(columnWidths).map(
          (column) =>
            `
            [data-field="${column}"] {
              width: ${columnWidths[column]}px !important;
              max-width: ${columnWidths[column]}px !important;
            }
            `
        )}
        {/* For polish, during resize:
            - Show a cursor even when you hover away from the handle.
            - Make resize indicators stay visible for active resize cell */}
        {isDraggingRef.current &&
          `
          * { cursor: col-resize !important; }
          [data-field="${draggingColumnRef.current}"]::before,
          [data-field="${draggingColumnRef.current}"]::after,
          [data-resize-fieldname="${draggingColumnRef.current}"],
          [data-resize-fieldname="${draggingColumnRef.current}"]::after {
            opacity: 1 !important;
            transition: opacity 0.5s;
          }`}
      </style>
    </>
  );
}
