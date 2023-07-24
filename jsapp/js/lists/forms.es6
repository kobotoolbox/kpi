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
import LimitBanner from '../components/usageLimits/overLimitBanner.component';
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
      limits: 0,
    };
    this.data = this.data.bind(this);
  }

  componentDidMount() {
    this.searchSemaphore();
  }

  data = (limit) => {
    this.setState({limits: limit});
    const allCookies = cookies.getAll();
    const isLimitCookie = Object.keys(allCookies).find(
      (key) => key === 'overLimitsCookie'
    );
    if (isLimitCookie === undefined && limit > 0) {
      this.setState({showModal: true});
      var dateNow = new Date();
      var expireDate = new Date(dateNow.setDate(dateNow.getDate() + 1));
      cookies.set('overLimitsCookie', {
        expires: expireDate,
      });
    }
  };

  render() {
    return (
      <div className={styles.myProjectsWrapper}>
       <LimitBanner />
        <div className={styles.myProjectsHeader}>
        <LimitModal
            show={this.state.showModal}
            limits={(limit) => this.data(limit)}
          />
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
