# -*- coding: utf-8 -*-
"""
Test validator update cli command.
"""
import os
import platform
import shutil
import tempfile
from contextlib import contextmanager
from datetime import datetime, timedelta
from stat import S_IXGRP, S_IXUSR
from zipfile import ZipFile

from unittest2 import TestCase, skipIf

from pyxform.errors import PyXFormError
from pyxform.tests import validators
from pyxform.tests.validators.server import ThreadingServerInThread
from pyxform.utils import unicode
from pyxform.validators.updater import (
    EnketoValidateUpdater,
    _UpdateHandler,
    _UpdateInfo,
    capture_handler,
)

try:
    from zipfile import BadZipFile
except ImportError:
    from zipfile import BadZipfile as BadZipFile


TEST_PATH = validators.HERE


def install_check_ok(bin_file_path=None):
    return True


def install_check_fail(bin_file_path=None):
    return False


def get_update_info(check_ok, mod_root=None):
    """
    Get an UpdateInfo for testing use.

    :type check_ok: bool
    :type mod_root: str
    :return: _UpdateInfo
    """
    if check_ok:
        install_check = install_check_ok
    else:
        install_check = install_check_fail
    return _UpdateInfo(
        api_url="",
        repo_url="",
        validate_subfolder="",
        install_check=install_check,
        validator_basename="validate",
        mod_root=mod_root,
    )


@contextmanager
def get_temp_file():
    temp_file = tempfile.NamedTemporaryFile(delete=False)
    temp_file.close()
    try:
        yield temp_file.name
    finally:
        temp_file.close()
        if os.path.exists(temp_file.name):
            os.remove(temp_file.name)


@contextmanager
def get_temp_dir():
    temp_dir = tempfile.mkdtemp()
    try:
        yield temp_dir
    finally:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)


class TestTempUtils(TestCase):
    def test_get_temp_file(self):
        """Should provide a temp file that's cleared on exit."""
        with get_temp_file() as temp_file:
            self.assertTrue(os.path.exists(temp_file))
            self.assertTrue(os.path.isfile(temp_file))
        self.assertFalse(os.path.exists(temp_file))

    def test_get_temp_dir(self):
        """Should provide a temp dir that's cleared on exit."""
        with get_temp_dir() as temp_dir:
            self.assertTrue(os.path.exists(temp_dir))
            self.assertTrue(os.path.isdir(temp_dir))
        self.assertFalse(os.path.exists(temp_dir))


class TestUpdateHandler(TestCase):

    server = ThreadingServerInThread()

    @classmethod
    def setUpClass(cls):
        cls.server.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.stop()

    def setUp(self):
        self.update_info = get_update_info(check_ok=True)
        self.updater = _UpdateHandler()
        data_dir = os.path.join(TEST_PATH, "data")
        self.latest_enketo = os.path.join(data_dir, "latest_enketo.json")
        self.latest_odk = os.path.join(data_dir, "latest_odk.json")
        self.last_check = os.path.join(TEST_PATH, ".last_check")
        self.last_check_none = os.path.join(TEST_PATH, ".last_check_none")
        self.phantom_file = os.path.join(TEST_PATH, ".not_there")
        self.utc_now = datetime.utcnow()
        capture_handler.reset()
        self.zip_file = os.path.join(data_dir, "linux-ideal.zip")
        self.zip_file_ideal = os.path.join(data_dir, "linux-ideal.zip")
        self.zip_file_dupes = os.path.join(data_dir, "linux-dupes.zip")
        self.install_fake = os.path.join(data_dir, "install_fake.json")
        self.install_fake_old = os.path.join(data_dir, "install_fake_old.json")

    def test_request_latest_json(self):
        """Should return version info dict containing asset list."""
        self.update_info.api_url = "http://localhost:8000/latest_enketo.json"
        observed = self.updater._request_latest_json(url=self.update_info.api_url)
        self.assertIn("assets", observed)

    def test_check_path__raises(self):
        """Should raise an error if the path doesn't exist."""
        file_path = os.path.join(TEST_PATH, "data", "non_existent.json")
        with self.assertRaises(PyXFormError):
            self.updater._check_path(file_path=file_path)

    def test_check_path__file(self):
        """Should return True if the file path exists."""
        self.assertTrue(self.updater._check_path(file_path=self.last_check))

    def test_check_path__dir(self):
        """Should return True if the directory path exists."""
        self.assertTrue(self.updater._check_path(file_path=TEST_PATH))

    def test_read_json(self):
        """Should return version info dict containing asset list."""
        file_path = self.latest_enketo
        observed = self.updater._read_json(file_path=file_path)
        self.assertIn("assets", observed)

    def test_write_json(self):
        """Should write the supplied dict to a file."""
        with get_temp_file() as temp_file:
            self.assertEqual(0, os.path.getsize(temp_file))
            self.updater._write_json(file_path=temp_file, content={"some": "data"})
            self.assertTrue(20 <= os.path.getsize(temp_file))

    def test_read_last_check(self):
        """Should return a datetime from the last_check file."""
        file_path = self.last_check
        last_check = self.updater._read_last_check(file_path=file_path)
        self.assertTrue(isinstance(last_check, datetime))

    def test_write_last_check(self):
        """Should write the supplied datetime to a file."""
        with get_temp_file() as temp_file:
            self.assertEqual(0, os.path.getsize(temp_file))
            self.updater._write_last_check(
                file_path=temp_file, content=datetime.utcnow()
            )
            self.assertEqual(20, os.path.getsize(temp_file))

    def test_check_necessary__true_if_last_check_not_found(self):
        """Should return true if the last check file wasn't found."""
        self.update_info.last_check_path = self.phantom_file
        self.assertTrue(
            self.updater._check_necessary(
                update_info=self.update_info, utc_now=self.utc_now
            )
        )

    def test_check_necessary__true_if_latest_json_not_found(self):
        """Should return true if the latest.json file wasn't found."""
        self.update_info.last_check_path = self.last_check
        self.update_info.latest_path = self.phantom_file
        self.assertTrue(
            self.updater._check_necessary(
                update_info=self.update_info, utc_now=self.utc_now
            )
        )

    def test_check_necessary__true_if_last_check_empty(self):
        """Should return true if the last check file was empty."""
        self.update_info.last_check_path = os.path.join(TEST_PATH, ".last_check_none")
        self.update_info.latest_path = self.latest_enketo
        self.assertTrue(
            self.updater._check_necessary(
                update_info=self.update_info, utc_now=self.utc_now
            )
        )

    def test_check_necessary__true_if_last_check_too_old(self):
        """Should return true if the last check was too long ago."""
        self.update_info.last_check_path = self.last_check
        self.update_info.latest_path = self.latest_enketo
        old = self.utc_now - timedelta(minutes=45.0)
        self.assertTrue(
            self.updater._check_necessary(update_info=self.update_info, utc_now=old)
        )

    def test_check_necessary__false_last_check_very_recent(self):
        """Should return false if the last check was very recent."""
        new = self.utc_now - timedelta(minutes=10.0)

        with get_temp_file() as temp_file:
            self.updater._write_last_check(file_path=temp_file, content=new)
            self.update_info.last_check_path = temp_file
            self.update_info.latest_path = self.latest_enketo
            self.assertFalse(
                self.updater._check_necessary(
                    update_info=self.update_info, utc_now=self.utc_now
                )
            )

    def test_get_latest__if_check_necessary_true(self):
        """Should get latest from remote, rather than file."""
        self.update_info.api_url = "http://localhost:8000/latest_enketo.json"
        old = self.utc_now - timedelta(minutes=45.0)

        with get_temp_file() as temp_check, get_temp_file() as temp_json:
            self.updater._write_last_check(file_path=temp_check, content=old)
            self.update_info.last_check_path = temp_check
            self.update_info.latest_path = temp_json
            latest = self.updater._get_latest(update_info=self.update_info)
        self.assertEqual("1.0.3", latest["name"])

    def test_get_latest__if_check_necessary_false(self):
        """Should get latest from file, rather than remote."""
        self.update_info.latest_path = self.latest_odk
        new = self.utc_now - timedelta(minutes=15.0)

        with get_temp_file() as temp_check:
            self.updater._write_last_check(file_path=temp_check, content=new)
            self.update_info.last_check_path = temp_check
            latest = self.updater._get_latest(update_info=self.update_info)
        self.assertEqual("ODK Validate v1.8.0", latest["name"])

    def test_list__not_installed_no_files(self):
        """Should log an info message - no installed version, no files."""
        self.update_info.installed_path = self.phantom_file
        self.update_info.latest_path = self.latest_odk

        with get_temp_file() as temp_check:
            self.updater._write_last_check(file_path=temp_check, content=self.utc_now)
            self.update_info.last_check_path = temp_check
            self.updater.list(update_info=self.update_info)
        info = capture_handler.watcher.output["INFO"][0]
        self.assertIn("Installed release:\n\n- None!", info)
        self.assertIn("Files available:\n\n- None!", info)

    def test_list__not_installed_with_files(self):
        """Should log an info message - no installed version, with files."""
        self.update_info.installed_path = self.phantom_file
        self.update_info.latest_path = self.latest_enketo

        with get_temp_file() as temp_check:
            self.updater._write_last_check(file_path=temp_check, content=self.utc_now)
            self.update_info.last_check_path = temp_check
            self.updater.list(update_info=self.update_info)
        info = capture_handler.watcher.output["INFO"][0]
        self.assertIn("Installed release:\n\n- None!", info)
        self.assertIn("- windows.zip", info)

    def test_list__installed_no_files(self):
        """Should log an info message - installed version, no files."""
        self.update_info.installed_path = self.latest_enketo
        self.update_info.latest_path = self.latest_odk

        with get_temp_file() as temp_check:
            self.updater._write_last_check(file_path=temp_check, content=self.utc_now)
            self.update_info.last_check_path = temp_check
            self.updater.list(update_info=self.update_info)
        info = capture_handler.watcher.output["INFO"][0]
        self.assertIn("Installed release:\n\n- Tag name = 1.0.3", info)
        self.assertIn("Files available:\n\n- None!", info)

    def test_list__installed_with_files(self):
        """Should log an info message - installed version, with files."""
        self.update_info.installed_path = self.latest_enketo
        self.update_info.latest_path = self.latest_enketo

        with get_temp_file() as temp_check:
            self.updater._write_last_check(file_path=temp_check, content=self.utc_now)
            self.update_info.last_check_path = temp_check
            self.updater.list(update_info=self.update_info)
        info = capture_handler.watcher.output["INFO"][0]
        self.assertIn("Installed release:\n\n- Tag name = 1.0.3", info)
        self.assertIn("- windows.zip", info)

    def test_find_download_url__no_files(self):
        """Should raise an error if no files attached to release."""
        file_name = "windows.zip"
        json_data = self.updater._read_json(file_path=self.latest_odk)

        with self.assertRaises(PyXFormError) as ctx:
            self.updater._find_download_url(
                update_info=self.update_info, json_data=json_data, file_name=file_name
            )
        self.assertIn("No files attached", unicode(ctx.exception))

    def test_find_download_url__not_found(self):
        """Should raise an error if the file was not found."""
        file_name = "windows.zip"
        json_data = self.updater._read_json(file_path=self.latest_enketo)
        json_data["assets"] = [x for x in json_data["assets"] if x["name"] != file_name]

        with self.assertRaises(PyXFormError) as ctx:
            self.updater._find_download_url(
                update_info=self.update_info, json_data=json_data, file_name=file_name
            )
        self.assertIn("No files with the name", unicode(ctx.exception))

    def test_find_download_url__duplicates(self):
        """Should raise an error if the file was found more than once."""
        file_name = "windows.zip"
        json_data = self.updater._read_json(file_path=self.latest_enketo)
        file_dicts = [x for x in json_data["assets"] if x["name"] == file_name]
        json_data["assets"].append(file_dicts[0])

        with self.assertRaises(PyXFormError) as ctx:
            self.updater._find_download_url(
                update_info=self.update_info, json_data=json_data, file_name=file_name
            )
        self.assertIn("2 files with the name", unicode(ctx.exception))

    def test_find_download_url__ok(self):
        """Should return the url for the matching file name."""
        file_name = "windows.zip"
        json_data = self.updater._read_json(file_path=self.latest_enketo)
        expected = (
            "https://github.com/enketo/enketo-validate/releases/"
            "download/1.0.3/windows.zip"
        )

        observed = self.updater._find_download_url(
            update_info=self.update_info, json_data=json_data, file_name=file_name
        )
        self.assertEqual(expected, observed)

    def test_download_file(self):
        """Should download the file from the url to the the target path."""
        self.update_info.api_url = "http://localhost:8000/.small_file"
        with get_temp_file() as temp_file:
            self.assertEqual(0, os.path.getsize(temp_file))
            self.updater._download_file(
                url=self.update_info.api_url, file_path=temp_file
            )
            self.assertEqual(13, os.path.getsize(temp_file))

    def test_get_bin_paths__ok(self):
        """Should return the path mappings."""
        file_path = os.path.join(TEST_PATH, "linux.zip")
        observed = self.updater._get_bin_paths(
            update_info=self.update_info, file_path=file_path
        )
        self.assertEqual(3, len(observed))

    def test_get_bin_paths__unsupported_raises(self):
        """Should raise an error if a mapping for the file name isn't found."""
        file_path = self.last_check = os.path.join(TEST_PATH, "bacon.zip")
        with self.assertRaises(PyXFormError) as ctx:
            self.updater._get_bin_paths(
                update_info=self.update_info, file_path=file_path
            )
        self.assertIn("Did not find", unicode(ctx.exception))

    def test_unzip_find_zip_jobs__ok_real_current(self):
        """Should return a list of zip jobs same length as search."""
        with get_temp_dir() as temp_dir, ZipFile(self.zip_file, mode="r") as zip_file:
            bin_paths = self.updater._get_bin_paths(
                update_info=self.update_info, file_path=self.zip_file
            )
            jobs = self.updater._unzip_find_jobs(
                open_zip_file=zip_file, bin_paths=bin_paths, out_path=temp_dir
            )
        self.assertEqual(3, len(jobs.keys()))
        self.assertTrue(list(jobs.keys())[0].startswith(temp_dir))

    def test_unzip_find_zip_jobs__ok_real_ideal(self):
        """Should return a list of zip jobs same length as search."""
        with get_temp_dir() as temp_dir, ZipFile(
            self.zip_file_ideal, mode="r"
        ) as zip_file:
            bin_paths = self.updater._get_bin_paths(
                update_info=self.update_info, file_path=self.zip_file_ideal
            )
            jobs = self.updater._unzip_find_jobs(
                open_zip_file=zip_file, bin_paths=bin_paths, out_path=temp_dir
            )
        self.assertEqual(3, len(jobs.keys()))
        self.assertTrue(list(jobs.keys())[0].startswith(temp_dir))

    def test_unzip_find_zip_jobs__ok_real_dupes(self):
        """Should return a list of zip jobs same length as search."""
        with get_temp_dir() as temp_dir, ZipFile(
            self.zip_file_dupes, mode="r"
        ) as zip_file:
            bin_paths = self.updater._get_bin_paths(
                update_info=self.update_info, file_path=self.zip_file_dupes
            )
            jobs = self.updater._unzip_find_jobs(
                open_zip_file=zip_file, bin_paths=bin_paths, out_path=temp_dir
            )
        self.assertEqual(3, len(jobs.keys()))
        self.assertTrue(list(jobs.keys())[0].startswith(temp_dir))

    def test_unzip_find_zip_jobs__not_found_raises(self):
        """Should raise an error if zip jobs isn't same length as search."""
        bin_paths = [(".non_existent", ".non_existent")]

        with get_temp_dir() as temp_dir, ZipFile(
            self.zip_file, mode="r"
        ) as zip_file, self.assertRaises(PyXFormError) as ctx:
            self.updater._unzip_find_jobs(
                open_zip_file=zip_file, bin_paths=bin_paths, out_path=temp_dir
            )
        self.assertIn("1 zip job files, found: 0", unicode(ctx.exception))

    def test_unzip_extract_file__ok(self):
        """Should extract the specified item to the target output path."""
        with get_temp_dir() as temp_dir, ZipFile(self.zip_file, mode="r") as zip_file:
            zip_item = zip_file.infolist()[0]
            file_out_path = os.path.join(temp_dir, "validate")
            self.updater._unzip_extract_file(
                open_zip_file=zip_file, zip_item=zip_item, file_out_path=file_out_path
            )
            self.assertTrue(os.path.exists(file_out_path))

    def test_unzip_extract_file__bad_crc_raises(self):
        """Should raise an error if the zip file CRC doesn't match."""
        with get_temp_dir() as temp_dir, ZipFile(
            self.zip_file, mode="r"
        ) as zip_file, self.assertRaises(BadZipFile) as ctx:
            zip_item = [
                x for x in zip_file.infolist() if x.filename.endswith("validate")
            ][0]
            zip_item.CRC = 12345
            file_out_path = os.path.join(temp_dir, "validate")
            self.updater._unzip_extract_file(
                open_zip_file=zip_file, zip_item=zip_item, file_out_path=file_out_path
            )
        self.assertIn("Bad CRC-32 for file", unicode(ctx.exception))

    def test_unzip(self):
        """Should unzip the file to the locations in the bin_path map."""
        with get_temp_dir() as temp_dir:
            self.updater._unzip(
                update_info=self.update_info, file_path=self.zip_file, out_path=temp_dir
            )
            dir_list = [
                os.path.join(r, f) for r, _, fs in os.walk(temp_dir) for f in fs
            ]
            self.assertEqual(3, len(dir_list))

    def test_install__ok(self):
        """Should install the latest release and return it's info dict."""
        self.update_info.latest_path = self.install_fake
        new = self.utc_now - timedelta(minutes=15.0)

        with get_temp_file() as temp_check, get_temp_dir() as temp_dir:
            self.updater._write_last_check(file_path=temp_check, content=new)
            self.update_info.last_check_path = temp_check
            self.update_info.bin_new_path = temp_dir
            installed = self.updater._install(
                update_info=self.update_info, file_name="linux.zip"
            )
            dir_list = [
                os.path.join(r, f) for r, _, fs in os.walk(temp_dir) for f in fs
            ]
            self.assertEqual(5, len(dir_list))

        latest = self.updater._read_json(file_path=self.install_fake)
        self.assertDictEqual(latest, installed)

    @skipIf(platform.system() == "Windows", "Exec bits can't be set on Windows")
    def test_install__add_executable_mode(self):
        """Should add executable mode to the new bin file's modes."""
        self.update_info.latest_path = self.install_fake
        new = self.utc_now - timedelta(minutes=15.0)

        with get_temp_file() as temp_check, get_temp_dir() as temp_dir:
            self.updater._write_last_check(file_path=temp_check, content=new)
            self.update_info.last_check_path = temp_check
            self.update_info.bin_new_path = temp_dir
            self.updater._install(update_info=self.update_info, file_name="linux.zip")
            bin_new = os.path.join(temp_dir, self.update_info.validator_basename)
            bin_new_stat_mode = os.stat(bin_new).st_mode
            self.assertEqual(bin_new_stat_mode & S_IXUSR, S_IXUSR)
            self.assertEqual(bin_new_stat_mode & S_IXGRP, S_IXGRP)

    def test_replace_old_bin_path(self):
        """Should delete the old bin path and move new into it's place."""
        with get_temp_dir() as installed, get_temp_dir() as staging:
            self.update_info.bin_path = installed
            self.update_info.bin_new_path = staging
            lcp = os.path.join(staging, ".last_check")
            self.updater._write_last_check(file_path=lcp, content=self.utc_now)
            self.updater._replace_old_bin_path(update_info=self.update_info)

            self.assertFalse(os.path.exists(staging))
            self.assertEqual(1, len(os.listdir(installed)))
            self.assertTrue(os.path.exists(installed))

    def test_update__not_installed__ok(self):
        """Should install and show a message with relevant info."""
        new = self.utc_now - timedelta(minutes=15.0)

        with get_temp_dir() as mod_root:
            update_info = get_update_info(check_ok=True, mod_root=mod_root)
            update_info.latest_path = self.install_fake
            self.updater._write_last_check(
                file_path=update_info.last_check_path, content=new
            )

            expected_path = os.path.join(update_info.bin_path, "validate")
            self.assertFalse(os.path.exists(expected_path))
            self.updater.update(update_info=update_info, file_name="linux.zip")
            self.assertTrue(os.path.exists(expected_path))

        info = capture_handler.watcher.output["INFO"][0]
        self.assertIn("Update success!", info)

    def test_update__not_installed__fail__install_check(self):
        """Should stop install and raise an error with relevant info."""
        new = self.utc_now - timedelta(minutes=15.0)

        with get_temp_dir() as mod_root, self.assertRaises(PyXFormError) as ctx:
            update_info = get_update_info(check_ok=False, mod_root=mod_root)
            update_info.latest_path = self.install_fake
            self.updater._write_last_check(
                file_path=update_info.last_check_path, content=new
            )

            self.assertFalse(os.path.exists(update_info.bin_path))
            self.updater.update(update_info=update_info, file_name="linux.zip")
            self.assertFalse(os.path.exists(update_info.bin_path))
            self.assertTrue(os.path.exists(update_info.bin_new_path))

        error = unicode(ctx.exception)
        self.assertIn("Update failed!", error)
        self.assertIn("latest release does not appear to work", error)

    def test_update__installed__ok(self):
        """Should update and show a message with relevant info."""
        new = self.utc_now - timedelta(minutes=15.0)

        with get_temp_dir() as mod_root:
            update_info = get_update_info(check_ok=True, mod_root=mod_root)
            update_info.latest_path = self.install_fake_old
            self.updater._write_last_check(
                file_path=update_info.last_check_path, content=new
            )

            self.updater.update(update_info=update_info, file_name="linux.zip")
            update_info.latest_path = self.install_fake
            self.updater.update(update_info=update_info, file_name="linux.zip")

        info = capture_handler.watcher.output["INFO"][0]
        self.assertIn("Update success!", info)
        self.assertIn("Install check of the latest release succeeded", info)

    def test_update__installed__fail__already_latest(self):
        """Should stop install and raise an error with relevant info."""
        new = self.utc_now - timedelta(minutes=15.0)

        with get_temp_dir() as mod_root, self.assertRaises(PyXFormError) as ctx:
            update_info = get_update_info(check_ok=True, mod_root=mod_root)
            update_info.latest_path = self.install_fake
            self.updater._write_last_check(
                file_path=update_info.last_check_path, content=new
            )

            self.updater.update(update_info=update_info, file_name="linux.zip")
            update_info.latest_path = self.install_fake
            self.updater.update(update_info=update_info, file_name="linux.zip")

        error = unicode(ctx.exception)
        self.assertIn("Update failed!", error)
        self.assertIn("installed release appears to be the latest", error)

    def test_update__installed__fail__install_check(self):
        """Should stop install and raise an error with relevant info."""
        new = self.utc_now - timedelta(minutes=15.0)

        with get_temp_dir() as mod_root, self.assertRaises(PyXFormError) as ctx:
            update_info = get_update_info(check_ok=False, mod_root=mod_root)
            update_info.latest_path = self.install_fake
            self.updater._write_last_check(
                file_path=update_info.last_check_path, content=new
            )

            self.updater.update(update_info=update_info, file_name="linux.zip")
            update_info.latest_path = self.install_fake
            self.updater.update(update_info=update_info, file_name="linux.zip")

            self.assertFalse(os.path.exists(update_info.bin_path))
            self.assertTrue(os.path.exists(update_info.bin_new_path))

        error = unicode(ctx.exception)
        self.assertIn("Update failed!", error)
        self.assertIn("latest release does not appear to work", error)

    def test_check__fail__not_installed(self):
        """Should raise an error if there's no installation detected."""
        self.update_info.installed_path = os.path.join(TEST_PATH, ".nothing")
        with self.assertRaises(PyXFormError) as ctx:
            self.updater.check(self.update_info)

        error = unicode(ctx.exception)
        self.assertIn("Check failed!", error)
        self.assertIn("No installed release found", error)

    def test_check__ok(self):
        """Should show a message with relevant info."""
        new = self.utc_now - timedelta(minutes=15.0)

        with get_temp_dir() as mod_root:
            update_info = get_update_info(check_ok=True, mod_root=mod_root)
            update_info.latest_path = self.install_fake_old
            self.updater._write_last_check(
                file_path=update_info.last_check_path, content=new
            )

            self.updater.update(update_info=update_info, file_name="linux.zip")
            self.updater.check(update_info=update_info)

        info = capture_handler.watcher.output["INFO"][1]
        self.assertIn("Check success!", info)
        self.assertIn("installed release appears to work", info)

    def test_check__fail__install_check(self):
        """Should raise an error if the installation check fails."""
        new = self.utc_now - timedelta(minutes=15.0)

        with get_temp_dir() as mod_root, self.assertRaises(PyXFormError) as ctx:
            update_info = get_update_info(check_ok=True, mod_root=mod_root)
            update_info.latest_path = self.install_fake_old
            self.updater._write_last_check(
                file_path=update_info.last_check_path, content=new
            )

            self.updater.update(update_info=update_info, file_name="linux.zip")
            update_info.install_check = install_check_fail
            self.updater.check(update_info=update_info)

        error = unicode(ctx.exception)
        self.assertIn("Check failed!", error)
        self.assertIn("installed release does not appear to work", error)

    def test_enketo_validate_updater__install_check_routing_ok(self):
        """Should call the install check on the UpdateInfo instance."""
        ev = EnketoValidateUpdater()
        ev.update_info.install_check = install_check_ok
        ev.update_info.installed_path = self.install_fake
        self.assertTrue(ev.check())

    def test_enketo_validate_updater__install_check_routing_fail(self):
        """Should raise if the install check function is bogus."""
        ev = EnketoValidateUpdater()
        ev.update_info.install_check = None
        ev.update_info.installed_path = self.install_fake
        with self.assertRaises(TypeError):
            ev.check()
