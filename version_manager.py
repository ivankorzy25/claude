"""
Sistema de versionado para evitar problemas de cache
"""

import json
import time
from pathlib import Path
from datetime import datetime


class VersionManager:
    def __init__(self):
        self.version_file = Path("version.json")
        self.load_version()

    def load_version(self):
        """Carga o crea el archivo de versión"""
        if self.version_file.exists():
            with open(self.version_file, "r") as f:
                self.data = json.load(f)
        else:
            self.data = {
                "version": "1.0.0",
                "build": int(time.time()),
                "last_update": datetime.now().isoformat(),
            }
            self.save_version()

    def save_version(self):
        """Guarda el archivo de versión"""
        with open(self.version_file, "w") as f:
            json.dump(self.data, f, indent=2)

    def bump_build(self):
        """Incrementa el número de build"""
        self.data["build"] = int(time.time())
        self.data["last_update"] = datetime.now().isoformat()
        self.save_version()
        return self.data["build"]

    def get_version_string(self):
        """Retorna string de versión para URLs"""
        return f"v{self.data['version']}-{self.data['build']}"
