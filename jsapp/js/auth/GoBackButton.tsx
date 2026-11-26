import { Link } from 'react-router-dom'
import ButtonNew from '#/components/common/ButtonNew'
import { AUTH_ROUTES } from '#/router/routerConstants'

export interface GoBackButtonProps {
  /** For a step inside one route. Without it the button links to the login screen. */
  onClick?: () => void
}

/** The way out under a form's main button, for someone who changed their mind. */
export default function GoBackButton({ onClick }: GoBackButtonProps) {
  if (onClick) {
    // `type='button'` so it never submits the form it sits in
    return (
      <ButtonNew type='button' variant='transparent' size='lg' fullWidth onClick={onClick}>
        {t('Go back')}
      </ButtonNew>
    )
  }
  return (
    <ButtonNew component={Link} to={AUTH_ROUTES.LOGIN} variant='transparent' size='lg' fullWidth>
      {t('Go back')}
    </ButtonNew>
  )
}
