import React from 'react'

import { Navigate, Route, generatePath, useParams } from 'react-router-dom'
import assetStore from '#/assetStore'
import { PERMISSIONS_CODENAMES } from '#/components/permissions/permConstants'
import { getProcessingQuestionType } from '#/components/processing/common/questionType'
import { getAvailableTabsForQuestionType } from '#/components/processing/common/utils'
import { TAB_ROUTES, decodeURLParamWithSlash } from '#/components/processing/routes.utils'
import PermProtectedRoute from '#/router/permProtectedRoute'
import { PROCESSING_ROUTES } from '#/router/routerConstants'
import SingleProcessingRoute from '.'

// This is needed so we have access to params :shrug:
const ProcessingRootRedirect = () => {
  const params = useParams()

  // The asset should already be cached from wherever the user navigated here
  // (e.g. the submissions table), so we can pick the default tab synchronously.
  const asset = params.uid ? assetStore.getAsset(params.uid) : undefined
  const xpath = params.xpath ? decodeURLParamWithSlash(params.xpath) : undefined
  // No submission here, so a question the form no longer has gets the generic default, which the guard in
  // `SingleProcessingRoute` corrects once the submission is loaded.
  const questionType = asset && xpath ? getProcessingQuestionType(asset, xpath) : undefined
  const defaultTabRoute = TAB_ROUTES[getAvailableTabsForQuestionType(questionType)[0]]

  return <Navigate to={generatePath(defaultTabRoute, params)} replace />
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

      {/* Translation detail route with specific language - must come before generic TRANSLATIONS route */}
      <Route
        path={PROCESSING_ROUTES.TRANSLATION_DETAIL}
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
