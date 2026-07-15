import os
import sys
import http.server
import socketserver
import functools


class NoCacheRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Dev server only — without this, browsers apply heuristic caching to
    index.html (it has no cache-busting query string), so an open tab can
    keep serving an old build after main.js/styles.css change underneath
    it, silently missing new features. Forcing revalidation on every
    response is what makes 'edit source, reload tab' reliable."""

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


class ThreadingHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    """A lingering keep-alive connection (e.g. from a tunnel client) would
    otherwise block every other request behind it, since TCPServer handles
    one connection at a time. daemon_threads lets the process exit cleanly
    even if a client never closes its connection."""

    daemon_threads = True
    allow_reuse_address = True


directory = sys.argv[1]
port = int(os.environ.get("PORT") or sys.argv[2])
Handler = functools.partial(NoCacheRequestHandler, directory=directory)
with ThreadingHTTPServer(("", port), Handler) as httpd:
    httpd.serve_forever()
