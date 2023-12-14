import React, {Suspense} from 'react';
import sessionStore from 'js/stores/session';
import autoBind from 'react-autobind';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {getLoginUrl} from './routerUtils';
import {withRouter} from './legacy';
import {redirect} from 'react-router-dom';

class ProtectedRoute extends React.Component {
  constructor(props) {
    super(props);
    this.redirectPath = getLoginUrl();
    this.session = sessionStore;
    autoBind(this);
  }

  render() {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <this.props.protectedComponent
          {...this.props}
          loader={async () => {
            if (!this.session.isLoggedIn) {
              await redirect(this.redirectPath);
              return null;
            }
            return new Promise(() => {});
          }}
        />
      </Suspense>
    );
  }
}

export default withRouter(ProtectedRoute);
