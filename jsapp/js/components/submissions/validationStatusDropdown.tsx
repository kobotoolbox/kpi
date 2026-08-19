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

  // When used as a table header filter we want to look like all the neighbouring
  // column filters, i.e. a plain small select. The colorful pills are only for
  // the data cells.
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
      leftSection={currentPillVariant && <Pill variant={currentPillVariant}>{props.currentValue.label}</Pill>}
      classNames={{
        input: classNames({
          [styles.cellInput]: !props.isForHeaderFilter,
          [styles.cellInputWithPill]: Boolean(currentPillVariant),
        }),
        section: props.isForHeaderFilter ? undefined : styles.cellSection,
      }}
      rightSectionWidth={props.isForHeaderFilter ? undefined : 28}
      size='xs'
      disabled={props.isDisabled}
      searchable={false}
      clearable={false}
    />
  )
}
