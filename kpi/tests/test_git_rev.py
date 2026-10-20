import subprocess
from unittest.mock import patch

from kobo.settings.utils import get_git_rev

REPO_DIR = '/srv/src/repo'
GIT_OUTPUTS = {
    ('rev-parse', '--short', 'HEAD'): 'abc1234\n',
    ('rev-parse', 'HEAD'): 'abc1234def5678abc1234def5678abc1234def56\n',
    ('rev-parse', '--abbrev-ref', 'HEAD'): 'main\n',
    ('describe', '--exact-match', '--tags'): '2.026.37\n',
}


def _fake_check_output(overrides=None):
    """
    Build a `subprocess.check_output` stand-in keyed on the git sub-command.

    `overrides` maps a sub-command tuple to a string (returned) or an
    exception instance (raised).
    """
    outputs = {**GIT_OUTPUTS, **(overrides or {})}

    def check_output(args, **kwargs):
        result = outputs[tuple(args[3:])]
        if isinstance(result, Exception):
            raise result
        return result

    return check_output


@patch('subprocess.check_output', side_effect=_fake_check_output())
def test_git_rev_invokes_git_with_safe_directory(mock_check_output):
    """
    Every git call runs inside the repo, whitelists it via `safe.directory`
    and decodes its output.
    """
    assert get_git_rev(REPO_DIR) == {
        'short': 'abc1234',
        'long': 'abc1234def5678abc1234def5678abc1234def56',
        'branch': 'main',
        'tag': '2.026.37',
    }
    assert len(mock_check_output.call_args_list) == 4
    for call in mock_check_output.call_args_list:
        assert call.args[0][:3] == ('git', '-c', f'safe.directory={REPO_DIR}')
        assert call.kwargs['cwd'] == REPO_DIR
        assert call.kwargs['text'] is True


@patch(
    'subprocess.check_output',
    side_effect=_fake_check_output(
        {
            ('describe', '--exact-match', '--tags'): subprocess.CalledProcessError(
                128, 'git'
            ),
        }
    ),
)
def test_failed_git_command_falls_back_to_false(mock_check_output):
    """
    One failing command yields `False` for its key only.
    """
    git_rev = get_git_rev(REPO_DIR)
    assert git_rev['tag'] is False
    assert git_rev['short'] == 'abc1234'
    assert git_rev['branch'] == 'main'


@patch(
    'subprocess.check_output',
    side_effect=_fake_check_output({('rev-parse', '--abbrev-ref', 'HEAD'): 'HEAD\n'}),
)
def test_detached_head_branch_is_false(mock_check_output):
    """
    A detached checkout reports no branch rather than the literal `HEAD`.
    """
    assert get_git_rev(REPO_DIR)['branch'] is False


@patch('subprocess.check_output', side_effect=OSError('git not found'))
def test_missing_git_binary_yields_all_false(mock_check_output):
    """
    Without a git binary, settings still import with every value `False`.
    """
    assert get_git_rev(REPO_DIR) == {
        'short': False,
        'long': False,
        'branch': False,
        'tag': False,
    }
