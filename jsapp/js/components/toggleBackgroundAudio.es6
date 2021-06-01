import React from 'react';
import autoBind from 'react-autobind';
import ToggleSwitch from 'js/components/common/toggleSwitch';
import {bem} from 'js/bem';

/**
 * @prop {object} survey
 * @prop {function} onChange
 */
export default class ToggleBackgroundAudio extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      backgroundAudioEnabled: this.props.surveyHasBackgroundAudio(),
    };
    autoBind(this);
  }

  render() {
    return (
      <bem.FormBuilderBackgroundAudio>
        <ToggleSwitch
          checked={this.state.backgroundAudioEnabled}
          onChange={this.props.onChange}
        />
      </bem.FormBuilderBackgroundAudio>
    );
  }
}
