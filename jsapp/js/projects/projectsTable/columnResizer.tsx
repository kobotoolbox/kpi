import React, {memo, useState, useEffect, useRef} from 'react';
import type {ProjectFieldName} from '../projectViews/constants';

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
 *   - Partial support, but could use improvement with touch-specific code
 */

/**
 * A flexible subset of fieldnames mapped to widths in px.
 * Example:
 * {
 *   name:   100,  //  the "name" column will be 100px wide
 *   status: 150  // the "status" column will be 150px wide
 * }
 */
type ColumnWidths = {
  [key in ProjectFieldName]?: number;
};

/**
 * The minimum resizing width for a given column.
 *
 * This prevents columns from being entirely cropped away.
 * Currently a minimum of 108px.
 * Can be hardcoded per-field.
 */
function minColWidth(fieldname: ProjectFieldName) {
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
function maxColWidth(fieldname: ProjectFieldName) {
  const defaultMaximumWidth = 800;
  const maximums: ColumnWidths = {};
  return maximums[fieldname] || defaultMaximumWidth;
}
/**
 * A helper to clamp between the minimum and maximum allowed resizing widths.
 */
function clampedColumnWidth(fieldname: ProjectFieldName, width: number) {
  return Math.min(
    Math.max(width, minColWidth(fieldname)),
    maxColWidth(fieldname)
  );
}

/**
 * Render a dynamic style tag to update all custom column widths.
 *
 * The alternative would be to adjust inline styles on every cell
 * in the table, but that would trigger lots of react re-renders
 * for the whole table during the drag interaction.
 *
 * Instead, we let the browser parse and apply these CSS rules,
 * which is pretty efficient.
 */
function ColumnWidthsStyle(props: {columnWidths: ColumnWidths}) {
  return (
    <style>
      {(Object.keys(props.columnWidths) as ProjectFieldName[]).map(
        (column) =>
          `
        [data-field="${column}"] {
          width: ${props.columnWidths[column]}px !important;
          max-width: ${props.columnWidths[column]}px !important;
        }
        `
      )}
    </style>
  );
}
/**
 * Render a dynamic style tag during drag interaction, to…
 *
 *   - Show a dragging cursor
 *   - Keep the cell header width indicators visible
 *
 * …even if the pointer strays from the resize handle.
 */
const DraggingStyle = memo(function DraggingStyle(props: {
  isDragging: boolean;
  draggingFieldname: string;
}) {
  return (
    <style>
      {props.isDragging &&
        `
      * { cursor: col-resize !important; }
      [data-field="${props.draggingFieldname}"]::before,
      [data-field="${props.draggingFieldname}"]::after,
      [data-resize-fieldname="${props.draggingFieldname}"],
      [data-resize-fieldname="${props.draggingFieldname}"]::after {
        opacity: 1 !important;
        transition: opacity 0.5s;
      }`}
    </style>
  );
});
/**
 * <ColumnResizer/>
 *
 * Creates and updates styles for column widths based on drag events on resize
 * handles.
 */
export default function ColumnResizer() {
  // State, triggers re-rendering in style tags
  /** Column Widths, used by <ColumnWidthsStyle/> */
  const [columnWidths, setColumnWidths] = useState({} as ColumnWidths);
  /** isDragging, used by <DraggingStyle/> */
  const [isDragging, setIsDragging] = useState(false);

  // Refs, for use by event handlers. They won't trigger re-renders.
  /** Bool: Have we started dragging a resize handle? */
  const isDraggingRef = useRef(false);
  /** The field name of the column being resized. */
  const draggingColumnRef = useRef('' as ProjectFieldName);
  /** The pageX when we started interacting with the resize handler */
  const dragStartXRef = useRef(-1);
  /** The width of the header cell when we initially touched its resize handler */
  const dragStartWidthRef = useRef(-1);
  /** The pageX at the previous mousedown/mousemove.
      Used for de-duping mousemove */
  const dragPrevXRef = useRef(0);
  /** The column width we used in the previous mousedown/mousemove.
      Used for de-duping style re-renders. */
  const dragPrevWidthRef = useRef(0);

  // This handler is separated out from the others as a small optimization.
  /**
   * Event handler for pointermove events
   *
   * - Only relevant if drag interaction is already happening
   * - Updates the column width state for the current column
   */
  const moveHandlerRef = useRef((e: PointerEvent) => {
    // Return early if:
    //  - Not dragging (shouldn't happen, but check just in case)
    //  - Same X as before (column width can't change)
    if (!isDraggingRef.current || dragPrevXRef.current === e.pageX) {
      return;
    }

    const newWidth = clampedColumnWidth(
      draggingColumnRef.current,
      // Calculate desired width based on initial positions and current x
      dragStartWidthRef.current + (e.pageX - dragStartXRef.current)
    );
    // Update state for re-render only if the width is new after clamp
    if (newWidth !== dragPrevWidthRef.current) {
      setColumnWidths((prevColumnWidths) => {
        return {
          ...prevColumnWidths,
          [draggingColumnRef.current]: newWidth,
        };
      });
    }
    // Set variables for de-duping
    dragPrevXRef.current = e.pageX; // to skip event early if same x
    dragPrevWidthRef.current = newWidth; // to skip state update if same width

    return;
    // }
  });

  /**
   * A consolidated function for pointerdown, pointerup, and contextmenu.
   * It switches on event.type, delegates when necessary, and exits early.
   * It also adds/removes listeners for the pointermove event.
   */
  const handlerRef = useRef((e: Event) => {
    // TypeScript guard
    if (!(e instanceof PointerEvent)) {
      return;
    }

    // Pointer Down
    //  - Start the dragging interaction (if on a resize handle)
    if (
      e.type === 'pointerdown' &&
      e.button === 0 // Only on left (primary) mouse button
    ) {
      // Detect resize handle with [data-resize-fieldname={fieldname}]
      const fieldname = (e.target as HTMLElement).dataset
        .resizeFieldname as ProjectFieldName;
      if (fieldname) {
        setIsDragging(true);
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
        document.body.addEventListener('pointermove', moveHandlerRef.current);
      }
      return;
    }

    // Mouseup (or contextmenu)
    //  - End the dragging interaction
    //  - Clear the cursor
    if (e.type === 'pointerup' || e.type === 'contextmenu') {
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
      setIsDragging(false);
      document.body.removeEventListener('pointermove', moveHandlerRef.current);
      return;
    }
  });

  // List of events we register immediately.
  // pointermove not included - we toggle this when drag starts/ends
  const eventTypes = ['pointerdown', 'pointerup', 'contextmenu'];

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
      // Remove pointermove, in case we unmount during a drag event
      document.body.removeEventListener('pointermove', moveHandlerRef.current);
    };
  }, []);

  return (
    <>
      <ColumnWidthsStyle columnWidths={columnWidths} />
      <DraggingStyle
        isDragging={isDragging}
        draggingFieldname={draggingColumnRef.current}
      />
    </>
  );
}
