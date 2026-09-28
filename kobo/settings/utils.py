import os
import subprocess
import warnings
from typing import Any, Callable


def constance_env(
    getter: Callable,
    new_key: str,
    deprecated_key: str,
    default: Any,
) -> Any:
    """
    Read a Constance override from the `CONSTANCE_`-prefixed environment
    variable, falling back to its deprecated (unprefixed / `KOBO_`) name.

    Emit a `DeprecationWarning` when the deprecated name is still set so
    deployments know to migrate to the `CONSTANCE_` prefix.
    """
    if deprecated_key in os.environ:
        warnings.warn(
            f'{deprecated_key} is renamed {new_key}, '
            f'update the environment variable.',
            DeprecationWarning,
        )
    return getter(new_key, getter(deprecated_key, default))


def dj_stripe_request_callback_method():
    # This method exists because dj-stripe's documentation doesn't reflect reality.
    # It claims that DJSTRIPE_SUBSCRIBER_MODEL no longer needs a request callback but
    # this error occurs without it: `DJSTRIPE_SUBSCRIBER_MODEL_REQUEST_CALLBACK must
    # be implemented if a DJSTRIPE_SUBSCRIBER_MODEL is defined`
    # It doesn't need to do anything other than exist
    # https://github.com/dj-stripe/dj-stripe/issues/1900
    pass


def get_git_rev(repo_dir: str) -> dict[str, str | bool]:
    """
    Identify the running codebase for informational purposes.

    Based upon https://github.com/tblobaum/git-rev/blob/master/index.js.
    A value is `False` whenever git cannot answer.
    """
    git_rev = {}
    for key, git_args in (
        ('short', ('rev-parse', '--short', 'HEAD')),
        ('long', ('rev-parse', 'HEAD')),
        ('branch', ('rev-parse', '--abbrev-ref', 'HEAD')),
        ('tag', ('describe', '--exact-match', '--tags')),
    ):
        try:
            git_rev[key] = subprocess.check_output(
                # `safe.directory` lets git run against the root-owned source
                # tree when the app runs as an unprivileged user
                ('git', '-c', f'safe.directory={repo_dir}', *git_args),
                cwd=repo_dir,
                stderr=subprocess.STDOUT,
                text=True,
            ).strip()
        except (OSError, subprocess.CalledProcessError):
            git_rev[key] = False
    if git_rev['branch'] == 'HEAD':
        git_rev['branch'] = False
    return git_rev
