#!/usr/bin/env python3
"""
Servidor HTTP seguro para o Ponto app.
Bloqueia: .git, dotfiles, listagem de diretorio, e path traversal.
"""
import http.server, socketserver, os, sys, posixpath, urllib.parse

PORT = int(os.environ.get("PORT", "8085"))
DIRECTORY = os.environ.get("SERVE_DIR", os.path.dirname(os.path.abspath(__file__)))

# Pastas/arquivos que NUNCA devem ser servidos
BLOCKED_PREFIXES = (".git", ".bak", "node_modules", "start_tunnel.sh", "serve.py")
BLOCKED_EXTS = (".py", ".mjs", ".sh", ".bak", ".log", ".apk")

class SafeHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def _is_blocked(self, path):
        parts = [p for p in path.split("/") if p]
        for p in parts:
            if p.startswith("."):          # qualquer dotfile/dir (.git, .env, .bak)
                return True
            base = p.lower()
            if base.startswith(BLOCKED_PREFIXES):
                return True
            if base.endswith(BLOCKED_EXTS):
                return True
        return False

    def list_directory(self, path):
        # Desabilita listagem de diretorio -> 403
        self.send_error(403, "Directory listing disabled")
        return None

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if self._is_blocked(urllib.parse.unquote(parsed.path)):
            self.send_error(404, "Not found")
            return
        return super().do_GET()

    def do_HEAD(self):
        parsed = urllib.parse.urlparse(self.path)
        if self._is_blocked(urllib.parse.unquote(parsed.path)):
            self.send_error(404, "Not found")
            return
        return super().do_HEAD()

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

class ReuseTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

if __name__ == "__main__":
    with ReuseTCPServer(("127.0.0.1", PORT), SafeHandler) as httpd:
        print(f"Ponto seguro servindo {DIRECTORY} em http://127.0.0.1:{PORT}")
        httpd.serve_forever()
