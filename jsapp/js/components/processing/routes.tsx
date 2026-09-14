import React from 'react'

import { Navigate, Route, generatePath, useParams } from 'react-router-dom'
import assetStore from '#/assetStore'
import { findRowByXpath } from '#/assetUtils'
import { PERMISSIONS_CODENAMES } from '#/components/permissions/permConstants'
import { getAvailableTabsForQuestionType } from '#/components/processing/common/utils'
import { ProcessingTab, decodeURLParamWithSlash } from '#/components/processing/routes.utils'
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
  const questionType = asset?.content && xpath ? findRowByXpath(asset.content, xpath)?.type : undefined
  const defaultTabRoute = getAvailableTabsForQuestionType(questionType).includes(ProcessingTab.Transcript)
    ? PROCESSING_ROUTES.TRANSCRIPT
    : PROCESSING_ROUTES.TRANSLATIONS

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
