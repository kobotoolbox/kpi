import { Code, Stack, Text, Title } from '@mantine/core'
import DocumentTitle from 'react-document-title'
import { useLocation } from 'react-router-dom'
import AuthCard from '#/auth/AuthContainer/AuthCard'

export interface AuthPlaceholderRouteProps {
  title: string
  /** The anonymous `/accounts/…` screens need one; the `/account/…` ones already have it */
  hasAuthCard?: boolean
}

/**
 * Stand-in for an allauth view that has a route but no screen yet. Every route still pointing here is a
 * screen left to build.
 */
export default function AuthPlaceholderRoute({ title, hasAuthCard }: AuthPlaceholderRouteProps) {
  const { pathname } = useLocation()

  // Several placeholders look alike, so show the path to tell which route matched.
  const content = (
    <Stack gap='md'>
      <Title order={1} size='h3'>
        {title}
      </Title>
      <Text>This screen is not built yet. The route exists so the flow around it can be tried out.</Text>
      <Code>{pathname}</Code>
    </Stack>
  )

  return (
    <DocumentTitle title={`${title} | KoboToolbox`}>
      {hasAuthCard ? <AuthCard>{content}</AuthCard> : content}
    </DocumentTitle>
  )
}
