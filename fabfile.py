import os
import sys
import json
import re
import requests

from fabric.api import cd, env, prefix, run


def kobo_workon(venv_name):
    return prefix('kobo_workon %s' % venv_name)

DEPLOYMENTS = {}
IMPORTED_DEPLOYMENTS = {}
deployments_file = os.environ.get('DEPLOYMENTS_JSON', 'deployments.json')
if os.path.exists(deployments_file):
    with open(deployments_file, 'r') as f:
        IMPORTED_DEPLOYMENTS = json.load(f)
else:
    raise Exception("Cannot find deployments.json")


def exit_with_error(message):
    print message
    sys.exit(1)


def check_key_filename(deployment_configs):
    if 'key_filename' in deployment_configs and \
       not os.path.exists(deployment_configs['key_filename']):
        # Maybe the path contains a ~; try expanding that before failing
        deployment_configs['key_filename'] = os.path.expanduser(
            deployment_configs['key_filename']
        )
        if not os.path.exists(deployment_configs['key_filename']):
            exit_with_error("Cannot find required permissions file: %s" %
                            deployment_configs['key_filename'])


def setup_env(deployment_name):
    deployment = DEPLOYMENTS.get(deployment_name, {})

    if 'shared' in IMPORTED_DEPLOYMENTS:
        deployment.update(IMPORTED_DEPLOYMENTS['shared'])

    if deployment_name in IMPORTED_DEPLOYMENTS:
        deployment.update(IMPORTED_DEPLOYMENTS[deployment_name])

    env.update(deployment)
    check_key_filename(deployment)

    env.uwsgi_pidfile = os.path.join('/home', 'ubuntu', 'pids',
                                     'kobo-uwsgi-master.pid')
    env.kpi_path = os.path.join(env.home, env.kpi_path)
    env.pip_requirements_file = os.path.join(env.kpi_path,
                                             'requirements.txt')


def deploy_ref(deployment_name, ref):
    setup_env(deployment_name)
    with cd(env.kpi_path):
        run("git fetch origin")
        # Make sure we're not moving to an older codebase
        git_output = run('git rev-list {}..HEAD --count 2>&1'.format(ref))
        if int(git_output) > 0:
            raise Exception("The server's HEAD is already in front of the "
                "commit to be deployed.")
        # We want to check out a specific commit, but this does leave the HEAD
        # detached. Perhaps consider using `git reset`.
        run('git checkout {}'.format(ref))
        # Report if the working directory is unclean.
        git_output = run('git status --porcelain')
        if len(git_output):
            run('git status')
            print('WARNING: The working directory is unclean. See above.')
        run('find . -name "*.pyc" -exec rm -rf {} \;')
        run('find . -type d -empty -delete')

    with kobo_workon(env.kpi_virtualenv_name):
        run("pip install --upgrade 'pip==8.1.1' pip-tools")
        run("pip-sync '%s'" % env.pip_requirements_file)

    with cd(env.kpi_path):
        with kobo_workon(env.kpi_virtualenv_name):
            run("bower install")
            run("npm install")
            run("grunt buildall")
            run("npm run build-production")

            # KPI and KF share a virtualenv but have distinct settings modules
            with prefix('DJANGO_SETTINGS_MODULE=kobo.settings'):
                run("python manage.py syncdb")
                run("python manage.py migrate")
                run("python manage.py collectstatic --noinput")

    with cd(os.path.join(env.kpi_path, 'staticfiles')):
        run("date > LAST_UPDATE.txt")

    run("sudo restart kpi_celeryd")
    run("sudo service uwsgi reload")


# NOTE non-master branch
def deploy(deployment_name, branch='master'):
    deploy_ref(deployment_name, 'origin/{}'.format(branch))


def deploy_passing(deployment_name, branch='master'):
    ''' Deploy the latest code on the given branch that's
    been marked passing by Travis CI. '''
    print 'Asking Travis CI for the hash of the latest passing commit...'
    desired_commit = get_last_successfully_built_commit(branch)
    print 'Found passing commit {} for branch {}!'.format(desired_commit,
        branch)
    deploy_ref(deployment_name, desired_commit)


def get_last_successfully_built_commit(branch):
    raise NotImplementedError('No CI for KPI yet.')
    ''' Returns the hash of the latest successfully built commit
    on the given branch according to Travis CI. '''

    API_ENDPOINT='https://api.travis-ci.org/'
    REPO_SLUG='kobotoolbox/kpi'
    COMMON_HEADERS={'accept': 'application/vnd.travis-ci.2+json'}

    ''' Travis only lets us specify `number`, `after_number`, and `event_type`.
    It'd be great to filter by state and branch, but it seems we can't
    (http://docs.travis-ci.com/api/?http#builds). '''

    request = requests.get(
        '{}repos/{}/builds'.format(API_ENDPOINT, REPO_SLUG),
        headers=COMMON_HEADERS
    )
    if request.status_code != 200:
        raise Exception('Travis returned unexpected code {}.'.format(
            request.status_code
        ))
    response = json.loads(request.text)

    builds = response['builds']
    commits = {commit['id']: commit for commit in response['commits']}

    for build in builds:
        if build['state'] != 'passed' or build['pull_request']:
            # No interest in non-passing builds or PRs
            continue
        commit = commits[build['commit_id']]
        if commit['branch'] == branch:
            # Assumes the builds are in descending chronological order
            if re.match('^[0-9a-f]+$', commit['sha']) is None:
                raise Exception('Travis returned the invalid SHA {}.'.format(
                    commit['sha']))
            return commit['sha']

    raise Exception("Couldn't find a passing build for the branch {}. "
        "This could be due to pagination, in which case this code "
        "must be made more robust!".format(branch))


def transfer_data(deployment_name):
    # TODO: Might be nice to also allow passing non-default parameters (e.g. a specific username) to
    #     `import_survey_drafts_from_dkobo`.
    setup_env(deployment_name)
    with cd(env.kpi_path):
        with kobo_workon(env.kpi_virtualenv_name):
            with prefix('DJANGO_SETTINGS_MODULE=kobo.settings'):
                run('python manage.py import_survey_drafts_from_dkobo --allusers')
