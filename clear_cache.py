#!/usr/bin/env python3
"""
Script para limpiar cache y forzar actualización
"""

import os
import shutil
from pathlib import Path


def clear_cache():
    """Limpia todos los archivos de cache"""

    # Directorios a limpiar
    cache_dirs = [
        "__pycache__",
        ".pytest_cache",
        "browser_profiles",
        "static/__pycache__",
        "modules/__pycache__",
        "products/__pycache__",
        "navigation/__pycache__",
        "ai_generator/__pycache__",
    ]

    for cache_dir in cache_dirs:
        if Path(cache_dir).exists():
            print(f"Limpiando {cache_dir}...")
            shutil.rmtree(cache_dir)

    # Buscar y eliminar todos los __pycache__
    for root, dirs, files in os.walk("."):
        for dir_name in dirs:
            if dir_name == "__pycache__":
                full_path = os.path.join(root, dir_name)
                print(f"Eliminando {full_path}")
                shutil.rmtree(full_path)

    # Actualizar versión
    from version_manager import VersionManager

    vm = VersionManager()
    vm.bump_build()
    print(f"Nueva versión: {vm.get_version_string()}")

    print("✅ Cache limpiado exitosamente")


if __name__ == "__main__":
    clear_cache()
