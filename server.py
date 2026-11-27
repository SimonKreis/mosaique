#!/usr/bin/env python3
"""Mosaïque — petit serveur local.

Sert l'interface (web/), donne la liste des écrans, enregistre les images
gardées et applique un fond d'écran via `omarchy theme bg set`. Aucun accès réseau.
"""

import json
import os
import shutil
import subprocess
import time
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"
JOURNAL = Path(os.environ.get("MOSAIQUE_JOURNAL", ROOT / "data" / "journal.jsonl")).expanduser()
PORT = int(os.environ.get("MOSAIQUE_PORT", "8765"))
MAX_UPLOAD = 64 * 1024 * 1024



def keep_dir():
    """Dossier des fonds d'écran : MOSAIQUE_KEEP_DIR, sinon celui du thème Omarchy actif,
    sinon ~/Pictures/mosaique. Relu à chaque enregistrement pour suivre un changement de thème."""
    if os.environ.get("MOSAIQUE_KEEP_DIR"):
        return Path(os.environ["MOSAIQUE_KEEP_DIR"]).expanduser()
    theme = Path("~/.local/state/omarchy/current/theme.name").expanduser()
    if theme.is_file() and theme.read_text().strip():
        return Path("~/.config/omarchy/backgrounds").expanduser() / theme.read_text().strip()
    return Path("~/Pictures/mosaique").expanduser()


def screens():
    try:
        out = subprocess.run(["hyprctl", "monitors", "-j"], capture_output=True, text=True, timeout=3).stdout
        result = []
        for m in json.loads(out):
            w, h = m["width"], m["height"]
            if m.get("transform", 0) % 2 == 1:
                w, h = h, w
            result.append({"name": m["name"], "width": w, "height": h, "description": m.get("description", "")})
        if result:
            return result
    except Exception:
        pass
    return [{"name": "défaut", "width": 3840, "height": 2160, "description": ""}]


def journal(entry):
    JOURNAL.parent.mkdir(parents=True, exist_ok=True)
    with JOURNAL.open("a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def safe_name(name):
    keep = "".join(c if c.isalnum() or c in "-_." else "-" for c in name)
    return keep.strip(".-")[:160] or f"mosaique-{int(time.time())}"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB), **kwargs)

    def log_message(self, fmt, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _local_host(self):
        host = (self.headers.get("Host") or "").split(":")[0]
        return host in ("127.0.0.1", "localhost", "[::1]")

    def _json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if not self._local_host():
            return self.send_error(403)
        url = urllib.parse.urlparse(self.path)
        if url.path == "/api/screens":
            return self._json(screens())
        return super().do_GET()

    def do_POST(self):
        url = urllib.parse.urlparse(self.path)
        if url.path not in ("/api/keep", "/api/apply"):
            return self.send_error(404)
        # L'en-tête X-Params oblige un preflight CORS (jamais accepté ici) : une page
        # web externe ne peut donc pas écrire de fichiers à travers ce serveur.
        if not self._local_host() or "X-Params" not in self.headers:
            return self.send_error(403)
        length = int(self.headers.get("Content-Length", 0))
        if not 0 < length <= MAX_UPLOAD:
            return self.send_error(413)
        body = self.rfile.read(length)
        if not body.startswith(b"\x89PNG"):
            return self._json({"error": "PNG attendu / PNG expected"}, 400)
        params = json.loads(urllib.parse.unquote(self.headers["X-Params"]))
        name = safe_name(params.get("name", "mosaique")) + ".png"

        # Garder et Appliquer enregistrent tous deux dans le dossier des fonds d'écran.
        action = "garder" if url.path == "/api/keep" else "appliquer"
        if action == "appliquer" and not shutil.which("omarchy"):
            return self._json({"error": "Appliquer nécessite Omarchy, utilise Garder / Apply requires Omarchy, use Keep"}, 501)

        folder = keep_dir()
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / name
        path.write_bytes(body)

        if action == "appliquer":
            subprocess.Popen(["omarchy", "theme", "bg", "set", str(path)],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        journal({"t": time.strftime("%Y-%m-%dT%H:%M:%S"), "action": action, "fichier": str(path), **params})
        return self._json({"ok": True, "path": str(path)})


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Mosaïque : http://127.0.0.1:{PORT}/")
    server.serve_forever()
