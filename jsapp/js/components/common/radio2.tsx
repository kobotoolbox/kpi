import {Group, Radio, RadioGroup, Stack, Title} from "@mantine/core"

export interface MultiRadioOption {
  label: string
  value: string
  /** Disables just this option. */
  isDisabled?: boolean
}

interface MultiRadioProps {
  options: MultiRadioOption[]
  /** Displays a label/title on top of the radio options. */
  title?: string
  /** Internal ID useful for the identification of radio. */
  name: string
  onChange: (newSelectedValue: string, radioName: string) => void
  /** The `value` of selected option. */
  selected: string
  /** Disables whole radio component. */
  isDisabled?: boolean
  /** This is `false` by default */
  isClearable?: boolean
}

export default function MultiRadio(props: MultiRadioProps) {
  function onChange(evt: React.ChangeEvent<HTMLInputElement>) {
    props.onChange(evt.currentTarget.value, props.name)
  }

  function onClick(evt: React.MouseEvent<HTMLInputElement>) {
    // For clearable radio, we unselect checked option when clicked,
    // Note: we can't simply check `evt.currentTarget.checked`, because
    // the input toggles before `onClick` event occurs, so it is always checked
    console.log('------------', props.selected)
    console.log('------------', evt.currentTarget.value)
    if (props.isClearable && props.selected === evt.currentTarget.value) {
      props.onChange('', props.name)
    }
  }

  return (
    <Stack>
      <RadioGroup label={props.title}>
        <Stack gap={'xs'}>
          {props.options.map((option) => (
            <Radio
              value={option.value}
              name={props.name}
              onChange={evt => onChange(evt)}
              label={option.label}
              checked={props.selected === option.value}
              disabled={props.isDisabled || option.isDisabled}
            />
          ))}
        </Stack>
      </RadioGroup>
    </Stack>
  )
}
