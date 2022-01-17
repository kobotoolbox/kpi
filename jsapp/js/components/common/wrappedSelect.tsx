import React from 'react';
import Select, {Props} from 'react-select';
import bem from 'js/bem';

// NOTE: react-select is going to implement this soon-ish:
// https://github.com/JedWatson/react-select/issues/4327

type WrappedSelectProps = {
  label: string
  error: string
} & Props

/**
 * Adds error displaying to the Select component. Largely cribbed from
 * `components/dataAttachments/connectProjects.es6` file.
 */
class WrappedSelect extends React.Component<WrappedSelectProps> {
  render() {
    return(
      <bem.KoboSelect__wrapper m={{
        'error': Boolean(this.props.error)
      }}>
        <label>
          {this.props.label}
          <Select {...this.props}/>
        </label>
        <label className='select-errors'>
          {this.props.error}
        </label>
      </bem.KoboSelect__wrapper>
    );
  }
}

export default WrappedSelect;
