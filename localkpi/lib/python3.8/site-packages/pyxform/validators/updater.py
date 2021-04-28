# -*- coding: utf-8 -*-
"""
pyxform_validator_update - command to update XForm validators.
"""
from __future__ import print_function

import argparse
import fnmatch
import io
import json
import logging
import os
import shutil
import sys
from datetime import datetime
from stat import S_IXGRP, S_IXUSR
from zipfile import ZipFile, is_zipfile

from pyxform.errors import PyXFormError
from pyxform.utils import unicode
from pyxform.validators import enketo_validate, odk_validate
from pyxform.validators.util import HERE, CapturingHandler, request_get

UTC_FMT = "%Y-%m-%dT%H:%M:%SZ"
log = logging.getLogger(__name__)
capture_handler = CapturingHandler(logger=log)


class _UpdateInfo(object):
    """
    Data class for Updater info.
    """

    def __init__(
        self,
        api_url,
        repo_url,
        validate_subfolder,
        install_check,
        validator_basename,
        mod_root=None,
    ):
        """
        :param api_url: The GitHub API URL for the latest release details.
        :param repo_url: The main GitHub repository page.
        :param validate_subfolder: The folder under "validators" to work in.
        :param install_check: A function to check if an install works. Must
            return True or False.
        :param validator_basename: Validator bin file name.
        :param mod_root: Optionally specify the root module path.
        """
        self._api_url = None
        self.api_url = api_url
        self.repo_url = repo_url
        self.validate_subfolder = validate_subfolder
        self.install_check = install_check
        self.validator_basename = validator_basename

        if mod_root is None:
            self.mod_path = os.path.join(HERE, self.validate_subfolder)
        else:
            self.mod_path = os.path.join(mod_root, validate_subfolder)
        self.latest_path = os.path.join(self.mod_path, "latest.json")
        self.last_check_path = os.path.join(self.mod_path, ".last_check")

        self.bin_path = os.path.join(self.mod_path, "bin")
        self.installed_path = os.path.join(self.bin_path, "installed.json")
        self.bin_new_path = os.path.join(self.mod_path, "bin_new")

        self.manual_msg = "Download manually from: {r}.".format(r=self.repo_url)


class _UpdateHandler(object):
    """
    Handles tasks related to updating external XForm validators.

    Where possible, minimise calls to the GitHub API because doing so without an
    API token is rate-limited to 60 calls per hour, tracked by IP address. The
    calls are unauthenticated to avoid having to handle / manage GitHub creds.
    Tests should not touch GitHub either.
    """

    @staticmethod
    def _request_latest_json(url):
        """
        Get the GitHub API JSON response doc for the latest release from URL.
        """
        content = request_get(url=url)
        return json.loads(content.decode("utf-8"))

    @staticmethod
    def _check_path(file_path):
        if not os.path.exists(file_path):
            raise PyXFormError(
                "Expected path does not exist: {p}" "".format(p=file_path)
            )
        else:
            return True

    @staticmethod
    def _read_json(file_path):
        """
        Read the JSON file to a string.
        """
        _UpdateHandler._check_path(file_path=file_path)
        with io.open(file_path, mode="r") as in_file:
            return json.load(in_file)

    @staticmethod
    def _write_json(file_path, content):
        """
        Save the JSON data to a file.
        """
        with io.open(file_path, mode="w", newline="\n") as out_file:
            data = json.dumps(content, indent=2, sort_keys=True)
            out_file.write(unicode(data))

    @staticmethod
    def _read_last_check(file_path):
        """
        Read the .last_check file.
        """
        _UpdateHandler._check_path(file_path=file_path)
        with io.open(file_path, mode="r") as in_file:
            first_line = in_file.readline()
        try:
            last_check = datetime.strptime(first_line, UTC_FMT)
        except ValueError:
            return None
        else:
            return last_check

    @staticmethod
    def _write_last_check(file_path, content):
        """
        Write the .last_check file.
        """
        with io.open(file_path, mode="w", newline="\n") as out_file:
            out_file.write(unicode(content.strftime(UTC_FMT)))

    @staticmethod
    def _check_necessary(update_info, utc_now):
        """
        Determine whether a check for the latest version is necessary.
        """
        if not os.path.exists(update_info.last_check_path):
            return True
        elif not os.path.exists(update_info.latest_path):
            return True
        else:
            last_check = _UpdateHandler._read_last_check(
                file_path=update_info.last_check_path
            )
            if last_check is None:
                return True
            age = utc_now - last_check
            thirty_minutes = 1800
            if thirty_minutes < age.total_seconds():
                return True
            else:
                return False

    @staticmethod
    def _get_latest(update_info):
        """
        Get the latest release info, either from GitHub or a recent file copy.
        """
        utc_now = datetime.utcnow()
        if _UpdateHandler._check_necessary(update_info=update_info, utc_now=utc_now):
            latest = _UpdateHandler._request_latest_json(url=update_info.api_url)
            _UpdateHandler._write_json(
                file_path=update_info.latest_path, content=latest
            )
            _UpdateHandler._write_last_check(
                file_path=update_info.last_check_path, content=utc_now
            )
        else:
            latest = _UpdateHandler._read_json(file_path=update_info.latest_path)
        return latest

    @staticmethod
    def _get_release_message(json_data):
        template = "- Tag name = {tag_name}\n" "- Tag URL = {tag_url}\n\n"
        return template.format(
            tag_name=json_data["tag_name"], tag_url=json_data["html_url"]
        )

    @staticmethod
    def list(update_info):
        """
        List the current and latest release info, and latest available files.

        :type update_info: _UpdateInfo
        """
        if not os.path.exists(update_info.installed_path):
            installed_info = "- None!\n\n"
        else:
            installed = _UpdateHandler._read_json(file_path=update_info.installed_path)
            installed_info = _UpdateHandler._get_release_message(json_data=installed)

        latest = _UpdateHandler._get_latest(update_info=update_info)
        latest_files = latest["assets"]
        if len(latest_files) == 0:
            file_message = "- None!\n\n{m}".format(m=update_info.manual_msg)
        else:
            file_names = ["- {n}".format(n=x["name"]) for x in latest_files]
            file_message = "\n".join(file_names)

        template = (
            "\nInstalled release:\n\n{installed}"
            "Latest release:\n\n{latest}"
            "Files available:\n\n{file_message}\n"
        )
        message = template.format(
            installed=installed_info,
            latest=_UpdateHandler._get_release_message(json_data=latest),
            file_message=file_message,
        )
        log.info(message)

    @staticmethod
    def _find_download_url(update_info, json_data, file_name):
        """
        Find the download URL for the file in the GitHub API JSON response doc.
        """
        rel_name = json_data["tag_name"]
        files = json_data["assets"]

        if len(files) == 0:
            raise PyXFormError(
                "No files attached to release '{r}'.\n\n{h}"
                "".format(r=rel_name, h=update_info.manual_msg)
            )

        file_urls = [x["browser_download_url"] for x in files if x["name"] == file_name]

        urls_len = len(file_urls)
        if 0 == urls_len:
            raise PyXFormError(
                "No files with the name '{n}' attached to release '{r}'."
                "\n\n{h}".format(n=file_name, r=rel_name, h=update_info.manual_msg)
            )
        elif 1 < urls_len:
            raise PyXFormError(
                "{c} files with the name '{n}' attached to release '{r}'."
                "\n\n{h}".format(
                    c=urls_len, n=file_name, r=rel_name, h=update_info.manual_msg
                )
            )
        else:
            return file_urls[0]

    @staticmethod
    def _download_file(url, file_path):
        """
        Save response content from the URL to a binary file at the file path.
        """
        with io.open(file_path, mode="wb") as out_file:
            file_data = request_get(url=url)
            out_file.write(file_data)

    @staticmethod
    def _get_bin_paths(update_info, file_path):
        """
        Get the mapping of zip file paths to extract paths for the file_name.

        The zip file paths are actually glob/fnmatch patterns to find these
        files among the files in the zip archive.
        """
        _, file_name = os.path.split(file_path)
        file_base = os.path.basename(file_name)
        if "windows" in file_base:
            main_bin = "*validate.exe"
        elif "linux" in file_base:
            main_bin = "*validate"
        elif "macos" in file_base:
            main_bin = "*validate"
        else:
            raise PyXFormError(
                "Did not find a supported main binary for file: {p}.\n\n{h}"
                "".format(p=file_path, h=update_info.manual_msg)
            )
        return [
            (main_bin, update_info.validator_basename),
            (
                "*node_modules/libxmljs-mt/build*/xmljs.node",
                "node_modules/libxmljs-mt/build/xmljs.node",
            ),
            (
                "*node_modules/libxslt/build*/node-libxslt.node",
                "node_modules/libxslt/build/node-libxslt.node",
            ),
        ]

    @staticmethod
    def _unzip_find_jobs(open_zip_file, bin_paths, out_path):
        """
        For each bin file, get the zip file item file name and the output path.

        Ignore files that may appear in the __MACOSX info dir, and if two files
        have the same destination path and the same CRC then they're probably
        duplicate files so only one of them is copied out.
        """
        zip_info = open_zip_file.infolist()
        zip_jobs = {}
        for zip_item in zip_info:
            if zip_item.filename.startswith("__MACOSX"):
                continue
            for file_target in bin_paths:
                if fnmatch.fnmatch(zip_item.filename, file_target[0]):
                    file_out_path = os.path.join(out_path, file_target[1])
                    maybe_existing_match = zip_jobs.get(file_out_path, None)
                    if maybe_existing_match is not None:
                        if maybe_existing_match.CRC == zip_item.CRC:
                            continue
                    zip_jobs[file_out_path] = zip_item
        if len(bin_paths) != len(zip_jobs.keys()):
            raise PyXFormError(
                "Expected {e} zip job files, found: {c}"
                "".format(e=len(bin_paths), c=len(zip_jobs.keys()))
            )
        return zip_jobs

    @staticmethod
    def _unzip_extract_file(open_zip_file, zip_item, file_out_path):
        """
        Extract the content for item in zip file to a specific location.

        Note that ZipExtFile.read() (which is returned from open()) does a
        CRC32 check during read so ZipFile.testzip() isn't needed. Testzip
        works by reading all the files in the archive, doing the same thing.
        """
        out_parent = os.path.dirname(file_out_path)
        if not os.path.exists(out_parent):
            os.makedirs(out_parent)
        with open_zip_file.open(zip_item, mode="r") as zip_item_file:
            zip_item_data = zip_item_file.read()
            with io.open(file_out_path, "wb") as file_out_file:
                file_out_file.write(zip_item_data)

    @staticmethod
    def _unzip(update_info, file_path, out_path):
        """
        Unzip the contents of a zip file to an existing output path.
        """
        _UpdateHandler._check_path(file_path=file_path)
        _UpdateHandler._check_path(file_path=out_path)
        bin_paths = _UpdateHandler._get_bin_paths(
            update_info=update_info, file_path=file_path
        )

        with ZipFile(file_path, mode="r") as zip_file:
            jobs = _UpdateHandler._unzip_find_jobs(
                open_zip_file=zip_file, bin_paths=bin_paths, out_path=out_path
            )
            for file_out_path, zip_item in jobs.items():
                _UpdateHandler._unzip_extract_file(
                    open_zip_file=zip_file,
                    zip_item=zip_item,
                    file_out_path=file_out_path,
                )

    @staticmethod
    def _install(update_info, file_name):
        """
        Install the latest release.
        """
        try:
            latest = _UpdateHandler._get_latest(update_info=update_info)
            file_path = os.path.join(update_info.bin_new_path, file_name)
            new_bin_file_path = os.path.join(
                update_info.bin_new_path, update_info.validator_basename
            )

            if os.path.exists(update_info.bin_new_path):
                shutil.rmtree(update_info.bin_new_path)
            os.makedirs(update_info.bin_new_path)

            installed = os.path.join(update_info.bin_new_path, "installed.json")
            _UpdateHandler._write_json(file_path=installed, content=latest)
            url = _UpdateHandler._find_download_url(
                update_info=update_info, json_data=latest, file_name=file_name
            )
            _UpdateHandler._download_file(url=url, file_path=file_path)

            if is_zipfile(file_path) and os.path.splitext(file_path)[1] == ".zip":
                _UpdateHandler._unzip(
                    update_info=update_info,
                    file_path=file_path,
                    out_path=update_info.bin_new_path,
                )
            else:
                os.rename(file_path, new_bin_file_path)

            # For macos / linux: chmod ug+x the new bin file. No-op on Windows.
            current_mode = os.stat(new_bin_file_path).st_mode
            os.chmod(new_bin_file_path, current_mode | S_IXUSR | S_IXGRP)

        except PyXFormError as e:
            raise PyXFormError("\n\nUpdate failed!\n\n" + unicode(e))
        else:
            return latest

    @staticmethod
    def _replace_old_bin_path(update_info):
        if os.path.exists(update_info.bin_path):
            shutil.rmtree(update_info.bin_path)
        shutil.move(update_info.bin_new_path, update_info.bin_path)

    @staticmethod
    def update(update_info, file_name, force=False):
        """
        Update to the latest version, using the specified file_name.

        :type update_info: _UpdateInfo
        :type file_name: str
        :type force: bool
        """
        if not os.path.exists(update_info.installed_path):
            installed = _UpdateHandler._install(
                update_info=update_info, file_name=file_name
            )
            latest = installed
        else:
            installed = _UpdateHandler._read_json(file_path=update_info.installed_path)
            latest = _UpdateHandler._get_latest(update_info=update_info)
            if installed["tag_name"] == latest["tag_name"] and not force:
                installed_info = _UpdateHandler._get_release_message(
                    json_data=installed
                )
                latest_info = _UpdateHandler._get_release_message(json_data=latest)
                template = (
                    "\nUpdate failed!\n\n"
                    "The installed release appears to be the latest. "
                    "To update anyway, use the '--force' flag.\n\n"
                    "Installed release:\n\n{installed}"
                    "Latest release:\n\n{latest}"
                )
                message = template.format(installed=installed_info, latest=latest_info)
                raise PyXFormError(message)
            else:
                _UpdateHandler._install(update_info=update_info, file_name=file_name)

        installed_info = _UpdateHandler._get_release_message(json_data=installed)
        latest_info = _UpdateHandler._get_release_message(json_data=latest)
        new_bin_file_path = os.path.join(
            update_info.bin_new_path, update_info.validator_basename
        )
        if update_info.install_check(bin_file_path=new_bin_file_path):
            _UpdateHandler._replace_old_bin_path(update_info=update_info)
            template = (
                "\nUpdate success!\n\n"
                "Install check of the latest release succeeded.\n\n"
                "Latest release:\n\n{latest}"
            )
            message = template.format(latest=latest_info)
            log.info(message)
            return True
        else:
            template = (
                "\nUpdate failed!\n\n"
                "The latest release does not appear to work. "
                "It is saved here in case it's needed:\n{bin_new}\n\n"
                "The installed release has not been changed.\n\n"
                "Installed release:\n\n{installed}"
                "Latest release:\n\n{latest}"
            )
            message = template.format(
                bin_new=new_bin_file_path, installed=installed_info, latest=latest_info
            )
            raise PyXFormError(message)

    @staticmethod
    def check(update_info):
        """
        Check if the installed release of the validator works.

        :type update_info: _UpdateInfo
        """
        if not os.path.exists(update_info.installed_path):
            message = "\nCheck failed!\n\n" "No installed release found."
            raise PyXFormError(message)

        installed = _UpdateHandler._read_json(file_path=update_info.installed_path)
        if update_info.install_check():
            template = (
                "\nCheck success!\n\n"
                "The installed release appears to work.\n\n"
                "Installed release:\n\n{installed}"
            )
            message = template.format(
                installed=_UpdateHandler._get_release_message(json_data=installed)
            )
            log.info(message)
            return True
        else:
            template = (
                "\nCheck failed!\n\n"
                "The installed release does not appear to work.\n\n"
                "Installed release:\n\n{installed}"
            )
            message = template.format(
                installed=_UpdateHandler._get_release_message(json_data=installed)
            )
            raise PyXFormError(message)


class _UpdateService(object):

    update_info = None

    def list(self):
        return _UpdateHandler.list(update_info=self.update_info)

    def update(self, file_name, force):
        return _UpdateHandler.update(
            update_info=self.update_info, file_name=file_name, force=force
        )

    def check(self):
        return _UpdateHandler.check(update_info=self.update_info)

    @staticmethod
    def _install_check(bin_file_path=None):
        raise NotImplementedError()


class EnketoValidateUpdater(_UpdateService):
    def __init__(self):
        self.update_info = _UpdateInfo(
            api_url="https://api.github.com/repos/enketo/enketo-validate/"
            "releases/latest",
            repo_url="https://github.com/enketo/enketo-validate",
            validate_subfolder="enketo_validate",
            install_check=self._install_check,
            validator_basename=os.path.basename(enketo_validate.ENKETO_VALIDATE_PATH),
        )

    @staticmethod
    def _install_check(bin_file_path=None):
        if bin_file_path is None:
            return enketo_validate.install_ok()
        else:
            extracted = os.path.join(os.path.dirname(bin_file_path), "validate")
            return enketo_validate.install_ok(bin_file_path=extracted)


class ODKValidateUpdater(_UpdateService):
    def __init__(self):
        self.update_info = _UpdateInfo(
            api_url="https://api.github.com/repos/opendatakit/validate/"
            "releases/latest",
            repo_url="https://github.com/opendatakit/validate",
            validate_subfolder="odk_validate",
            install_check=self._install_check,
            validator_basename=os.path.basename(odk_validate.ODK_VALIDATE_PATH),
        )

    @staticmethod
    def _install_check(bin_file_path=None):
        if bin_file_path is None:
            return odk_validate.install_ok()
        else:
            return odk_validate.install_ok(bin_file_path=bin_file_path)


def _build_validator_menu(main_subparser, validator_name, updater_instance):

    main = main_subparser.add_parser(
        validator_name.lower(),
        description="{v} Sub-menu".format(v=validator_name),
        help="For help, use '{v} -h'.".format(v=validator_name.lower()),
    )
    subs = main.add_subparsers(metavar="<sub_command>")

    cmd_list = subs.add_parser(
        "list", help="List available files for the latest release."
    )
    cmd_list.set_defaults(command=updater_instance.list)

    cmd_update = subs.add_parser(
        "update", help="Update the validator to the latest release."
    )
    cmd_update.set_defaults(command=updater_instance.update)
    cmd_update.add_argument(
        "file_name", help="Name of the release file to use for updating."
    )
    cmd_update.add_argument(
        "--force",
        action="store_true",
        default=False,
        help="If the installed release appears to be the latest, update anyway.",
    )

    cmd_check = subs.add_parser(
        "check", help="Check if the installed release of the validator appears to work."
    )
    cmd_check.set_defaults(command=updater_instance.check)
    return main


def _create_parser():
    """
    Parse command line arguments.
    """
    main_title = "pyxform validator updater"
    epilog = (
        "------------------------------------------------------\n"
        "Use this tool to update external validators.\n\n"
        "Example usage:\n\n"
        "updater.py enketo list\n"
        "updater.py enketo update linux.zip\n\n"
        "First, use the 'list' sub-command for the validator\n"
        "to check for a new release and to show what (if any) \n"
        "files are attached to it.\n\n"
        "Second, use the 'update' sub-command for the validator\n"
        "to apply the update, specifying the file to use.\n"
        "------------------------------------------------------"
    )
    main_parser = argparse.ArgumentParser(
        description=main_title,
        epilog=epilog,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub_parsers = main_parser.add_subparsers(metavar="<sub_menu>")
    _build_validator_menu(
        main_subparser=sub_parsers,
        validator_name="Enketo",
        updater_instance=EnketoValidateUpdater(),
    )
    _build_validator_menu(
        main_subparser=sub_parsers,
        validator_name="ODK",
        updater_instance=ODKValidateUpdater(),
    )
    return main_parser


def main_cli():
    logger = logging.getLogger(name="pyxform_validator_update")
    logger.addHandler(logging.StreamHandler())
    logger.setLevel(logging.INFO)

    try:
        parser = _create_parser()
        args = parser.parse_args()
        kwargs = args.__dict__.copy()
        del kwargs["command"]
        args.command(**kwargs)
    except PyXFormError as main_error:
        logger.info(unicode(main_error))
        sys.exit(1)
    if 0 < len(capture_handler.watcher.records):
        for line in capture_handler.watcher.output["INFO"]:
            logger.info(line)


if __name__ == "__main__":
    main_cli()
