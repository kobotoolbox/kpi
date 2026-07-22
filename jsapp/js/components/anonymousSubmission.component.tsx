import { Group } from '@mantine/core'
import { IconHelpCircleFilled } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import ToggleSwitch from '#/components/common/toggleSwitch'
import { HELP_ARTICLE_ANON_SUBMISSIONS_URL } from '#/constants'
import envStore from '#/envStore'
import ActionIcon from './common/ActionIcon'

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

      <ActionIcon
        size='sm'
        variant='transparent'
        icon={IconHelpCircleFilled}
        component={Link}
        to={envStore.data.support_url + HELP_ARTICLE_ANON_SUBMISSIONS_URL}
        target='_blank'
        tooltip={t(
          'Allow anonymous submissions for this project. Previously, this was an account-wide setting. Click the icon to learn more.',
        )}
        tooltipProps={{ multiline: true, w: 300 }}
      />
    </Group>
  )
}
