import { Stack } from '@mantine/core'
import Alert from '#/components/common/alert'

export default function FormLandingArchivedAlert() {
  return (
    <Stack pt='lg' pl='lg' pr='lg'>
      <Alert iconName='information' type='info'>
        {t('This form is no longer accepting submissions. To resume data collection, click UNARCHIVE below.')}
      </Alert>
    </Stack>
  )
}
