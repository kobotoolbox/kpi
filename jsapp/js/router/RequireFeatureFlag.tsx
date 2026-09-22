import type React from 'react'
import { Navigate } from 'react-router-dom'
import { type FeatureFlag, useFeatureFlag } from '#/featureFlags'
import { ROUTES } from './routerConstants'

interface Props {
  flag: FeatureFlag
  children: React.ReactNode
}

export default function RequireFeatureFlag({ flag, children }: Props) {
  const isFlagEnabled = useFeatureFlag(flag)
  return isFlagEnabled ? <>{children}</> : <Navigate to={ROUTES.FORMS} replace />
}
