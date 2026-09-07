"""Publish a built frontend and validate/reload the existing host Nginx."""
from datetime import datetime, timezone
import os
from pathlib import Path
import shutil
import subprocess

root = Path("/docker/emporioJudaico")
stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
release = root / "releases" / stamp
source = root / "app/apps/web/dist"
assert (source / "index.html").is_file(), "Frontend build is missing"
release.mkdir(parents=True)
shutil.copytree(source, release / "emporioJudaico")

current = root / "current"
previous = os.readlink(current) if current.is_symlink() else None
assert not current.exists() or current.is_symlink(), "current must be a symlink"
pending = root / f"current-{stamp}"
pending.symlink_to(release)
pending.replace(current)

shared = Path("/docker/nginx/apps.conf")
snippet = Path("/docker/nginx/emporioJudaico.conf")
backup = root / "backups" / stamp
backup.mkdir(parents=True)
shutil.copy2(shared, backup / "apps.conf")
old_snippet = snippet.exists()
if old_snippet:
    shutil.copy2(snippet, backup / "emporioJudaico.conf")
try:
    shutil.copyfile(root / "app/deploy/nginx.conf", snippet)
    include = b"include /docker/nginx/emporioJudaico.conf;"
    contents = shared.read_bytes()
    if include not in contents:
        shared.write_bytes(contents + b"\n" + include + b"\n")
    subprocess.run(["nginx", "-t"], check=True)
    subprocess.run(["systemctl", "reload", "nginx"], check=True)
except Exception:
    shutil.copy2(backup / "apps.conf", shared)
    if old_snippet:
        shutil.copy2(backup / "emporioJudaico.conf", snippet)
    else:
        snippet.unlink(missing_ok=True)
    if previous:
        pending.symlink_to(previous)
        pending.replace(current)
    else:
        current.unlink()
    subprocess.run(["nginx", "-t"], check=True)
    subprocess.run(["systemctl", "reload", "nginx"], check=True)
    raise
print(f"Frontend publicado: {release}")
print(f"Backup Nginx: {backup}")
