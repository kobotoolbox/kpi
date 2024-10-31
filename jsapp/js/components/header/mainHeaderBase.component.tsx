import React from 'react';
import bem, {makeBem} from 'js/bem';

bem.MainHeader = makeBem(null, 'main-header', 'header');
bem.MainHeader__icon = makeBem(bem.MainHeader, 'icon');
bem.MainHeader__title = makeBem(bem.MainHeader, 'title');

interface MainHeaderBaseProps {
  children: React.ReactNode;
}

/**
 * A shell component that allows to display different things in the app header.
 * It is empty by default.
 */
export default class MainHeaderBase extends React.Component<MainHeaderBaseProps> {
  render() {
    return (
      <bem.MainHeader className='mdl-layout__header'>
        <div className='mdl-layout__header-row'>
          {this.props.children}
        </div>
      </bem.MainHeader>
    );
  }
}
