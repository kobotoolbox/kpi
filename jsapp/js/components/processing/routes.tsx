import React from 'react';
import {Navigate, Route, useParams, generatePath} from 'react-router-dom';
import PermProtectedRoute from 'js/router/permProtectedRoute';
import SingleProcessingRoute from 'js/components/processing/singleProcessingRoute';
import {PERMISSIONS_CODENAMES} from 'js/components/permissions/permConstants';
import {PROCESSING_ROUTES} from 'js/router/routerConstants';

// This is needed so we have access to params :shrug:
const ProcessingRootRedirect = () => {
  const params = useParams();
  return (
    <Navigate to={generatePath(PROCESSING_ROUTES.TRANSCRIPT, params)} replace />
  );
};

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
  );
}
