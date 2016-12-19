import json
import os
import re

from fabric.api import cd, env, run as run_, sudo as sudo_
from fabric.contrib import files
import requests


SERVICE_NAME = 'kpi'
GIT_REPO = 'https://github.com/kobotoolbox/{}.git'.format(SERVICE_NAME)
IMAGE_NAME = 'fabric/{}:autobuild'.format(SERVICE_NAME)
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


def run(*args, **kwargs):
    # Avoids control characters being returned in the output
    kwargs['pty'] = False
    return run_(*args, **kwargs)


def sudo(*args, **kwargs):
    # Avoids control characters being returned in the output
    kwargs['pty'] = False
    return sudo_(*args, **kwargs)


def check_key_filename(deployment_configs):
    if 'key_filename' in deployment_configs and \
       not os.path.exists(deployment_configs['key_filename']):
        # Maybe the path contains a ~; try expanding that before failing
        deployment_configs['key_filename'] = os.path.expanduser(
            deployment_configs['key_filename']
        )
        if not os.path.exists(deployment_configs['key_filename']):
            raise Exception("Cannot find required SSH key file: %s" %
                            deployment_configs['key_filename'])


def setup_env(deployment_name):
    deployment = DEPLOYMENTS.get(deployment_name, {})

    if deployment_name in IMPORTED_DEPLOYMENTS:
        deployment.update(IMPORTED_DEPLOYMENTS[deployment_name])

    env.update(deployment)
    check_key_filename(deployment)

    for required_setting in REQUIRED_SETTINGS:
        if required_setting not in env:
            raise Exception('Please define {} in {} and try again'.format(
                required_setting, deployments_file))


def deploy(deployment_name, branch='master'):
    setup_env(deployment_name)
    build_dir = run("mktemp --tmpdir='{}' -d".format(env.build_root))
    try:
        with cd(build_dir):
            # Shallow clone the requested branch to a temporary directory
            run("git clone --quiet --depth=1 --branch='{}' '{}' .".format(
                branch, GIT_REPO))
            # Note which commit is at the tip of the cloned branch
            cloned_commit = run("git show --no-patch")
            # Build the image
            run("docker build -t '{}' .".format(IMAGE_NAME))
        with cd(env.docker_config_path):
            # Run the new image
            run("docker-compose stop '{}'".format(SERVICE_NAME))
            run("docker-compose rm -f --all '{}'".format(SERVICE_NAME))
            run("docker-compose up -d '{}'".format(SERVICE_NAME))
            running_commit = run(
                "docker exec $(docker-compose ps -q '{service}') bash -c '"
                "cd \"${src_dir_var}\" && git show --no-patch'".format(
                    service=SERVICE_NAME,
                    src_dir_var=CONTAINER_SRC_DIR_ENV_VAR
                )
            )
        with cd(env.static_path):
            # Write the date and running commit to a publicly-accessible file
            sudo("(date; echo) > '{}'".format(UPDATE_STATIC_FILE))
            files.append(UPDATE_STATIC_FILE, running_commit, use_sudo=True)
        if running_commit != cloned_commit:
            raise Exception(
                'The running commit does not match the tip of the cloned'
                'branch! Make sure docker-compose.yml is set to use {}'.format(
                    IMAGE_NAME)
            )
    finally:
        # Clean up no matter what!
        with cd(build_dir):
            run("find -delete")
        run("rmdir '{}'".format(build_dir))
