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

class FormsSearchableList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      searchContext: searches.getSearchContext('forms', {
        filterParams: {
          assetType: COMMON_QUERIES.s,
        },
        filterTags: COMMON_QUERIES.s,
      })
    };
  }
  componentDidMount () {
    this.searchSemaphore();
  }
  render () {
    return (
      <>
        <div className={styles.myProjectsHeader}>
          <ViewSwitcher selectedViewUid={HOME_VIEW.uid}/>
        </div>
        <SearchCollectionList searchContext={this.state.searchContext} />
      </>
    );
  }
}

FormsSearchableList.contextTypes = {
  router: PropTypes.object
};

reactMixin(FormsSearchableList.prototype, searches.common);
reactMixin(FormsSearchableList.prototype, mixins.droppable);
reactMixin(FormsSearchableList.prototype, Reflux.ListenerMixin);

export default FormsSearchableList;
