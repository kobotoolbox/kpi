import '@mantine/dates/styles.css'
// eslint-disable-next-line no-restricted-imports -- This file is the Kobo wrapper for the component
import { DatePickerInput as MantineDatePickerInput } from '@mantine/dates'
import type { DateFormatter, DatePickerInputProps } from '@mantine/dates'
import { useId } from '@mantine/hooks'
import dayjs from 'dayjs'
import moment from 'moment'
import classes from '#/theme/kobo/DatePickerInput.module.css'
import inputClasses from '#/theme/kobo/InputBase.module.css'
import { KOBO_Z_INDEX } from '#/theme/kobo/zIndex'
import { formatDate } from '#/utils'

/**
 * Copies moment's active locale into dayjs (which Mantine uses), so the
 * calendar uses the same month and weekday names as the rest of the app.
 */
function getDayjsLocale() {
  const name = `kobo-${moment.locale()}`
  if (!dayjs.Ls[name]) {
    const data = moment.localeData()
    dayjs.locale(
      {
        name,
        months: data.months(),
        monthsShort: data.monthsShort(),
        weekdays: data.weekdays(),
        weekdaysShort: data.weekdaysShort(),
        weekdaysMin: data.weekdaysMin(),
        weekStart: data.firstDayOfWeek(),
        // Required by the type, Mantine doesn't use them.
        formats: {},
        relativeTime: {},
      },
      undefined,
      // Register only, don't change the global dayjs locale.
      true,
    )
  }
  return name
}

const ARIA_LABELS = {
  previousMonth: t('Previous month'),
  nextMonth: t('Next month'),
  monthLevelControl: t('Pick month'),
  previousYear: t('Previous year'),
  nextYear: t('Next year'),
  yearLevelControl: t('Pick year'),
  previousDecade: t('Previous decade'),
  nextDecade: t('Next decade'),
}

/** Shows the date like elsewhere in the app, e.g. "Nov 11, 2026". */
const valueFormatter: DateFormatter = ({ date }) => (typeof date === 'string' ? formatDate(date, false) : '')

/**
 * The Kobo-styled picker. Our styles and defaults live here instead of the
 * global theme, so that `@mantine/dates` stays in this lazily loaded chunk.
 */
export default function DatePickerInputMantine(props: DatePickerInputProps) {
  const popoverId = useId(props.id)

  return (
    <MantineDatePickerInput
      size='md'
      locale={getDayjsLocale()}
      // Mantine starts weeks on Monday regardless of locale.
      firstDayOfWeek={moment.localeData().firstDayOfWeek() as DatePickerInputProps['firstDayOfWeek']}
      // We don't use red weekends anywhere else.
      weekendDays={[]}
      valueFormatter={valueFormatter}
      ariaLabels={ARIA_LABELS}
      clearButtonProps={{ 'aria-label': t('Clear'), className: classes.clearButton }}
      classNames={{
        input: inputClasses.input,
        section: inputClasses.section,
        label: inputClasses.label,
        placeholder: classes.placeholder,
        day: classes.day,
        weekday: classes.weekday,
        monthsListControl: classes.control,
        yearsListControl: classes.control,
        calendarHeaderControl: classes.headerControl,
        calendarHeaderLevel: classes.headerControl,
      }}
      {...props}
      // The calendar dialog is labelled by `<popover id>-target`, but Mantine gives the button its own id.
      id={`${popoverId}-target`}
      popoverProps={{
        // Needed to display correctly in a modal.
        zIndex: KOBO_Z_INDEX.dropdown,
        classNames: { dropdown: classes.dropdown },
        ...props.popoverProps,
        id: popoverId,
      }}
    />
  )
}
