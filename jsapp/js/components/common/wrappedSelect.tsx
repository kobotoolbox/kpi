import React from 'react';
import Select, {Props} from 'react-select';
import bem from 'js/bem';

// NOTE: react-select is going to implement this soon-ish:
// https://github.com/JedWatson/react-select/issues/4327

type WrappedSelectProps = {
  label?: string
  error?: string
  isLimitedHeight?: boolean
} & Props

/**
 * Adds error displaying to the Select component. Largely cribbed from
 * `components/dataAttachments/connectProjects.es6` file.
 */
class WrappedSelect extends React.Component<WrappedSelectProps> {
  render() {
    const classNames = ['kobo-select'];
    if (this.props.isLimitedHeight) {
      classNames.push('kobo-select--limited-height');
    }

    return(
      <bem.KoboSelect__wrapper m={{
        'error': Boolean(this.props.error)
      }}>
        <label>
          <bem.KoboSelect__label>
            {this.props.label}
          </bem.KoboSelect__label>
          <Select
            className={classNames.join(' ')}
            classNamePrefix='kobo-select'
            menuPlacement='auto'
            placeholder={this.props.placeholder || t('Select…')}
            {...this.props}
          />
        </label>
        {this.props.error &&
          <bem.KoboSelect__error>
          {this.props.error}
          </bem.KoboSelect__error>
        }
      </bem.KoboSelect__wrapper>
    );
  }
}

export default WrappedSelect;
