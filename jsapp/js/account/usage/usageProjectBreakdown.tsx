import type React from 'react';
import {useState, useEffect, useContext} from 'react';
import styles from './usageProjectBreakdown.module.scss';
import {Link} from 'react-router-dom';
import {ROUTES} from 'jsapp/js/router/routerConstants';
import AssetStatusBadge from 'jsapp/js/components/common/assetStatusBadge';
import LoadingSpinner from 'jsapp/js/components/common/loadingSpinner';
import prettyBytes from 'pretty-bytes';
import type {AssetUsage, AssetWithUsage} from 'js/account/usage/usage.api';
import {getOrgAssetUsage} from 'js/account/usage/usage.api';
import {USAGE_ASSETS_PER_PAGE} from 'jsapp/js/constants';
import SortableProjectColumnHeader from 'jsapp/js/projects/projectsTable/sortableProjectColumnHeader';
import type {ProjectFieldDefinition} from 'jsapp/js/projects/projectViews/constants';
import type {ProjectsTableOrder} from 'jsapp/js/projects/projectsTable/projectsTable';
import {convertSecondsToMinutes} from 'jsapp/js/utils';
import {UsageContext} from './useUsage.hook';
import Button from 'js/components/common/button';
import Icon from 'js/components/common/icon';
import {useOrganizationQuery} from 'js/account/organization/organizationQuery';

type ButtonType = 'back' | 'forward';

const ProjectBreakdown = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [projectData, setProjectData] = useState<AssetUsage>({
    count: '0',
    next: null,
    previous: null,
    results: [],
  });
  const [order, setOrder] = useState({});
  const [showIntervalBanner, setShowIntervalBanner] = useState(true);
  const [loading, setLoading] = useState(true);
  const [usage] = useContext(UsageContext);
  const orgQuery = useOrganizationQuery();

  useEffect(() => {
    async function fetchData(orgId: string) {
      const data = await getOrgAssetUsage(
        currentPage,
        orgId,
        order
      );
      const updatedResults = data.results.map((projectResult) => {
        const assetParts = projectResult.asset.split('/');
        const uid = assetParts[assetParts.length - 2];
        return {
          ...projectResult,
          uid: uid,
        };
      });

      setProjectData({
        ...data,
        results: updatedResults,
      });
      setLoading(false);
    }

    if (orgQuery.data) {
      fetchData(orgQuery.data.id);
    }
  }, [currentPage, order, orgQuery.data]);

  if (loading) {
    return <LoadingSpinner />;
  }

  function dismissIntervalBanner() {
    setShowIntervalBanner(false);
  }

  const calculateRange = (): string => {
    const totalProjects = parseInt(projectData.count);
    let startRange = (currentPage - 1) * USAGE_ASSETS_PER_PAGE + 1;
    if (parseInt(projectData.count) === 0) {
      startRange = 0;
    }
    const endRange = Math.min(
      currentPage * USAGE_ASSETS_PER_PAGE,
      totalProjects
    );
    return `${startRange}-${endRange} of ${totalProjects}`;
  };

  const handleClick = async (
    event: React.MouseEvent<HTMLButtonElement>,
    buttonType: ButtonType
  ): Promise<void> => {
    event.preventDefault();

    try {
      if (buttonType === 'back' && projectData.previous) {
        setCurrentPage((prevPage) => Math.max(prevPage - 1, 1));
      } else if (buttonType === 'forward' && projectData.next) {
        setCurrentPage((prevPage) =>
          Math.min(
            prevPage + 1,
            Math.ceil(parseInt(projectData.count) / USAGE_ASSETS_PER_PAGE)
          )
        );
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const isActiveBack = currentPage > 1;
  const isActiveForward =
    currentPage <
    Math.ceil(parseInt(projectData.count) / USAGE_ASSETS_PER_PAGE);

  const usageName: ProjectFieldDefinition = {
    name: 'name',
    label: t('##count## Projects').replace('##count##', projectData.count),
    apiFilteringName: 'name',
    apiOrderingName: 'name',
    availableConditions: [],
  };
  const usageStatus: ProjectFieldDefinition = {
    name: 'status',
    label: 'Status',
    apiFilteringName: '_deployment_status',
    apiOrderingName: '_deployment_status',
    availableConditions: [],
  };

  const updateOrder = (newOrder: ProjectsTableOrder) => {
    setOrder(newOrder);
  };

  const renderProjectRow = (project: AssetWithUsage) => {
    const periodSubmissions =
      project.submission_count_current_period.toLocaleString();

    const periodASRSeconds = convertSecondsToMinutes(
      project.nlp_usage_current_period.total_nlp_asr_seconds
    ).toLocaleString();

    const periodMTCharacters =
      project.nlp_usage_current_period.total_nlp_mt_characters.toLocaleString();

    return (
      <tr key={project.asset}>
        <td dir='auto'>
          <Link
            className={styles.link}
            to={ROUTES.FORM_SUMMARY.replace(':uid', project.uid)}
          >
            {project.asset__name}
          </Link>
        </td>
        <td>{project.submission_count_all_time.toLocaleString()}</td>
        <td className={styles.currentMonth}>{periodSubmissions}</td>
        <td>{prettyBytes(project.storage_bytes)}</td>
        <td>{periodASRSeconds}</td>
        <td>{periodMTCharacters}</td>
        <td className={styles.badge}>
          <AssetStatusBadge deploymentStatus={project.deployment_status} />
        </td>
      </tr>
    );
  };

  return (
    <div className={styles.root}>
      {showIntervalBanner && (
        <div className={styles.intervalBanner}>
          <div className={styles.intervalBannerContent}>
            <Icon name={'information'} size='m' color='blue' />
            <div className={styles.intervalBannerText}>
              {t(
                'Submissions, transcription minutes, and translation characters reflect usage for the current ##INTERVAL## based on your plan settings.'
              ).replace('##INTERVAL##', usage.trackingPeriod)}
            </div>
          </div>
          <Button
            size='s'
            type='text'
            startIcon='close'
            onClick={dismissIntervalBanner}
          />
        </div>
      )}
      <table>
        <thead className={styles.headerFont}>
          <tr>
            <th className={styles.projects}>
              <SortableProjectColumnHeader
                styling={false}
                field={usageName}
                orderableFields={['name', 'status']}
                order={order}
                onChangeOrderRequested={updateOrder}
              />
            </th>
            <th>{t('Submissions (Total)')}</th>
            <th>{t('Submissions')}</th>
            <th>{t('Data storage')}</th>
            <th>{t('Transcript minutes')}</th>
            <th>{t('Translation characters')}</th>
            <th>
              <SortableProjectColumnHeader
                styling={false}
                field={usageStatus}
                orderableFields={['name', 'status']}
                order={order}
                onChangeOrderRequested={updateOrder}
              />
            </th>
          </tr>
        </thead>
        {parseInt(projectData.count) === 0 ? (
          <tbody>
            <tr>
              <td colSpan={7} style={{border: 'none'}}>
                <div className={styles.emptyMessage}>
                  {t('There are no projects to display.')}
                </div>
              </td>
            </tr>
          </tbody>
        ) : (
          <tbody>
            {projectData.results.map((project) => renderProjectRow(project))}
          </tbody>
        )}
      </table>
      <nav>
        <div className={styles.pagination}>
          <button
            className={`${isActiveBack ? styles.active : ''}`}
            onClick={(e) => handleClick(e, 'back')}
          >
            <i className='k-icon k-icon-arrow-left' />
          </button>
          <span className={styles.range}>{calculateRange()}</span>
          <button
            className={`${isActiveForward ? styles.active : ''}`}
            onClick={(e) => handleClick(e, 'forward')}
          >
            <i className='k-icon k-icon-arrow-right' />
          </button>
        </div>
      </nav>
    </div>
  );
};

export default ProjectBreakdown;
