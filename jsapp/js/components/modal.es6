import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import {dataInterface} from '../dataInterface';
import actions from '../actions';
import bem from '../bem';
import ui from '../ui';
import stores from '../stores';
import mixins from '../mixins';
import {hashHistory} from 'react-router';

import {
  t,
  assign,
  notify
} from '../utils';

import {
  PROJECT_SETTINGS_CONTEXTS,
  MODAL_TYPES
} from '../constants';

import {ProjectSettings} from '../components/formEditors';
import SharingForm from '../components/sharingForm';
import Submission from '../components/submission';
import TableColumnFilter from '../components/tableColumnFilter';

class Modal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      enketopreviewlink: false,
      error: false,
      modalClass: false
    };
    autoBind(this);
  }
  componentDidMount () {
    var type = this.props.params.type;
    switch(type) {
      case MODAL_TYPES.SHARING:
        this.setModalTitle(t('Sharing Permissions'));
        break;

      case MODAL_TYPES.UPLOADING_XLS:
        var filename = this.props.params.filename || '';
        this.setState({
          title: t('Uploading XLS file'),
          message: t('Uploading: ') + filename
        });
        break;

      case MODAL_TYPES.NEW_FORM:
        // title is set by formEditors
        break;

      case MODAL_TYPES.ENKETO_PREVIEW:
        var uid = this.props.params.assetid;
        stores.allAssets.whenLoaded(uid, function(asset){
          actions.resources.createSnapshot({
            asset: asset.url,
          });
        });
        this.listenTo(stores.snapshots, this.enketoSnapshotCreation);

        this.setState({
          title: t('Form Preview'),
          modalClass: 'modal--large'
        });
        break;

      case MODAL_TYPES.SUBMISSION:
        this.setState({
          title: this.submissionTitle(this.props),
          modalClass: 'modal--large modal-submission',
          sid: this.props.params.sid
        });
        break;

      case MODAL_TYPES.REPLACE_PROJECT:
        // title is set by formEditors
        break;

      case MODAL_TYPES.TABLE_COLUMNS:
        this.setModalTitle(t('Table display options'));
        break;

      default:
        console.error(`Unknown modal type: "${type}"!`);
    }
  }
  setModalTitle(title) {
    this.setState({title: title});
  }
  enketoSnapshotCreation (data) {
    if (data.success) {
      this.setState({
        enketopreviewlink: data.enketopreviewlink
      });
    } else {
      this.setState({
        message: data.error,
        error: true
      });
    }
  }
  componentWillReceiveProps(nextProps) {
    if (nextProps.params && nextProps.params.sid) {
      this.setState({
        title: this.submissionTitle(nextProps),
        sid: nextProps.params.sid
      });
    }

    if (this.props.params.type != nextProps.params.type && nextProps.params.type === MODAL_TYPES.UPLOADING_XLS) {
      var filename = nextProps.params.filename || '';
      this.setState({
        title: t('Uploading XLS file'),
        message: t('Uploading: ') + filename
      });
    }
    if (nextProps.params && !nextProps.params.sid) {
      this.setState({ sid: false });
    }
  }
  submissionTitle(props) {
    let title = t('Submission Record'),
        p = props.params,
        sid = parseInt(p.sid);

    if (p.tableInfo) {
      let index = p.ids.indexOf(sid) + (p.tableInfo.pageSize * p.tableInfo.currentPage) + 1;
      title =  `${t('Submission Record')} (${index} ${t('of')} ${p.tableInfo.resultsTotal})`;
    } else {
      let index = p.ids.indexOf(sid);
      title =  `${t('Submission Record')} (${index} ${t('of')} ${p.ids.length})`;
    }

    return title;
  }
  render() {
    return (
      <ui.Modal
        open
        onClose={()=>{stores.pageState.hideModal()}}
        title={this.state.title}
        className={this.state.modalClass}
      >
        <ui.Modal.Body>
            { this.props.params.type == MODAL_TYPES.SHARING &&
              <SharingForm uid={this.props.params.assetid} />
            }
            { this.props.params.type == MODAL_TYPES.NEW_FORM &&
              <ProjectSettings
                context={PROJECT_SETTINGS_CONTEXTS.NEW}
                onSetModalTitle={this.setModalTitle}
              />
            }
            { this.props.params.type == MODAL_TYPES.REPLACE_PROJECT &&
              <ProjectSettings
                context={PROJECT_SETTINGS_CONTEXTS.REPLACE}
                onSetModalTitle={this.setModalTitle}
                formAsset={this.props.params.asset}
              />
            }
            { this.props.params.type == MODAL_TYPES.ENKETO_PREVIEW && this.state.enketopreviewlink &&
              <div className='enketo-holder'>
                <iframe src={this.state.enketopreviewlink} />
              </div>
            }
            { this.props.params.type == MODAL_TYPES.ENKETO_PREVIEW && !this.state.enketopreviewlink &&
              <bem.Loading>
                <bem.Loading__inner>
                  <i />
                  {t('loading...')}
                </bem.Loading__inner>
              </bem.Loading>
            }
            { this.props.params.type == MODAL_TYPES.ENKETO_PREVIEW && this.state.error &&
              <div>
                {this.state.message}
              </div>
            }
            { this.props.params.type == MODAL_TYPES.UPLOADING_XLS &&
              <div>
                <bem.Loading>
                  <bem.Loading__inner>
                    <i />
                    <bem.Loading__msg>{this.state.message}</bem.Loading__msg>
                  </bem.Loading__inner>
                </bem.Loading>
              </div>
            }
            { this.props.params.type == MODAL_TYPES.SUBMISSION && this.state.sid &&
              <Submission sid={this.state.sid}
                          asset={this.props.params.asset}
                          ids={this.props.params.ids}
                          tableInfo={this.props.params.tableInfo || false} />
            }
            { this.props.params.type == MODAL_TYPES.SUBMISSION && !this.state.sid &&
              <div>
                <bem.Loading>
                  <bem.Loading__inner>
                    <i />
                  </bem.Loading__inner>
                </bem.Loading>
              </div>
            }
            { this.props.params.type == MODAL_TYPES.TABLE_COLUMNS &&
              <TableColumnFilter asset={this.props.params.asset}
                                 columns={this.props.params.columns}
                                 getColumnLabel={this.props.params.getColumnLabel}
                                 overrideLabelsAndGroups={this.props.params.overrideLabelsAndGroups} />
            }

          </ui.Modal.Body>
        </ui.Modal>
      )
  }
};

reactMixin(Modal.prototype, Reflux.ListenerMixin);

export default Modal;
