import autoBind from 'react-autobind';
import React from 'react';

import {bem} from 'js/bem';

class TableMediaPreview extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isLoading: false,
    };

    autoBind(this);
  }

  renderHeader() {
    console.log(this.props.questionIcon);
    return (
      <header>
        <i className={this.props.questionIcon.join(' ')}/>
        <label>
          {this.props.mediaName}
        </label>
        <bem.KoboLightButton
          m='blue'
        >
          <i className='k-icon k-icon-download'/>
          {t('download')}
        </bem.KoboLightButton>
      </header>
    );
  }

  render() {
    return (
      this.renderHeader()
    );
  }
}

export default TableMediaPreview;
