import React from 'react';
import {HOME_VIEW} from './projectViews/constants';
import ViewSwitcher from './projectViews/viewSwitcher';

export default function MyProjectsRoute() {
  return (
    <div>
      <ViewSwitcher selectedViewUid={HOME_VIEW.uid}/>
      TBD My Projects
    </div>
  );
}
