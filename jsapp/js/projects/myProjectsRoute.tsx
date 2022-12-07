import React from 'react';
import ViewSwitcher from './projectViews/viewSwitcher';

export default function MyProjectsRoute() {
  return (
    <div>
      <ViewSwitcher selectedViewUid='kobo_my_projects' viewCount={999}/>
      TBD My Projects
    </div>
  );
}
