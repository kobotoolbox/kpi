import React from 'react';
import Reflux from 'reflux';
import PropTypes from 'prop-types';
import {bem} from 'js/bem';

class UsersSidebar extends Reflux.Component {
  constructor(props){
    super(props);
    this.state = {
      
    };
  }

  render() {
    

    return (
      <React.Fragment>
        <bem.KoboButton
          m={['blue', 'fullwidth']}
        >
          {t('new user')}
        </bem.KoboButton>

        <bem.UsersSidebar >
          <bem.UsersSidebar__label
          >
            <i className='k-icon-users'/>
            <bem.UsersSidebar__labelText>{t('Users')}</bem.UsersSidebar__labelText>
          </bem.UsersSidebar__label>

          <bem.UsersSidebar__label
          >
            <i className='k-icon-group'/>
            <bem.UsersSidebar__labelText>{t('Groups')}</bem.UsersSidebar__labelText>
          </bem.UsersSidebar__label>
        </bem.UsersSidebar>
      </React.Fragment>
    );
  }
}

UsersSidebar.contextTypes = {
  router: PropTypes.object
};


export default UsersSidebar;
