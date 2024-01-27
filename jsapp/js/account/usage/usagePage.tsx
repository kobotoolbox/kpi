import React from 'react';
import Usage from './usage.component';
import ProjectBreakdown from './usageProjectBreakdown';
import UsageTopTabs from './usageTopTabs.component';

interface UsagePageProps {
  account_total: boolean;
}

/*
 * Display usage tabs for navigation along with either the `account total` or
 * `project breakdown` component
 */
const UsagePage: React.FC<UsagePageProps> = ({account_total}) => (
  <div>
    <UsageTopTabs />
    {account_total ? <Usage /> : <ProjectBreakdown />}
  </div>
);

export default UsagePage;
