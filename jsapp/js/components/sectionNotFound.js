import React from 'react';
import bem from 'js/bem';
import CenteredMessage from 'js/components/common/centeredMessage.component';

export default class SectionNotFound extends React.Component {
  render() {
    return (
      <bem.FormView m='ui-panel'>
        <CenteredMessage message={t('Section not found')} />
      </bem.FormView>
    );
  }
}
