import Alert from './alert';

export default {title: 'common/Alert'};

export function Demo() {
  const message =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam';
  return (
    <div>
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
    </div>
  );
}
