import React from 'react';
import ViewSwitcher from './projectsView/viewSwitcher';

export default function CustomViewsRoute() {
  return (
    <div>
      <ViewSwitcher viewUid='1' viewCount={15}/>
      TBD Custom View 1
    </div>
  );
}
