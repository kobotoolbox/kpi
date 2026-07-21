import React, { useState } from 'react'

import { Tabs } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import { ACCOUNT_ROUTES } from '#/account/routes.constants'
import Usage from './usage.component'
import ProjectBreakdown from './usageProjectBreakdown'

interface UsageTopTabsProps {
  activeRoute: string
}

const usageTopTabs: React.FC<UsageTopTabsProps> = ({ activeRoute }) => {
  const [activeTab, setActiveTab] = useState<string | null>(activeRoute)
  const navigate = useNavigate()

  const handleTabChange = (route: string | null) => {
    if (!route) return
    setActiveTab(route)
    navigate(route)
  }

  return (
    <>
      <Tabs size='lg' value={activeTab} onChange={handleTabChange} pt={20} ml={40} mr={40}>
        <Tabs.List>
          <Tabs.Tab value={ACCOUNT_ROUTES.USAGE}> {t('Account Total')} </Tabs.Tab>
          <Tabs.Tab value={ACCOUNT_ROUTES.USAGE_PROJECT_BREAKDOWN}> {t('Per Project Total')} </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value={ACCOUNT_ROUTES.USAGE}>
          <Usage />
        </Tabs.Panel>
        <Tabs.Panel value={ACCOUNT_ROUTES.USAGE_PROJECT_BREAKDOWN}>
          <ProjectBreakdown />
        </Tabs.Panel>
      </Tabs>
    </>
  )
}

export default usageTopTabs
