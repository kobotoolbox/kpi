import React from 'react';
import autoBind from 'react-autobind';
import KoboDropdown, {
  KOBO_DROPDOWN_THEMES,
  KOBO_DROPDOWN_PLACEMENTS,
} from 'js/components/common/koboDropdown';
import ColumnsHideForm from 'js/components/submissions/columnsHideForm';
import './columnsHideDropdown.scss';

/**
 * A wrapper around KoboDropdown to be used atop table to bulk hide columns.
 *
 * @prop {object} asset
 * @prop {object[]} submissions
 * @prop {boolean} showGroupName
 * @prop {number} translationIndex
 */
class ColumnsHideDropdown extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
  }

  render() {
    return (
      <KoboDropdown
        theme={KOBO_DROPDOWN_THEMES.light}
        hideOnEsc
        hideOnMenuOutsideClick
        placement={KOBO_DROPDOWN_PLACEMENTS['down-left']}
        name='columns-hide-dropdown'
        triggerContent={
          <span className='columns-hide-dropdown-trigger'>
            <i className='k-icon k-icon-hide'/>
            {t('hide fields')}
          </span>
        }
        menuContent={
          <ColumnsHideForm {...this.props}/>
        }
      />
    );
  }
}

export default ColumnsHideDropdown;
