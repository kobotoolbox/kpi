# -*- coding: utf-8 -*-
"""
The validators utility functions.
"""
import collections
import io
import logging
import os
import signal
import subprocess
import threading
import time
from contextlib import closing
from subprocess import PIPE, Popen

from pyxform.errors import PyXFormError

try:
    from urllib.request import urlopen, Request
    from urllib.error import URLError, HTTPError
except ImportError:
    from urllib2 import urlopen, Request, URLError, HTTPError


HERE = os.path.abspath(os.path.dirname(__file__))
XFORM_SPEC_PATH = os.path.join(
    os.path.dirname(HERE), "tests", "test_expected_output", "xlsform_spec_test.xml"
)


# Adapted from:
# http://betabug.ch/blogs/ch-athens/1093
def run_popen_with_timeout(command, timeout):
    """
    Run a sub-program in subprocess.Popen, pass it the input_data,
    kill it if the specified timeout has passed.
    returns a tuple of resultcode, timeout, stdout, stderr
    """
    kill_check = threading.Event()

    def _kill_process_after_a_timeout(pid):
        os.kill(pid, signal.SIGTERM)
        kill_check.set()  # tell the main routine that we had to kill
        # use SIGKILL if hard to kill...
        return

    # Workarounds for pyinstaller
    # https://github.com/pyinstaller/pyinstaller/wiki/Recipe-subprocess
    startup_info = None
    if os.name == "nt":
        # disable command window when run from pyinstaller
        startup_info = subprocess.STARTUPINFO()
        # Less fancy version of bitwise-or-assignment (x |= y) shown in ref url.
        if startup_info.dwFlags == 1 or subprocess.STARTF_USESHOWWINDOW == 1:
            startup_info.dwFlags = 1
        else:
            startup_info.dwFlags = 0

    p = Popen(command, stdin=PIPE, stdout=PIPE, stderr=PIPE, startupinfo=startup_info)
    watchdog = threading.Timer(timeout, _kill_process_after_a_timeout, args=(p.pid,))
    watchdog.start()
    (stdout, stderr) = p.communicate()
    watchdog.cancel()  # if it's still waiting to run
    timeout = kill_check.isSet()
    kill_check.clear()
    return p.returncode, timeout, stdout, stderr


def decode_stream(stream):
    """
    Decode a stream, e.g. stdout or stderr.

    On Windows, stderr may be latin-1; in which case utf-8 decode will fail.
    If both utf-8 and latin-1 decoding fail then raise all as IOError.
    If the above validate jar call fails, add make sure that the java path
    is set, e.g. PATH=C:\\Program Files (x86)\\Java\\jre1.8.0_71\\bin
    """
    try:
        return stream.decode("utf-8")
    except UnicodeDecodeError as ude:
        try:
            return stream.decode("latin-1")
        except BaseException as be:
            msg = "Failed to decode validate stderr as utf-8 or latin-1."
            raise IOError(msg, ude, be)


def request_get(url):
    """
    Get the response content from URL.
    """
    try:
        r = Request(url)
        r.add_header("Accept", "application/json")
        with closing(urlopen(r)) as u:
            content = u.read()
        if len(content) == 0:
            raise PyXFormError("Empty response from URL: '{u}'.".format(u=url))
        else:
            return content
    except HTTPError as e:
        raise PyXFormError(
            "Unable to fulfill request. Error code: '{c}'. "
            "Reason: '{r}'. URL: '{u}'."
            "".format(r=e.reason, c=e.code, u=url)
        )
    except URLError as e:
        raise PyXFormError(
            "Unable to reach a server. Reason: {r}. "
            "URL: {u}".format(r=e.reason, u=url)
        )


class CapturingHandler(logging.Handler):
    """
    A logging handler capturing all (raw and formatted) logging output.

    Similar concept to "from unittest.case import _CapturingHandler". However
    the watcher.output is a dict keyed by the log level name, instead of a list
    of messages. The watcher.records list has the full LogRecord instances
    which carry extra data about the log source and context.

    Usage:
    Here's how to attach it to a logger, get some logs, and then detach it.

    my_logger = logging.getLogger(name="logger_name")
    capture_handler = CapturingHandler(logger=my_logger)
    info_log_messages = capture_handler.watcher.output["INFO"]
    log_records = capture_handler.watcher.records
    my_logger.removeHandler(hdlr=capture_handler)
    """

    def __init__(self, logger):
        logging.Handler.__init__(self)
        self.watcher = self._get_watcher()
        logger.addHandler(self)
        logger.propagate = False
        logger.setLevel("INFO")
        self.setFormatter(logging.Formatter("%(message)s"))

    def flush(self):
        pass

    def emit(self, record):
        self.watcher.records.append(record)
        msg = self.format(record)
        self.watcher.output[record.levelname].append(msg)

    @staticmethod
    def _get_watcher():
        _LoggingWatcher = collections.namedtuple(
            "_LoggingWatcher", ["records", "output"]
        )
        levels = ["CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"]
        return _LoggingWatcher([], {x: [] for x in levels})

    def reset(self):
        self.watcher = self._get_watcher()


def check_readable(file_path, retry_limit=10, wait_seconds=0.5):
    """
    Check if a file is readable: True if so, IOError if not. Retry as per args.

    If a file that needs to be read may be locked by some other process (such
    as for reading or writing), this can help avoid an error by waiting for the
    lock to clear.

    :param file_path: Path to file to check.
    :param retry_limit: Number of attempts to read the file.
    :param wait_seconds: Amount of sleep time between read attempts.
    :return: True or raise IOError.
    """

    def catch_try():
        try:
            with io.open(file_path, mode="r"):
                return True
        except IOError:
            return False

    tries = 0
    while not catch_try():
        if tries < retry_limit:
            tries += 1
            time.sleep(wait_seconds)
        else:
            raise IOError("Could not read file: {f}".format(f=file_path))
    return True
