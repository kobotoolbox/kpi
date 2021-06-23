import React from 'react';
import autoBind from 'react-autobind';
import {bem} from 'js/bem';
import KoboDropdown, {KOBO_DROPDOWN_THEMES} from 'js/components/common/koboDropdown';
import './tableColumnSortDropdown.scss';

export const SORT_VALUES = {};
new Set([
  'A_TO_Z',
  'Z_TO_A',
]).forEach((codename) => {SORT_VALUES[codename] = codename;});
Object.freeze(SORT_VALUES);

/**
 * A wrapper around KoboDropdown to be used in table header to sort columns.
 *
 * @prop {function} onSortChange
 * @prop {string} [sortValue] could be none or one of SORT_VALUES
 * @prop {function} onFieldHiddenChange
 * @prop {boolean} isFieldHidden
 */
class TableColumnSortDropdown extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
  }

  renderTrigger() {
    let sortIcon = ['k-icon'];
    if (this.props.sortValue && this.props.sortValue === SORT_VALUES.A_TO_Z) {
      sortIcon.push('k-icon-sort-down');
    }
    if (this.props.sortValue && this.props.sortValue === SORT_VALUES.Z_TO_A) {
      sortIcon.push('k-icon-sort-up');
    }

    return (
      <div className='table-column-sort-dropdown-trigger'>
        {this.props.sortValue &&
          <i className={sortIcon.join(' ')}/>
        }
        <i className='k-icon k-icon-caret-up'/>
        <i className='k-icon k-icon-caret-down'/>
      </div>
    );
  }

  changeSort(newSortValue) {
    this.props.onSortChange(newSortValue);
  }

  changeFieldHidden(newFieldHidden) {
    this.props.onFieldHiddenChange(newFieldHidden);
  }

  render() {
    return (
      <KoboDropdown
        theme={KOBO_DROPDOWN_THEMES.dark}
        hideOnEsc
        triggerContent={this.renderTrigger()}
        menuContent={
          <div>
            <bem.KoboDropdown__menuButton
              onClick={this.changeSort.bind(this, SORT_VALUES.A_TO_Z)}
            >
              <i className='k-icon k-icon-sort-down'/>
              <span>{t('Sort A → Z')}</span>
            </bem.KoboDropdown__menuButton>

            <bem.KoboDropdown__menuButton
              onClick={this.changeSort.bind(this, SORT_VALUES.Z_TO_A)}
            >
              <i className='k-icon k-icon-sort-up'/>
              <span>{t('Sort Z → A')}</span>
            </bem.KoboDropdown__menuButton>

            {this.props.isFieldHidden &&
              <bem.KoboDropdown__menuButton
                onClick={this.changeFieldHidden.bind(this, false)}
              >
                <i className='k-icon k-icon-view'/>
                <span>{t('Show field')}</span>
              </bem.KoboDropdown__menuButton>
            }

            {!this.props.isFieldHidden &&
              <bem.KoboDropdown__menuButton
                onClick={this.changeFieldHidden.bind(this, true)}
              >
                <i className='k-icon k-icon-view'/>
                <span>{t('Hide field')}</span>
              </bem.KoboDropdown__menuButton>
            }
          </div>
        }
      />
    );
  }
}

export default TableColumnSortDropdown;
