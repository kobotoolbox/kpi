import React from 'react'

import { Link } from 'react-router-dom'
import bem, { makeBem } from '#/bem'
import { PROJECTS_ROUTES } from '#/router/routerConstants'

bem.Header = makeBem(null, 'header')
bem.Header__logo = makeBem(bem.Header, 'logo', 'span')

/**
 * Instance logo to be displayed in the app header.
 * Note: when considering a refactor of this code (please do!) be careful to
 * take into account all the nuances of this, like the fact the logo is
 * configurable in the admin page.
 */
export default function MainHeaderLogo() {
  return (
    <span className='mdl-layout__title'>
      <Link to={PROJECTS_ROUTES.MY_PROJECTS}>
        <bem.Header__logo />
      </Link>
    </span>
  )
}
