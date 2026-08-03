import { Group } from '@mantine/core'
import ToggleSwitch from '#/components/common/toggleSwitch'

interface AnonymousSubmissionProps {
  checked: boolean
  disabled: boolean
  onChange: (isChecked: boolean) => void
}

export default function AnonymousSubmission(props: AnonymousSubmissionProps) {
  return (
    <Group gap='xs'>
      <ToggleSwitch
        checked={props.checked}
        disabled={props.disabled}
        onChange={props.onChange}
        label={t('Allow submissions to this form without a username and password')}
      />
    </Group>
  )
}
