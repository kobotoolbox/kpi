import { Pill, type PillProps } from '@mantine/core'
import classNames from 'classnames'
import Select from '#/components/common/Select'
import {
  VALIDATION_STATUS_OPTIONS,
  VALIDATION_STATUS_OPTIONS_WITH_SHOW_ALL,
  ValidationStatusName,
} from '#/components/submissions/validationStatus.constants'
import type {
  ValidationStatusOption,
  ValidationStatusOptionName,
} from '#/components/submissions/validationStatus.constants'
import styles from './validationStatusDropdown.module.scss'

/**
 * Pill variant for each of the actual statuses. The remaining options ("-" and
 * "Show all") mean "no status", so they stay plain text.
 */
const PILL_VARIANTS: Partial<Record<ValidationStatusOptionName, PillProps['variant']>> = {
  [ValidationStatusName.validation_status_not_approved]: 'red-light',
  [ValidationStatusName.validation_status_approved]: 'teal-light',
  [ValidationStatusName.validation_status_on_hold]: 'amber-light',
}

interface ValidationStatusDropdownProps {
  /** Calls back with `value`, not option object */
  onChange: (newValue: ValidationStatusOptionName) => void
  /** This is the whole option object */
  currentValue: ValidationStatusOption
  isDisabled?: boolean
  /** For gray background, includes additional option */
  isForHeaderFilter?: boolean
}

export default function ValidationStatusDropdown(props: ValidationStatusDropdownProps) {
  const options = props.isForHeaderFilter ? VALIDATION_STATUS_OPTIONS_WITH_SHOW_ALL : VALIDATION_STATUS_OPTIONS

  // The colorful pills are only for the data cells - as a table header filter
  // this has to look like all the neighbouring column filters.
  const currentPillVariant = props.isForHeaderFilter ? undefined : PILL_VARIANTS[props.currentValue.value]

  return (
    <Select<ValidationStatusOptionName>
      data={options}
      value={props.currentValue.value}
      onChange={(newValue) => {
        // It's not really possible to have `null` here, as `Select` is not clearable.
        if (newValue !== null) {
          props.onChange(newValue)
        }
      }}
      renderOption={({ option }) => {
        const variant = PILL_VARIANTS[option.value as ValidationStatusOptionName]
        return variant ? <Pill variant={variant}>{option.label}</Pill> : <span>{option.label}</span>
      }}
      // `cellInputWithPill` hides the input's own text, so this pill is what the
      // user actually reads.
      leftSection={currentPillVariant && <Pill variant={currentPillVariant}>{props.currentValue.label}</Pill>}
      classNames={{
        input: classNames({
          [styles.cellInput]: !props.isForHeaderFilter,
          [styles.cellInputWithPill]: Boolean(currentPillVariant),
        }),
        section: props.isForHeaderFilter ? undefined : styles.cellSection,
      }}
      // Narrower than the default, to leave the pill as much room as possible.
      rightSectionWidth={props.isForHeaderFilter ? undefined : 28}
      size='xs'
      disabled={props.isDisabled}
      searchable={false}
      clearable={false}
    />
  )
}
