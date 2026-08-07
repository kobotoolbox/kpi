import { Group, Switch } from '@mantine/core'

interface AnonymousSubmissionProps {
  checked: boolean
  disabled: boolean
  onChange: (isChecked: boolean) => void
}

export default function AnonymousSubmission(props: AnonymousSubmissionProps) {
  return (
    <Group gap='xs'>
      <Switch
        checked={props.checked}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.currentTarget.checked)}
        label={t('Allow submissions to this form without a username and password')}
      />
    </Group>
  )
}
