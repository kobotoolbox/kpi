import json
import os
import sys

from fabric.api import cd, env, prefix, run, settings

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


def run_no_pty(*args, **kwargs):
    # Avoids control characters being returned in the output
    kwargs['pty'] = False
    return run(*args, **kwargs)

def check_key_filename(deployment_configs):
    if 'key_filename' in deployment_configs and \
       not os.path.exists(deployment_configs['key_filename']):
        # Maybe the path contains a ~; try expanding that before failing
        deployment_configs['key_filename'] = os.path.expanduser(
            deployment_configs['key_filename']
        )
        if not os.path.exists(deployment_configs['key_filename']):
            exit_with_error("Cannot find required SSH key file: %s" %
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
                                             'dependencies/pip/external_services.txt')


def deploy_ref(deployment_name, ref, force=False):
    setup_env(deployment_name)
    with cd(env.kpi_path):
        run("git fetch --all --tags")
        # Make sure we're not moving to an older codebase
        git_output = run_no_pty(
            'git rev-list {}..HEAD --count 2>&1'.format(ref))
        if int(git_output) > 0 and not force:
            raise Exception("The server's HEAD is already in front of the "
                "commit to be deployed.")
        # We want to check out a specific commit, but this does leave the HEAD
        # detached. Perhaps consider using `git reset`.
        run('git checkout {}'.format(ref))
        # Report if the working directory is unclean.
        git_output = run_no_pty('git status --porcelain')
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
            run("gulp copy")
            run("npm run build")

            # KPI and KF share a virtualenv but have distinct settings modules
            with prefix('DJANGO_SETTINGS_MODULE=kobo.settings'):
                run("python manage.py migrate")
                run("python manage.py collectstatic --noinput")

    with cd(os.path.join(env.kpi_path, 'staticfiles')):
        run("date > LAST_UPDATE.txt")

    run("sudo restart kpi_celeryd")
    with settings(warn_only=True):
        # Job is often stopped, which triggers a non-zero return code from
        # `restart` and fails the whole deployment
        run("sudo restart kpi_sync_kobocat_xforms_celeryd")
    run("sudo service uwsgi reload")


def deploy(deployment_name, branch='origin/master'):
    deploy_ref(deployment_name, branch)


def transfer_data(deployment_name):
    # TODO: Might be nice to also allow passing non-default parameters (e.g. a specific username) to
    #     `import_survey_drafts_from_dkobo`.
    setup_env(deployment_name)
    with cd(env.kpi_path):
        with kobo_workon(env.kpi_virtualenv_name):
            with prefix('DJANGO_SETTINGS_MODULE=kobo.settings'):
                run('python manage.py import_survey_drafts_from_dkobo --allusers')
