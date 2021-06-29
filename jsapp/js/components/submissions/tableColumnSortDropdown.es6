import React from 'react';
import autoBind from 'react-autobind';
import classNames from 'classnames';
import {bem} from 'js/bem';
import KoboDropdown, {KOBO_DROPDOWN_THEMES} from 'js/components/common/koboDropdown';
import {SORT_VALUES} from './tableConstants';
import tableStore from './tableStore';
import './tableColumnSortDropdown.scss';

/**
 * A wrapper around KoboDropdown to be used in table header to sort columns. It
 * only needs the column id as all changes are done through tableStore.
 *
 * @prop {string} fieldId - one of table columns
 */
class TableColumnSortDropdown extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      sortValue: null,
      isFieldHidden: false,
    };
    this.unlisteners = [];
    autoBind(this);
  }

  componentDidMount() {
    this.unlisteners.push(
      tableStore.listen(this.onTableStoreChange)
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  onTableStoreChange() {
    this.setState({
      sortValue: tableStore.getFieldSortValue(this.props.fieldId),
      isFieldHidden: tableStore.isFieldHidden(this.props.fieldId),
    });
  }

  renderTrigger() {
    let sortIcon = ['k-icon'];
    if (this.state.sortValue && this.state.sortValue === SORT_VALUES.A_TO_Z) {
      sortIcon.push('k-icon-sort-down');
    }
    if (this.state.sortValue && this.state.sortValue === SORT_VALUES.Z_TO_A) {
      sortIcon.push('k-icon-sort-up');
    }

    return (
      <div className='table-column-sort-dropdown-trigger'>
        {this.state.sortValue &&
          <i className={sortIcon.join(' ')}/>
        }
        <i className='k-icon k-icon-caret-up'/>
        <i className='k-icon k-icon-caret-down'/>
      </div>
    );
  }

  clearSort(evt) {
    evt.stopPropagation();
    tableStore.removeFieldSortValue(this.props.fieldId);
  }

  changeSort(sortValue) {
    tableStore.setFieldSortValue(this.props.fieldId, sortValue);
  }

  changeFieldHidden(isHidden) {
    tableStore.setHiddenField(this.props.fieldId, isHidden);
  }

  render() {
    return (
      <KoboDropdown
        theme={KOBO_DROPDOWN_THEMES.dark}
        hideOnEsc
        triggerContent={this.renderTrigger()}
        menuContent={
          <React.Fragment>
            <bem.KoboDropdown__menuButton
              className={classNames('table-column-sort-dropdown-option', {
                'table-column-sort-dropdown-option--active': this.state.sortValue === SORT_VALUES.A_TO_Z,
              })}
              onClick={this.changeSort.bind(this, SORT_VALUES.A_TO_Z)}
            >
              <i className='k-icon k-icon-sort-down'/>
              <span>{t('Sort A → Z')}</span>
              {this.state.sortValue === SORT_VALUES.A_TO_Z &&
                <i
                  onClick={this.clearSort}
                  className='k-icon k-icon-cancel'
                />
              }
            </bem.KoboDropdown__menuButton>

            <bem.KoboDropdown__menuButton
              className={classNames('table-column-sort-dropdown-option', {
                'table-column-sort-dropdown-option--active': this.state.sortValue === SORT_VALUES.Z_TO_A,
              })}
              onClick={this.changeSort.bind(this, SORT_VALUES.Z_TO_A)}
            >
              <i className='k-icon k-icon-sort-up'/>
              <span>{t('Sort Z → A')}</span>
              {this.state.sortValue === SORT_VALUES.Z_TO_A &&
                <i
                  onClick={this.clearSort}
                  className='k-icon k-icon-cancel'
                />
              }
            </bem.KoboDropdown__menuButton>

            {this.state.isFieldHidden &&
              <bem.KoboDropdown__menuButton
                onClick={this.changeFieldHidden.bind(this, false)}
              >
                <i className='k-icon k-icon-view'/>
                <span>{t('Show field')}</span>
              </bem.KoboDropdown__menuButton>
            }

            {!this.state.isFieldHidden &&
              <bem.KoboDropdown__menuButton
                onClick={this.changeFieldHidden.bind(this, true)}
              >
                <i className='k-icon k-icon-view'/>
                <span>{t('Hide field')}</span>
              </bem.KoboDropdown__menuButton>
            }
          </React.Fragment>
        }
      />
    );
  }
}

export default TableColumnSortDropdown;
