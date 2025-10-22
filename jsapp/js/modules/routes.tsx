import React from 'react'

import { Navigate, Route } from 'react-router-dom'
import RequireAuth from '#/router/requireAuth'

import InsightZenApp from '../../src/insightzen/InsightZenApp'
import InsightZenPlaceholder from '../../src/insightzen/components/Placeholder'
import ListProjectsPage from '../../src/insightzen/pages/Projects/ListProjectsPage'
import ListUsersPage from '../../src/insightzen/pages/Users/ListUsersPage'
import SchemeEditorPage from '../../src/insightzen/pages/Quotas/SchemeEditorPage'
import SchemesListPage from '../../src/insightzen/pages/Quotas/SchemesListPage'
import ModulePanelPage from './modulePanelPage'
import { MODULE_DEFINITIONS } from './modulesConfig'

export default function moduleRoutes() {
  return (
    <>
      {MODULE_DEFINITIONS.filter((module) => module.panels.length > 0).map((module) => {
        if (module.id === 'management') {
          return (
            <Route
              path={module.baseRoute}
              key={module.id}
              element={
                <RequireAuth>
                  <InsightZenApp />
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to={`${module.baseRoute}/${module.panels[0].id}`} replace />} />
              {module.panels.flatMap((panel) => {
                if (panel.id === 'user-management') {
                  return <Route key={panel.id} path={panel.id} element={<ListUsersPage />} />
                }
                if (panel.id === 'project-management') {
                  return <Route key={panel.id} path={panel.id} element={<ListProjectsPage />} />
                }
                if (panel.id === 'quota-management') {
                  return [
                    <Route key={`${panel.id}-list`} path={panel.id} element={<SchemesListPage />} />,
                    <Route key={`${panel.id}-detail`} path={`${panel.id}/:schemeId`} element={<SchemeEditorPage />} />,
                  ]
                }
                return [
                  <Route
                    key={panel.id}
                    path={panel.id}
                    element={<InsightZenPlaceholder title={panel.label} />}
                  />,
                ]
              })}
            </Route>
          )
        }

        return (
          <Route path={module.baseRoute} key={module.id}>
            <Route
              index
              element={
                <RequireAuth>
                  <Navigate to={`${module.baseRoute}/${module.panels[0].id}`} replace />
                </RequireAuth>
              }
            />
            {module.panels.map((panel) => (
              <Route
                key={panel.id}
                path={panel.id}
                element={
                  <RequireAuth>
                    <ModulePanelPage
                      moduleId={module.id}
                      moduleLabel={module.label}
                      panelId={panel.id}
                      panelLabel={panel.label}
                    />
                  </RequireAuth>
                }
              />
            ))}
          </Route>
        )
      })}
    </>
  )
}
