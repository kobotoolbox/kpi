import React from 'react'

import { QueryClientProvider } from '@tanstack/react-query'
import DocumentTitle from 'react-document-title'
import bem from '#/bem'
import AccountMenu from '#/components/header/accountMenu'
import MainHeaderBase from '#/components/header/mainHeaderBase.component'
import MainHeaderLogo from '#/components/header/mainHeaderLogo.component'
import { queryClient } from '../query/queryClient'
import ToasterConfig from '../toasterConfig'
import { Tracking } from './useTracking'

interface BasicLayoutProps {
  children: React.ReactNode
}

/**
 * This is a base component that accepts any children. It has the minimum root
 * layout elements: Main header and place underneath it for content.
 */
export default function BasicLayout(props: BasicLayoutProps) {
  return (
    <DocumentTitle title='KoboToolbox'>
      <QueryClientProvider client={queryClient}>
        <Tracking />
        <ToasterConfig />
        <div className='header-stretch-bg' />

        <bem.PageWrapper className='mdl-layout mdl-layout--fixed-header'>
          <MainHeaderBase>
            <MainHeaderLogo />
            <AccountMenu />
          </MainHeaderBase>

          <bem.PageWrapper__content className='mdl-layout__content'>{props.children}</bem.PageWrapper__content>
        </bem.PageWrapper>
      </QueryClientProvider>
    </DocumentTitle>
  )
}
