import os
import re
import json
import tempfile

from fabric.api import (
    abort,
    cd,
    env,
    hide,
    lcd,
    local,
    prompt,
    run,
    settings,
    sudo,
)
from fabric.contrib import files


SERVICE_NAME = 'kpi'
GIT_REPO = 'https://github.com/kobotoolbox/{}.git'.format(SERVICE_NAME)
DOCKER_HUB_REPO = 'kobotoolbox/{}'.format(SERVICE_NAME)
DOCKER_COMPOSE_IMAGE_UPDATE_PATTERN = re.compile(
    r'^( *image: *){}.*$'.format(DOCKER_HUB_REPO)
)
CONTAINER_SRC_DIR_ENV_VAR = '{}_SRC_DIR'.format(SERVICE_NAME.upper())
UPDATE_STATIC_FILE = '{}/LAST_UPDATE.txt'.format(SERVICE_NAME)
# These may be defined in deployments.json
DEPLOYMENT_SETTINGS = (
    'host_string', # user@host for SSH connection
    'docker_config_path', # Location must house `docker_compose.yml`
    ####### For deploying pre-built images #######
    'docker_git_compose_file', # YML file to update with tag being deployed
    'docker_git_repo', # Git repo housing Docker Compose YML file
    'docker_git_branch', # Branch to update when committing YML change
    'docker_compose_command', # Docker Compose invocation to use when deploying
                              # (include options like `-f`, but do not include
                              # commands like `up`)
    ####### For building images from source in situ #######
    'build_root', # Temporary location for cloning repo; deleted at end
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

    unrecognized_settings = set(deployment.keys()) - set(DEPLOYMENT_SETTINGS)
    if unrecognized_settings:
        raise Exception('Unrecognized deployment settings in {}: {}'.format(
            deployments_file, ','.join(unrecognized_settings))
        )
    env.update(deployment)


def check_required_settings(required_settings):
    for required_setting in required_settings:
        if required_setting not in env:
            raise Exception('Please define {} in {} and try again'.format(
                required_setting, deployments_file))


def get_base_image_from_dockerfile():
    from_line = run_no_pty("sed -n '/^FROM /p;q' Dockerfile")
    base_image_name = from_line.strip().split(' ')[-1]
    return base_image_name


def deploy(deployment_name, tag_or_branch):
    setup_env(deployment_name)
    if 'docker_git_repo' in env:
        check_required_settings((
            'docker_git_compose_file',
            'docker_git_repo',
            'docker_git_branch',
            'docker_compose_command',
        ))
        commit_pull_and_deploy(tag_or_branch)
    else:
        check_required_settings((
            'build_root',
            'docker_config_path',
            'static_path',
        ))
        build_and_deploy(tag_or_branch)


def commit_pull_and_deploy(tag):
    # Clone the Docker configuration in a local temporary directory
    local_tmpdir = tempfile.mkdtemp(prefix='fab-deploy')
    local_compose_file = os.path.join(
        local_tmpdir, env.docker_git_compose_file)
    with lcd(local_tmpdir):
        local("git clone --quiet --depth=1 --branch='{}' '{}' .".format(
            env.docker_git_branch, env.docker_git_repo)
        )
        # Update the image tag used by Docker Compose
        image_name = '{}:{}'.format(DOCKER_HUB_REPO, tag)
        updated_compose_image = False
        with open(local_compose_file, 'r') as f:
            compose_file_lines = f.readlines()
        with open(local_compose_file, 'w') as f:
            for line in compose_file_lines:
                matches = re.match(DOCKER_COMPOSE_IMAGE_UPDATE_PATTERN, line)
                if not matches:
                    f.write(line)
                    continue
                else:
                    # https://docs.python.org/2/library/os.html#os.linesep
                    f.write('{prefix}{image_name}\n'.format(
                        prefix=matches.group(1), image_name=image_name)
                    )
                    updated_compose_image = True
        if not updated_compose_image:
            raise Exception(
                'Failed to update image to {} in Docker Compose '
                'configuration'.format(image_name)
            )
        # Did we actually make a change?
        if local('git diff', capture=True):
            # Commit the change
            local("git add '{}'".format(local_compose_file))
            local("git commit -am 'Upgrade {service} to {tag}'".format(
                service=SERVICE_NAME, tag=tag)
            )
            # Push the commit
            local('git show')
            response = prompt(
                'OK to push the above commit to {} branch of {}? (y/n)'.format(
                    env.docker_git_branch, env.docker_git_repo)
            )
            if response != 'y':
                abort('Push cancelled')
            local("git push origin '{}'".format(env.docker_git_branch))
        # Make a note of the commit to verify later that it's pulled to the
        # remote server
        pushed_config_commit = local("git show --no-patch", capture=True)

    # Deploy to the remote server
    with cd(env.docker_config_path):
        run('git pull')
        pulled_config_commit = run_no_pty("git show --no-patch")
        if pulled_config_commit != pushed_config_commit:
            raise Exception(
                'The configuration commit on the remote server does not match '
                'what was pushed locally. Please make sure {} is checked out '
                'on the remote server.'.format(env.docker_git_branch)
            )
        run_no_pty("{doco} pull '{service}'".format(
            doco=env.docker_compose_command, service=SERVICE_NAME)
        )
        run("{doco} up -d".format(doco=env.docker_compose_command))


def build_and_deploy(branch):
    build_dir = os.path.join(env.build_root, SERVICE_NAME)
    with cd(build_dir):
        # Start from scratch
        run("find -delete")
        # Shallow clone the requested branch to a temporary directory
        run("git clone --quiet --depth=1 --branch='{}' '{}' .".format(
            branch, GIT_REPO))
        # Note which commit is at the tip of the cloned branch
        cloned_commit = run_no_pty("git show --no-patch")
        # Update the base image
        run_no_pty("docker pull '{}'".format(get_base_image_from_dockerfile()))
    with cd(env.docker_config_path):
        # Build the image
        run("docker-compose build '{}'".format(SERVICE_NAME))
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
            'The running commit does not match the tip of the cloned '
            'branch! Make sure docker-compose.yml is set to build from '
            '{}'.format(build_dir)
        )


def publish_docker_image(tag, deployment_name='_image_builder'):
    def _get_commit_from_docker_image(image_name):
        with hide('output'):
            return run_no_pty(
                "docker run --rm {image_name} bash -c '"
                "cd \"${src_dir_var}\" && git show --no-patch'".format(
                    image_name=image_name,
                    src_dir_var=CONTAINER_SRC_DIR_ENV_VAR
                )
            )

    setup_env(deployment_name)
    check_required_settings(('build_root',))
    build_dir = os.path.join(env.build_root, SERVICE_NAME, tag)
    image_name = '{}:{}'.format(DOCKER_HUB_REPO, tag)

    run("mkdir -p '{}'".format(build_dir))
    with cd(build_dir):
        # Start from scratch
        run("find -delete")
        # Shallow clone the requested tag to a temporary directory
        with hide('output'):
            run("git clone --quiet --depth=1 --branch='{}' '{}' .".format(
                tag, GIT_REPO))
        # Note which commit is at the tip of the cloned tag
        cloned_commit = run_no_pty("git show --no-patch")
        # Check if a suitable image was built already
        with settings(warn_only=True):
            commit_inside_image = _get_commit_from_docker_image(image_name)
        if commit_inside_image != cloned_commit:
            # Update the base image
            run_no_pty("docker pull '{}'".format(
                get_base_image_from_dockerfile()
            ))
            # Build the image
            run("docker build -t '{}' .".format(image_name))
            # Make sure the resulting image has the expected code
            commit_inside_image = _get_commit_from_docker_image(image_name)
            if commit_inside_image != cloned_commit:
                raise Exception(
                    'The code inside the built image does not match the '
                    'specified tag. This script is probably broken.'
                )
    # Push the image to Docker Hub
    run_no_pty("docker push '{}'".format(image_name))
