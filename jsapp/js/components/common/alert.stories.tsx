import { Stack } from '@mantine/core'
import Alert from './alert'

export default { title: 'Design system/Alert' }

export function Demo() {
  const message =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam'
  return (
    <Stack gap='md'>
      <Alert type='default'>{message}</Alert>
      <Alert iconName='alert' type='default'>
        {message}
      </Alert>
      <Alert iconName='alert' type='error'>
        {message}
      </Alert>
      <Alert iconName='alert' type='info'>
        {message}
      </Alert>
      <Alert iconName='alert' type='success'>
        {message}
      </Alert>
      <Alert iconName='alert' type='warning'>
        {message}
      </Alert>
    </Stack>
  )
}
