"""Run on pedroflaminio before starting the production Compose project."""
import json
import os
from pathlib import Path
import secrets

root = Path("/docker/emporioJudaico")
root.mkdir(parents=True, exist_ok=True)
os.umask(0o077)
environment = root / "app/.env.production"
if not environment.exists():
    environment.write_text(f"POSTGRES_PASSWORD={secrets.token_hex(32)}\n")
credentials = root / "initial-admin.json"
if not credentials.exists():
    credentials.write_text(json.dumps({
        "email": "admin@emporio.local",
        "password": secrets.token_urlsafe(24),
    }) + "\n")
environment.chmod(0o600)
credentials.chmod(0o600)
print("Configuração e credenciais prontas; valores existentes preservados.")
