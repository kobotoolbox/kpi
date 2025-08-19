import React from 'react'

import { Navigate, Route, generatePath, useParams } from 'react-router-dom'
import { PERMISSIONS_CODENAMES } from '#/components/permissions/permConstants'
import SingleProcessingRoute from '#/components/processing/singleProcessingRoute'
import PermProtectedRoute from '#/router/permProtectedRoute'
import { PROCESSING_ROUTES } from '#/router/routerConstants'

// This is needed so we have access to params :shrug:
const ProcessingRootRedirect = () => {
  const params = useParams()
  return <Navigate to={generatePath(PROCESSING_ROUTES.TRANSCRIPT, params)} replace />
}

export default function routes() {
  return (
    <>
      <Route path='' element={<ProcessingRootRedirect />} />

      <Route
        path={PROCESSING_ROUTES.TRANSCRIPT}
        element={
          <PermProtectedRoute
            requiredPermissions={[PERMISSIONS_CODENAMES.view_submissions]}
            protectedComponent={SingleProcessingRoute}
          />
        }
      />

      <Route
        path={PROCESSING_ROUTES.TRANSLATIONS}
        element={
          <PermProtectedRoute
            requiredPermissions={[PERMISSIONS_CODENAMES.view_submissions]}
            protectedComponent={SingleProcessingRoute}
          />
        }
      />

      <Route
        path={PROCESSING_ROUTES.ANALYSIS}
        element={
          <PermProtectedRoute
            requiredPermissions={[PERMISSIONS_CODENAMES.view_submissions]}
            protectedComponent={SingleProcessingRoute}
          />
        }
      />
    </>
  )
}
