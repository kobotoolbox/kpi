import React, { useState } from 'react'

import { useNavigate } from 'react-router-dom'
import { ACCOUNT_ROUTES } from '#/account/routes.constants'
import Tabs from '#/components/common/tabs'
import Usage from './usage.component'
import ProjectBreakdown from './usageProjectBreakdown'

interface UsageTopTabsProps {
  activeRoute: string
}

const usageTopTabs: React.FC<UsageTopTabsProps> = ({ activeRoute }) => {
  const [selectedTab, setSelectedTab] = useState(activeRoute)
  const navigate = useNavigate()

  const handleTabChange = (route: string) => {
    setSelectedTab(route)
    navigate(route)
  }

  return (
    <div>
      <Tabs
        tabs={[
          { label: 'Account Total', route: ACCOUNT_ROUTES.USAGE },
          {
            label: 'Per Project Total',
            route: ACCOUNT_ROUTES.USAGE_PROJECT_BREAKDOWN,
          },
        ]}
        selectedTab={selectedTab}
        onChange={handleTabChange}
      />
      {selectedTab === ACCOUNT_ROUTES.USAGE ? <Usage /> : <ProjectBreakdown />}
    </div>
  )
}

export default usageTopTabs
