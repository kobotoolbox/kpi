import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import {COMMON_QUERIES} from 'js/constants';
import {HOME_VIEW} from 'js/projects/projectViews/constants';
import {searches} from '../searches';
import mixins from '../mixins';
import SearchCollectionList from '../components/searchcollectionlist';
import ViewSwitcher from 'js/projects/projectViews/viewSwitcher';
import styles from './forms.module.scss';
import LimitModal from '../components/usageLimits/overLimitModal.component';
import {checkLimits} from '../components/usageLimits/usageCalculations';
import {Cookies} from 'react-cookie';

const cookies = new Cookies();

class FormsSearchableList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      searchContext: searches.getSearchContext('forms', {
        filterParams: {
          assetType: COMMON_QUERIES.s,
        },
        filterTags: COMMON_QUERIES.s,
      }),
      showModal: false,
    };
  }

  componentDidMount() {
    const allCookies = cookies.getAll();
    const isLimitCookie = Object.keys(allCookies).find(
      (key) => key === 'overLimitsCookie'
    );

    if (isLimitCookie === undefined && checkLimits()) {
      this.setState({showModal: true});

      var dateNow = new Date();
      var expireDate = new Date(dateNow.setDate(dateNow.getDate() + 1));
      cookies.set('overLimitsCookie', {
        expires: expireDate,
      });
    }
    this.searchSemaphore();
  }

  render() {
    return (
      <div className={styles.myProjectsWrapper}>
        <div className={styles.myProjectsHeader}>
          <LimitModal show={this.state.showModal} />
          <ViewSwitcher selectedViewUid={HOME_VIEW.uid} />
        </div>
        <SearchCollectionList searchContext={this.state.searchContext} />
      </div>
    );
  }
}

FormsSearchableList.contextTypes = {
  router: PropTypes.object,
};

reactMixin(FormsSearchableList.prototype, searches.common);
reactMixin(FormsSearchableList.prototype, mixins.droppable);
reactMixin(FormsSearchableList.prototype, Reflux.ListenerMixin);

export default FormsSearchableList;
