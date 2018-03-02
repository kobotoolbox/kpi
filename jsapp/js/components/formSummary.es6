import React from 'react';
import ReactDOM from 'react-dom';
import reactMixin from 'react-mixin';
import PropTypes from 'prop-types';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import { Link } from 'react-router';
import {dataInterface} from '../dataInterface';
import stores from '../stores';
import mixins from '../mixins';
import bem from '../bem';

import DocumentTitle from 'react-document-title';
import moment from 'moment';
import Chart from 'chart.js';

import {
  assign, t, formatTime, formatDate, stringToColor
} from '../utils';


class FormSummary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      subsCurrentPeriod: '',
      subsPreviousPeriod: '',
      lastSubmission: false,
      chartVisible: false,
      chart: {},
      chartPeriod: 'week'
    };
    this.submissionsChart = false;
    autoBind(this);
  }
  componentDidUpdate(prevProps, prevState) {
    if(!this.submissionsChart) {
      this.createChart();
    }
    if ((prevState.chartPeriod != this.state.chartPeriod) || (this.props.params != prevProps.params)) {
      if (this.state.permissions && this.userCan('view_submissions', this.state)) {
        this.prep();
      }
    }
  }
  prep() {
    this.getLatestSubmissionTime(this.props.params.assetid);
    this.prepSubmissions(this.props.params.assetid);    
  }
  createChart() {
    Chart.defaults.global.elements.rectangle.backgroundColor = 'rgba(61, 194, 212, 0.6)';
    var opts = {
      type: 'bar',
      options: {
        maintainAspectRatio: false,
        responsive: true,
        events: [''],
        legend: {
          display: false
        },
        scales: {
          yAxes: [{
            ticks: {
              beginAtZero: true,
              userCallback: function(label, index, labels) {
                if (Math.floor(label) === label) {return label;}
              },
            }
          }],
        },
      }
    };

    const canvas = ReactDOM.findDOMNode(this.refs.canvas);
    if (canvas) {
      this.submissionsChart = new Chart(canvas, opts);
      this.prep();
    }
  }
  prepSubmissions(assetid) {
    var wkStart = this.state.chartPeriod == 'week' ? moment().subtract(6, 'days') : moment().subtract(30, 'days');
    var lastWeekStart = this.state.chartPeriod == 'week' ? moment().subtract(13, 'days') : moment().subtract(60, 'days');
    var startOfWeek = moment().startOf('week');

    const query = `query={"_submission_time": {"$gte":"${wkStart.toISOString()}"}}&fields=["_id","_submission_time"]`;
    dataInterface.getSubmissionsQuery(assetid, query).done((thisWeekSubs) => {
      var subsCurrentPeriod = thisWeekSubs.length;

      const q2 = `query={"_submission_time": {"$gte":"${lastWeekStart.toISOString()}"}}&fields=["_id"]`;
      dataInterface.getSubmissionsQuery(assetid, q2).done((d) => {
        if (subsCurrentPeriod > 0) {
          if (this.state.chartPeriod == 'week')
            var subsPerDay = [0,0,0,0,0,0,0];
          else
            var subsPerDay = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];

          thisWeekSubs.forEach(function(s, i){
            var d = moment(s._submission_time);
            var diff = d.diff(wkStart, 'days');
            subsPerDay[diff] += 1;
          });

          var dayLabels = [];
          var day = wkStart;
          var today = moment();

          while (day <= today) {            
            dayLabels.push(day.format('DD MMM'));
            day = day.clone().add(1, 'd');
          }

          if (this.submissionsChart.data) {
            this.submissionsChart.data.labels = dayLabels;
            this.submissionsChart.data.datasets = [{data: subsPerDay}];
            this.submissionsChart.update();
          }
        }

        this.setState({
          subsPreviousPeriod: d.length - subsCurrentPeriod,
          subsCurrentPeriod: subsCurrentPeriod,
          chartVisible: subsCurrentPeriod ? true : false
        });
      });
    });

  } 
  getLatestSubmissionTime(assetid) {
    const fq = ['_id', 'end'];
    const sort = [{id: '_id', desc: true}];
    dataInterface.getSubmissions(assetid, 1, 0, sort, fq).done((data) => {
      if (data.length)
        this.setState({lastSubmission: data[0]['end']});
      else 
        this.setState({lastSubmission: false});
    });
  }
  renderSubmissionsGraph() {
    return (
      <bem.FormView__row m='summary-submissions'>
        <bem.FormView__cell m='label'>
          {t('Submissions')}
        </bem.FormView__cell>
        <bem.FormView__cell m={['box']}>
          <bem.FormView__cell m='subs-graph'>
            <bem.FormView__cell m='subs-graph-toggle'>
              <a onClick={this.showGraphWeek} className={this.state.chartPeriod=='week' ? 'active' : ''}>
                {t('Past 7 days')}
              </a>
              <a onClick={this.showGraphMonth} className={this.state.chartPeriod=='month' ? 'active' : ''}>
                {t('Past 31 days')}
              </a>
            </bem.FormView__cell>
            <bem.FormView__cell m={`summary-chart`} className={this.state.subsCurrentPeriod ? 'active' : 'inactive'}>
              <canvas ref="canvas" className={this.state.chartVisible ? 'visible' : ''}/>
            </bem.FormView__cell>
            <bem.FormView__cell m={`chart-no-data`}>
              <span>{t('No chart data available for current period.')}</span>
            </bem.FormView__cell>
          </bem.FormView__cell>
          <bem.FormView__group m={['submission-stats']}>
            <bem.FormView__cell>
              <span className="subs-graph-number">{this.state.subsCurrentPeriod}</span>
              <bem.FormView__label>
                {this.state.chartPeriod=='week' && 
                  `${t('Today')} - ${formatDate(moment().subtract(6, 'days'))}`
                }
                {this.state.chartPeriod!='week' && 
                  `${t('Today')} - ${formatDate(moment().subtract(30, 'days'))}`
                }
              </bem.FormView__label>
            </bem.FormView__cell>
            <bem.FormView__cell>
              <span className="subs-graph-number">{this.state.subsPreviousPeriod}</span>
              <bem.FormView__label>
                {this.state.chartPeriod=='week' && 
                  `${formatDate(moment().subtract(7, 'days'))} - ${formatDate(moment().subtract(13, 'days'))}`
                }
                {this.state.chartPeriod!='week' && 
                  `${formatDate(moment().subtract(31, 'days'))} - ${formatDate(moment().subtract(60, 'days'))}`
                }
              </bem.FormView__label>
            </bem.FormView__cell>
            <bem.FormView__cell>
              <span className="subs-graph-number">{this.state.deployment__submission_count}</span>
              <bem.FormView__label>{t('Total')}</bem.FormView__label>
            </bem.FormView__cell>
          </bem.FormView__group>
        </bem.FormView__cell>
      </bem.FormView__row>
    );
  }
  showGraphWeek() {
    this.setState({chartPeriod: 'week'});
  }
  showGraphMonth() {
    this.setState({chartPeriod: 'month'});
  }
  renderQuickLinks() {
    return (
      <bem.FormView__cell m='data-tabs'> 
        <Link 
          to={`/forms/${this.state.uid}/landing`}
          key={'landing'} 
          className={`form-view__tab`}
          data-path={`/forms/${this.state.uid}/landing`}
          onClick={this.triggerRefresh}>
            <i className='k-icon-projects' />
            {t('Collect data')}
            <i className='fa fa-angle-right' />
        </Link>
        {this.userCan('change_asset', this.state) &&
          <bem.PopoverMenu__link onClick={this.sharingModal}>
            <i className="k-icon-share"/>
            {t('Share form')}
            <i className='fa fa-angle-right' />
          </bem.PopoverMenu__link>
        }
        {this.userCan('change_asset', this.state) &&
          <Link 
            to={`/forms/${this.state.uid}/edit`}
            key={'edit'} 
            className={`form-view__tab`}
            data-path={`/forms/${this.state.uid}/edit`}
            onClick={this.triggerRefresh}>
              <i className='k-icon-edit' />
              {t('Edit form')}
              <i className='fa fa-angle-right' />
          </Link>
        }
        <bem.PopoverMenu__link onClick={this.enketoPreviewModal}>
          <i className="k-icon-view" />
          {t('Preview form')}
          <i className='fa fa-angle-right' />
        </bem.PopoverMenu__link>
      </bem.FormView__cell>
    );
  }
  renderDataTabs() {
    const sideTabs = [
      {label: t('Reports'), icon: 'k-icon-report', path: `/forms/${this.state.uid}/data/report`},
      {label: t('Reports (legacy)'), icon: 'k-icon-report', path: `/forms/${this.state.uid}/data/report-legacy`, className: 'is-edge'},
      {label: t('Table'), icon: 'k-icon-table', path: `/forms/${this.state.uid}/data/table`},
      {label: t('Gallery'), icon: 'k-icon-photo-gallery', path: `/forms/${this.state.uid}/data/gallery`},
      {label: t('Downloads'), icon: 'k-icon-download', path: `/forms/${this.state.uid}/data/downloads`},
      {label: t('Map'), icon: 'k-icon-map-view', path: `/forms/${this.state.uid}/data/map`},
    ];

    return (
      <bem.FormView__cell m='data-tabs'> 
        { sideTabs.map((item, ind) => 
          <Link 
            to={item.path}
            key={ind} 
            activeClassName='active'
            onlyActiveOnIndex={true}
            className={`form-view__tab ${item.className || ''}`}
            data-path={item.path}
            onClick={this.triggerRefresh}>
              <i className={item.icon} />
              {item.label}
              <i className={'fa fa-angle-right'} />
          </Link>
        )}
      </bem.FormView__cell>
    );
  }
  sharingModal (evt) {
    evt.preventDefault();
    stores.pageState.showModal({
      type: 'sharing', 
      assetid: this.state.uid
    });
  }
  enketoPreviewModal (evt) {
    evt.preventDefault();
    stores.pageState.showModal({
      type: 'enketo-preview',
      assetid: this.state.uid
    });
  }
  renderTeam() {
    var team = [];
    this.state.permissions.forEach(function(p){
      if (p.user__username && !team.includes(p.user__username) && p.user__username != 'AnonymousUser')
        team.push(p.user__username);
    });

    if (team.length < 2)
      return false;

    return (
      <bem.FormView__row m='team'>
        <bem.FormView__cell m='label'>
          {t('Team members')}
        </bem.FormView__cell>
        {this.userCan('change_asset', this.state) && 
          <a onClick={this.sharingModal} className='team-sharing-button'>
            <i className="k-icon-share" />
          </a>
        }
        <bem.FormView__cell m={['box', 'padding']}>
          { team.map((username, ind) => 
            <bem.UserRow key={ind}>
              <bem.UserRow__avatar data-tip={username}>
                <bem.AccountBox__initials style={{background: `#${stringToColor(username)}`}}>
                  {username.charAt(0)}
                </bem.AccountBox__initials>
              </bem.UserRow__avatar>
            </bem.UserRow>
          )}
        </bem.FormView__cell>
      </bem.FormView__row>
    );    
  }
  render () {
    let docTitle = this.state.name || t('Untitled');

    if (!this.state.permissions) {
      return (
        <bem.Loading>
          <bem.Loading__inner>
            <i />
            {t('loading...')}
          </bem.Loading__inner>
        </bem.Loading>
      );
    }

    if (!this.userCan('view_submissions', this.state)) {
      return (
        <bem.Loading>
          <bem.Loading__inner>
            <h3>
              {t('Access Denied')}
            </h3>
            {t('You do not have permission to view this page.')}
          </bem.Loading__inner>
        </bem.Loading>
      );
    }

    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <bem.FormView m='summary'>
          <bem.FormView__column m='left'>
            {(this.state.settings && (this.state.settings.country || this.state.settings.sector || this.state.settings.description)) && 
              <bem.FormView__row m='summary-description'>
                <bem.FormView__cell m='label'>
                  {t('Description')}
                </bem.FormView__cell>
                <bem.FormView__cell m={['box']}>
                  {(this.state.settings.country || this.state.settings.sector) && 
                    <bem.FormView__group m={['items', 'description-cols']}>
                      {this.state.settings.country && 
                        <bem.FormView__cell>
                          <bem.FormView__label m='country'>{t('Project country')}</bem.FormView__label>
                          {this.state.settings.country.label}
                        </bem.FormView__cell>
                      }
                      {this.state.settings.sector && 
                        <bem.FormView__cell>
                          <bem.FormView__label m='sector'>{t('Sector')}</bem.FormView__label>
                          {this.state.settings.sector.label}
                        </bem.FormView__cell>
                      }
                    </bem.FormView__group>
                  }
                  {this.state.settings.description && 
                    <bem.FormView__cell m='description'>
                      {this.state.settings.description}
                    </bem.FormView__cell>
                  }
                </bem.FormView__cell>
              </bem.FormView__row>
            }
            {this.renderSubmissionsGraph()}
           </bem.FormView__column>

          <bem.FormView__column m='right'>
            <bem.FormView__row m='quick-links'>
              <bem.FormView__cell m='label'>
                {t('Quick Links')}
              </bem.FormView__cell>
              <bem.FormView__cell m='box'>
                {this.renderQuickLinks()}
              </bem.FormView__cell>
            </bem.FormView__row>
            <bem.FormView__row m='summary-details'>
              <bem.FormView__cell m='label'>
                {t('Form details')}
              </bem.FormView__cell>
              <bem.FormView__cell m={['box']}>
                <bem.FormView__group m={['items', 'summary-details-cols']}>
                  <bem.FormView__cell>
                    <bem.FormView__label>{t('Last modified')}</bem.FormView__label>
                    {formatTime(this.state.date_modified)}
                  </bem.FormView__cell>
                  {this.state.lastSubmission &&
                    <bem.FormView__cell>
                      <bem.FormView__label>{t('Latest submission')}</bem.FormView__label>
                      {formatTime(this.state.lastSubmission)}
                    </bem.FormView__cell>
                  }
                  {this.state.summary &&
                    <bem.FormView__cell>
                      <bem.FormView__label>{t('Questions')}</bem.FormView__label>
                      {this.state.summary.row_count}
                    </bem.FormView__cell>
                  }

                  {this.state.summary && this.state.summary.languages && this.state.summary.languages.length > 1 &&
                    <bem.FormView__cell>
                      <bem.FormView__label>{t('Languages')}</bem.FormView__label>
                      {this.state.summary.languages.map((l, i)=>{
                        return (
                          <bem.FormView__cell key={`lang-${i}`} data-index={i}>
                            {l}
                          </bem.FormView__cell>
                        );
                      })}
                    </bem.FormView__cell>
                  }
                </bem.FormView__group>
              </bem.FormView__cell>
            </bem.FormView__row>
            {this.state.deployment__submission_count > 0 &&
              <bem.FormView__row m='data-links'>
                <bem.FormView__cell m='label'>
                  {t('Data')}
                </bem.FormView__cell>
                <bem.FormView__cell m='box'>
                  {this.renderDataTabs()}
                </bem.FormView__cell>
              </bem.FormView__row>
            }
            {this.renderTeam()}

          </bem.FormView__column>
        </bem.FormView>
      </DocumentTitle>
      );
  }

}

reactMixin(FormSummary.prototype, mixins.dmix);
reactMixin(FormSummary.prototype, mixins.permissions);
reactMixin(FormSummary.prototype, Reflux.ListenerMixin);

export default FormSummary;