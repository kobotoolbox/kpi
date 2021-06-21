import React from 'react';
import autoBind from 'react-autobind';
import {bem} from 'js/bem';

export const KOBO_DROPDOWN_THEMES = {};
new Set([
  'light',
  'dark',
]).forEach((codename) => {KOBO_DROPDOWN_THEMES[codename] = codename;});
Object.freeze(KOBO_DROPDOWN_THEMES);

bem.KoboDropdown = bem.create('kobo-dropdown');
bem.KoboDropdown__trigger = bem.KoboDropdown.__('trigger', 'button');
bem.KoboDropdown__menu = bem.KoboDropdown.__('menu', 'menu');
bem.KoboDropdown__menuButtonRow = bem.KoboDropdown.__('button-row', 'button');

/**
 * A generic dropdown component that accepts any content inside. If you need a
 * selector dropdown, please look at `react-select`.
 *
 * You can use some existing content elements:
 * - bem.KoboDropdown__menuButtonRow
 *
 * @prop {boolean} opened
 * @prop {function} onClose
 *
 * @prop {string} [theme] - `light` by default - one of KOBO_DROPDOWN_THEMES
 * @prop {boolean} [closeOnMenuClick] `false` by default - closes menu whenever user clicks inside it, useful for simple menu with a list of actions
 * @prop {boolean} [closeOnBlur] `false` by default - closes menu when it loses focus (e.g. user clicked outside)
 * @prop {boolean} [closeOnMouseLeave] `false` by default
 * @prop {boolean} [closeOnEsc] `false` by default
 * @prop {node} triggerContent
 * @prop {function} menuContent the content of dropdown, anything's allowed
 */
export default class KoboDropdown extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
  }

  render() {
    return (
      <bem.KoboDropdown>
        <bem.KoboDropdown__trigger>
          {this.props.triggerContent}
        </bem.KoboDropdown__trigger>

        <bem.KoboDropdown__menu>
          {this.props.menuContent}
        </bem.KoboDropdown__menu>
      </bem.KoboDropdown>
    );
  }
}
