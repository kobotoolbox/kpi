import React from "react";
import PropTypes from "prop-types";
import reactMixin from "react-mixin";
import Reflux from "reflux";
import DocumentTitle from "react-document-title";
import mixins from "js/mixins";
import { bem } from "js/bem";

import { ROOT_BREADCRUMBS } from "./usersConstants";

class usersRoute extends React.Component {
  constructor(props) {
    super(props);
    this.state = {}
    
  }

  render() {

    return (
      <DocumentTitle title={`${t("Users")} | KoboToolbox`}>
        <bem.Breadcrumbs m="gray-wrapper">
          <bem.Breadcrumbs__crumb>
            {ROOT_BREADCRUMBS.USERS.label}
          </bem.Breadcrumbs__crumb>
        </bem.Breadcrumbs>
      </DocumentTitle>
    );
  }
}

usersRoute.contextTypes = {
  router: PropTypes.object,
};

reactMixin(usersRoute.prototype, mixins.droppable);
reactMixin(usersRoute.prototype, Reflux.ListenerMixin);

export default usersRoute;
