import React, {useState, useEffect} from 'react';
import styles from './usageProjectBreakdown.module.scss';
import {Link} from 'react-router-dom';
import {ROUTES} from 'jsapp/js/router/routerConstants';
import AssetStatusBadge from 'jsapp/js/components/common/assetStatusBadge';
import LoadingSpinner from 'jsapp/js/components/common/loadingSpinner';
import prettyBytes from 'pretty-bytes';
import type {AssetUsage} from 'js/account/usage/usage.api';
import {getAssetUsageForOrganization} from 'js/account/usage/usage.api';
import {USAGE_ASSETS_PER_PAGE} from 'jsapp/js/constants';
import SortableProjectColumnHeader from 'jsapp/js/projects/projectsTable/sortableProjectColumnHeader';
import type {ProjectFieldDefinition} from 'jsapp/js/projects/projectViews/constants';
import type {ProjectsTableOrder} from 'jsapp/js/projects/projectsTable/projectsTable';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const data = await getAssetUsageForOrganization(currentPage, order);
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

    fetchData();
  }, [currentPage, order]);

  if (loading) {
    return <LoadingSpinner />;
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

  return (
    <div className={styles.root}>
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
            <th className={styles.wrap}>{t('Submissions (Total)')}</th>
            <th className={styles.wrap}>
              {t('Submissions (This billing period)')}
            </th>
            <th>{t('Data Storage')}</th>
            <th>{t('Transcript Minutes')}</th>
            <th>{t('Translation characters')}</th>
            <th className={styles.badge}>
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
            {projectData.results.map((project) => (
              <tr key={project.asset}>
                <td>
                  <Link
                    className={styles.link}
                    to={ROUTES.FORM_SUMMARY.replace(':uid', project.uid)}
                  >
                    {project.asset__name}
                  </Link>
                </td>
                <td>{project.submission_count_all_time.toLocaleString()}</td>
                <td className={styles.currentMonth}>
                  {project.submission_count_current_month.toLocaleString()}
                </td>
                <td>{prettyBytes(project.storage_bytes)}</td>
                <td>
                  {project.nlp_usage_current_month.total_nlp_asr_seconds.toLocaleString()}
                </td>
                <td>
                  {project.nlp_usage_current_month.total_nlp_mt_characters.toLocaleString()}
                </td>
                <td className={styles.badge}>
                  <AssetStatusBadge
                    deploymentStatus={project.deployment_status}
                  />
                </td>
              </tr>
            ))}
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
