import React from 'react';
import bem, {makeBem} from 'js/bem';

bem.Header = makeBem(null, 'header');
bem.Header__logo = makeBem(bem.Header, 'logo', 'span');

/**
 * Instance logo to be displayed in the app header.
 * Note: when considering a refactor of this code (please do!) be careful to
 * take into account all the nuances of this, like the fact the logo is
 * configurable in the admin page.
 */
export default function MainHeaderLogo() {
  return (
    <span className='mdl-layout__title'>
      <a href='/'>
        <bem.Header__logo />
      </a>
    </span>
  );
}
