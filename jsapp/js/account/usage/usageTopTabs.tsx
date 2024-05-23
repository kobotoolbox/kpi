import React, {useState} from 'react';
import Tabs from 'jsapp/js/components/common/tabs';
import ProjectBreakdown from './usageProjectBreakdown';
import {useNavigate} from 'react-router-dom';
import Usage from './usage.component';
import {ACCOUNT_ROUTES} from 'js/account/routes.constants';

interface UsageTopTabsProps {
  activeRoute: string;
}

const usageTopTabs: React.FC<UsageTopTabsProps> = ({activeRoute}) => {
  const [selectedTab, setSelectedTab] = useState(activeRoute);
  const navigate = useNavigate();

  const handleTabChange = (route: string) => {
    setSelectedTab(route);
    navigate(route);
  };

  return (
    <div>
      <Tabs
        tabs={[
          {label: 'Account Total', route: ACCOUNT_ROUTES.USAGE},
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
  );
};

export default usageTopTabs;
