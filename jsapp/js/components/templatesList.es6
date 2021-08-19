/*
 * Displays a list of templates with option to select one.
 * Add `onSelectTemplate` callback function to get selected uid:
 * `<TemplatesList onSelectTemplate={this.handleTemplateSelected}/>`
 */

import React from 'react';
import Reflux from 'reflux';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {stores} from '../stores';
import {dataInterface} from '../dataInterface';
import {formatTime} from 'utils';
import {getAssetOwnerDisplayName} from 'js/assetUtils';
import './templatesList.scss';

class TemplatesList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isLoading: false,
      templates: [],
      templatesCount: 0,
      selectedTemplateUid: null,
      currentAccountUsername: stores.session.currentAccount ? stores.session.currentAccount.username : null
    };
    autoBind(this);
  }

  componentDidMount() {
    this.fetchTemplates();
  }

  fetchTemplates() {
    this.setState({isLoading: true});
    dataInterface.listTemplates().then((data) => {
      this.setState({
        templates: data.results,
        templatesCount: data.count,
        isLoading: false
      });
    });
  }

  onSelectedTemplateChange(evt) {
    this.setState({selectedTemplateUid: evt.target.value});
    if (typeof this.props.onSelectTemplate === 'function') {
      this.props.onSelectTemplate(evt.target.value);
    }
  }

  render() {
    if (this.state.isLoading) {
      return (<LoadingSpinner/>);
    } else if (this.state.templatesCount === 0) {
      return (
        <bem.FormView__cell>
          {t('You have no templates. Go to Library and create some.')}
        </bem.FormView__cell>
      );
    } else {
      return (
        <bem.TemplatesList>
          <bem.TemplatesList__header className={['templates-list__row']}>
            <bem.TemplatesList__column m='name'>
              {t('Template name')}
            </bem.TemplatesList__column>
            <bem.TemplatesList__column m='owner'>
              {t('Owner')}
            </bem.TemplatesList__column>
            <bem.TemplatesList__column m='date'>
              {t('Last modified')}
            </bem.TemplatesList__column>
            <bem.TemplatesList__column m='questions'>
              {t('Questions')}
            </bem.TemplatesList__column>
          </bem.TemplatesList__header>

          {this.state.templates.map((template) => {
            const htmlId = `selected_template_${template.uid}`;

            return (
              <bem.TemplatesList__template
                key={template.uid}
                htmlFor={htmlId}
                className={['templates-list__row', this.state.selectedTemplateUid === template.uid ? 'selected' : '']}
              >
                <bem.TemplatesList__column m='name'>
                  {template.name}
                </bem.TemplatesList__column>
                <bem.TemplatesList__column m='owner'>
                  {getAssetOwnerDisplayName(template.owner__username)}
                </bem.TemplatesList__column>
                <bem.TemplatesList__column m='date'>
                  {formatTime(template.date_modified)}
                </bem.TemplatesList__column>
                <bem.TemplatesList__column m='questions'>
                  {template.summary.row_count}
                </bem.TemplatesList__column>

                <bem.TemplatesList__templateRadio
                  type='radio'
                  name='selected_template'
                  id={htmlId}
                  value={template.uid}
                  checked={this.state.selectedTemplateUid === template.uid}
                  onChange={this.onSelectedTemplateChange}
                 />
              </bem.TemplatesList__template>
            );
          })}
        </bem.TemplatesList>
      );
    }
  }
}

reactMixin(TemplatesList.prototype, Reflux.ListenerMixin);

export default TemplatesList;
