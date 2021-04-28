# -*- coding: utf-8 -*-
import os
import posixpath
import threading

try:
    from http.server import SimpleHTTPRequestHandler
    from socketserver import ThreadingTCPServer
    from urllib.parse import unquote
except ImportError:
    from SimpleHTTPServer import SimpleHTTPRequestHandler
    from SocketServer import ThreadingTCPServer
    from urllib2 import unquote


HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")


class SimpleHTTPRequestHandlerHere(SimpleHTTPRequestHandler, object):
    def send_head(self):
        if self.client_address[0] != "127.0.0.1":
            self.send_error(
                401, "Unauthorized", "No permission -- see authorization schemes"
            )
            return None
        else:
            return super(SimpleHTTPRequestHandlerHere, self).send_head()

    def translate_path(self, path):
        """
        Ignore the actual request path and just serve a specific folder.

        Mostly same as py3.6 source, replacing "path = os.getcwd()" with HERE so
        that the directory list or file transfers are relative to HERE rather
        than the current working directory.
        """
        # abandon query parameters
        path = path.split("?", 1)[0]
        path = path.split("#", 1)[0]
        # Don"t forget explicit trailing slash when normalizing. Issue17324
        trailing_slash = path.rstrip().endswith("/")
        try:
            path = unquote(path, errors="surrogatepass")
        except UnicodeDecodeError:
            path = unquote(path)
        except TypeError:  # py2 only accepts one param.
            path = unquote(path)
        path = posixpath.normpath(path)
        words = path.split("/")
        words = filter(None, words)
        path = HERE  # edited
        for word in words:
            if os.path.dirname(word) or word in (os.curdir, os.pardir):
                # Ignore components that are not a simple file/directory name
                continue
            path = os.path.join(path, word)
        if trailing_slash:
            path += "/"
        return path

    def log_message(self, format, *args):
        pass  # be quiet


class ThreadingServerInThread(object):
    """
    Context manager for running a threading http server in a thread.

    Since the Thread is not using "daemon=True", it will keep Python running
    until the context manager exits, which means until request completion.
    """

    def __init__(self, port=8000):
        self._server_address = ("127.0.0.1", port)
        self._handler = SimpleHTTPRequestHandlerHere
        self.httpd = ThreadingTCPServer(
            self._server_address, self._handler, bind_and_activate=False
        )

    def _bind_and_activate(self):
        try:
            self.httpd.server_bind()
            self.httpd.server_activate()
        except Exception as e:
            self.httpd.server_close()
            raise e

    def start(self):
        self._bind_and_activate()
        thread = threading.Thread(target=self.httpd.serve_forever)
        thread.start()

    def stop(self):
        self.httpd.shutdown()
        self.httpd.server_close()

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.stop()
