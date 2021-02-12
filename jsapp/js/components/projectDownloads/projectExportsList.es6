import React from 'react';
import autoBind from 'react-autobind';
import {bem} from 'js/bem';
import {actions} from 'js/actions';
import {renderLoading} from 'js/components/modalForms/modalHelpers.es6';

/**
 * @prop {object} asset
 */
export default class ProjectExportsList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isPending: true,
    };
    autoBind(this);
  }

  componentDidMount() {
    actions.exports.getExports.completed.listen(this.onGetExports);
    actions.exports.deleteExport.completed.listen(this.onDeleteExport);
    this.fetchExports();
  }

  onGetExports(response) {
    console.log('onGetExports', response);
    this.setState({
      isPending: false,
      exports: response,
    });
  }

  onDeleteExport(response) {
    console.log('onDeleteExports', response);
    this.setState({
      exports: response,
    });
  }

  fetchExports() {
    actions.exports.getExports(this.props.asset.uid);
  }

  deleteExport(exportUid) {
    actions.exports.deleteExport(exportUid);
  }

  renderRow(rowData, itemIndex) {
    const exportUid = 'TODO';

    return (
      <bem.SimpleTable__row key={itemIndex}>
        <bem.SimpleTable__cell>
          type
        </bem.SimpleTable__cell>

        <bem.SimpleTable__cell>
          date
        </bem.SimpleTable__cell>

        <bem.SimpleTable__cell>
          lang
        </bem.SimpleTable__cell>

        <bem.SimpleTable__cell>
          yes/no
        </bem.SimpleTable__cell>

        <bem.SimpleTable__cell>
          yes/no
        </bem.SimpleTable__cell>

        <bem.SimpleTable__cell>
          <bem.KoboLightButton m='blue'>
            <i className='k-icon k-icon-download'/>
            {t('Download')}
          </bem.KoboLightButton>

          <bem.KoboLightButton
            m={['red', 'icon-only']}
            onClick={this.deleteExport.bind(this, exportUid)}
          >
            <i className='k-icon k-icon-trash'/>
          </bem.KoboLightButton>
        </bem.SimpleTable__cell>
      </bem.SimpleTable__row>
    );
  }

  render() {
    const todoRows = [1,2,3];

    if (this.state.isPending) {
      return (
        <bem.FormView__row>
          <bem.FormView__cell>
            {renderLoading()}
          </bem.FormView__cell>
        </bem.FormView__row>
      );
    } else {
      return (
        <bem.FormView__row>
          <bem.FormView__cell m={['page-subtitle']}>
            {t('Exports')}
          </bem.FormView__cell>

          <bem.SimpleTable m='project-exports'>
            <bem.SimpleTable__header>
              <bem.SimpleTable__row>
                <bem.SimpleTable__cell>
                  {t('Type')}
                </bem.SimpleTable__cell>

                <bem.SimpleTable__cell>
                  {t('Created')}
                </bem.SimpleTable__cell>

                <bem.SimpleTable__cell>
                  {t('Language')}
                </bem.SimpleTable__cell>

                <bem.SimpleTable__cell>
                  {t('Include Groups')}
                </bem.SimpleTable__cell>

                <bem.SimpleTable__cell>
                  {t('Multiple Versions')}
                </bem.SimpleTable__cell>

                <bem.SimpleTable__cell/>
              </bem.SimpleTable__row>
            </bem.SimpleTable__header>

            <bem.SimpleTable__body>
              {todoRows.map(this.renderRow)}
            </bem.SimpleTable__body>
          </bem.SimpleTable>
        </bem.FormView__row>
      );
    }
  }
}
