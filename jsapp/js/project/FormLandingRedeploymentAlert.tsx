import { Stack } from '@mantine/core'
import Alert from '#/components/common/alert'

export default function FormLandingRedeploymentAlert() {
  return (
    <Stack pt='lg' pl='lg' pr='lg'>
      <Alert iconName='alert' type='warning'>
        {t('If you want to make these changes public, you must deploy this form.')}
      </Alert>
    </Stack>
  )
}
