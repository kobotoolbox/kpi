import React from 'react';
import {
  createHashRouter,
} from "react-router-dom";

import App from 'js/app';


const router = createHashRouter([
  {
    path: "/",
    element: <App/>,
  },
]);

export default router;