# -*- coding: utf-8 -*-
"""
Validate XForms using Enketo validator.
"""
import os

from pyxform.validators.error_cleaner import ErrorCleaner
from pyxform.validators.util import (
    XFORM_SPEC_PATH,
    check_readable,
    decode_stream,
    run_popen_with_timeout,
)

CURRENT_DIRECTORY = os.path.dirname(os.path.realpath(__file__))
ENKETO_VALIDATE_PATH = os.path.join(CURRENT_DIRECTORY, "bin", "validate")


class EnketoValidateError(Exception):
    """Common base class for Enketo validate exceptions."""

    pass


def install_exists():
    """
    Check if Enketo-validate is installed.
    """
    return os.path.exists(ENKETO_VALIDATE_PATH)


def _call_validator(path_to_xform, bin_file_path=ENKETO_VALIDATE_PATH):
    return run_popen_with_timeout([bin_file_path, path_to_xform], 100)


def install_ok(bin_file_path=ENKETO_VALIDATE_PATH):
    """
    Check if Enketo-validate functions as expected.
    """
    check_readable(file_path=XFORM_SPEC_PATH)
    return_code, _, _, _ = _call_validator(
        path_to_xform=XFORM_SPEC_PATH, bin_file_path=bin_file_path
    )
    if return_code == 1:
        return False
    else:
        return True


def check_xform(path_to_xform):
    """
    Check the form with the Enketo validator.

    - return code 1: raise error with the stderr content.
    - return code 0: append warning with the stdout content (possibly none).

    :param path_to_xform: Path to the XForm to be validated.
    :param bin_path: Path to the Enketo-validate binary.
    :return: warnings or List[str]
    """
    if not install_exists():
        raise EnvironmentError(
            "Enketo-validate dependency not found. "
            "Please use the updater tool to install the latest version."
        )

    returncode, timeout, stdout, stderr = _call_validator(path_to_xform=path_to_xform)
    warnings = []
    stderr = decode_stream(stderr)
    stdout = decode_stream(stdout)

    if timeout:
        return ["XForm took to long to completely validate."]
    else:
        if returncode > 0:  # Error invalid
            raise EnketoValidateError(
                "Enketo Validate Errors:\n" + ErrorCleaner.enketo_validate(stderr)
            )
        elif returncode == 0:
            if stdout:
                warnings.append("Enketo Validate Warnings:\n" + stdout)
            return warnings
        elif returncode < 0:
            return ["Bad return code from Enketo Validate."]
