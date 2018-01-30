import json
import os

from fabric.api import cd, env, run, sudo
from fabric.contrib import files


SERVICE_NAME = 'kpi'
GIT_REPO = 'https://github.com/kobotoolbox/{}.git'.format(SERVICE_NAME)
CONTAINER_SRC_DIR_ENV_VAR = '{}_SRC_DIR'.format(SERVICE_NAME.upper())
UPDATE_STATIC_FILE = '{}/LAST_UPDATE.txt'.format(SERVICE_NAME)
# These must be defined in deployments.json
REQUIRED_SETTINGS = (
    'build_root', # Temporary location for cloning repo; deleted at end
    'docker_config_path', # Location must house `docker_compose.yml`
    'static_path' # `UPDATE_STATIC_FILE` will be written here
)

DEPLOYMENTS = {}
IMPORTED_DEPLOYMENTS = {}
deployments_file = os.environ.get('DEPLOYMENTS_JSON', 'deployments.json')
if os.path.exists(deployments_file):
    with open(deployments_file, 'r') as f:
        IMPORTED_DEPLOYMENTS = json.load(f)
else:
    raise Exception("Cannot find {}".format(deployments_file))


def run_no_pty(*args, **kwargs):
    # Avoids control characters being returned in the output
    kwargs['pty'] = False
    return run(*args, **kwargs)


def sudo_no_pty(*args, **kwargs):
    # Avoids control characters being returned in the output
    kwargs['pty'] = False
    return sudo(*args, **kwargs)


def setup_env(deployment_name):
    deployment = DEPLOYMENTS.get(deployment_name, {})

    if deployment_name in IMPORTED_DEPLOYMENTS:
        deployment.update(IMPORTED_DEPLOYMENTS[deployment_name])

    env.update(deployment)

    for required_setting in REQUIRED_SETTINGS:
        if required_setting not in env:
            raise Exception('Please define {} in {} and try again'.format(
                required_setting, deployments_file))


def deploy(deployment_name, branch='master'):
    setup_env(deployment_name)
    build_dir = os.path.join(env.build_root, SERVICE_NAME)
    with cd(build_dir):
        # Start from scratch
        run("find -delete")
        # Shallow clone the requested branch to a temporary directory
        run("git clone --quiet --depth=1 --branch='{}' '{}' .".format(
            branch, GIT_REPO))
        # Note which commit is at the tip of the cloned branch
        cloned_commit = run_no_pty("git show --no-patch")
    with cd(env.docker_config_path):
        # Build the image
        run("docker-compose build '{}'".format(SERVICE_NAME))
        # Run the new image
        run("docker-compose stop '{}'".format(SERVICE_NAME))
        run("docker-compose rm -f '{}'".format(SERVICE_NAME))
        # Don't specify a service name to avoid "Cannot link to a non running
        # container"
        run("docker-compose up -d")
        running_commit = run_no_pty(
            "docker exec $(docker-compose ps -q '{service}') bash -c '"
            "cd \"${src_dir_var}\" && git show --no-patch'".format(
                service=SERVICE_NAME,
                src_dir_var=CONTAINER_SRC_DIR_ENV_VAR
            )
        )
    with cd(env.static_path):
        # Write the date and running commit to a publicly-accessible file
        sudo("(date; echo) > '{}'".format(UPDATE_STATIC_FILE))
        files.append(UPDATE_STATIC_FILE, running_commit.decode('utf-8'), use_sudo=True)
    if running_commit != cloned_commit:
        raise Exception(
            'The running commit does not match the tip of the cloned'
            'branch! Make sure docker-compose.yml is set to build from '
            '{}'.format(build_dir)
        )
