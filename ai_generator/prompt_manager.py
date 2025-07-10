"""
Gestor de Prompts y Versiones
Maneja el historial y versionado de prompts
"""

import json
import os
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path

class PromptManager:
    """Gestiona prompts y su versionado"""
    
    def __init__(self):
        self.module_path = Path(__file__).parent
        self.versions_path = self.module_path / "versions"
        self.history_file = self.versions_path / "prompt_history.json"
        self.base_prompt_file = self.module_path / "templates" / "default_prompt.json"
        
        # Crear directorios si no existen
        self.versions_path.mkdir(exist_ok=True)
        (self.module_path / "templates").mkdir(exist_ok=True)
        
        # Cargar o inicializar historial
        self.history = self._load_history()
        
        # Asegurar que existe un prompt base
        self._ensure_base_prompt()
    
    def _load_history(self) -> List[Dict]:
        """Carga el historial de versiones"""
        if self.history_file.exists():
            try:
                with open(self.history_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return []
        return []
    
    def _save_history(self):
        """Guarda el historial de versiones"""
        with open(self.history_file, 'w', encoding='utf-8') as f:
            json.dump(self.history, f, indent=2, ensure_ascii=False)
    
    def _ensure_base_prompt(self):
        """Asegura que existe un prompt base"""
        if not self.base_prompt_file.exists():
            base_prompt = {
                "version": "base",
                "name": "Prompt Base Original",
                "description": "Versión inicial del prompt para generación de descripciones",
                "created_at": datetime.now().isoformat(),
                "prompt": self._get_default_base_prompt(),
                "is_base": True
            }
            
            with open(self.base_prompt_file, 'w', encoding='utf-8') as f:
                json.dump(base_prompt, f, indent=2, ensure_ascii=False)
            
            # Agregar al historial
            self.history.insert(0, base_prompt)
            self._save_history()
    
    def _get_default_base_prompt(self) -> str:
        """Retorna el prompt base por defecto"""
        return """Eres un experto en redacción de descripciones comerciales para productos industriales.
        
Genera una descripción profesional y persuasiva para el siguiente producto:

Tipo de producto: {product_type}
Información del producto:
- Nombre: {nombre}
- Marca: {marca}
- Modelo: {modelo}
- Potencia: {potencia_kva} KVA
- Motor: {motor}
- Características técnicas: {tech_specs}

INSTRUCCIONES ESPECÍFICAS:
1. La descripción debe ser profesional y orientada a la venta
2. Destaca los beneficios principales y ventajas competitivas
3. Menciona aplicaciones típicas del producto ({applications})
4. Enfócate especialmente en: {focus_areas}
5. La descripción debe tener entre 150-200 palabras
6. USA SOLO PÁRRAFOS, no uses listas con viñetas ni bullets
7. NO uses emojis ni caracteres especiales
8. Mantén un tono profesional pero cercano y persuasivo
9. Divide el contenido en 2-3 párrafos bien estructurados

FORMATO DE SALIDA:
- Solo devuelve el texto de los párrafos
- Separa cada párrafo con un salto de línea simple
- No incluyas etiquetas HTML ni formato markdown
- No uses asteriscos, guiones ni viñetas

Recuerda: El objetivo es convencer al cliente de que este es el producto ideal para sus necesidades."""
    
    def get_current_prompt(self) -> Dict:
        """Obtiene el prompt actualmente activo"""
        if self.history:
            return self.history[0]
        else:
            self._ensure_base_prompt()
            return self.history[0]
    
    def get_base_prompt(self) -> Dict:
        """Obtiene el prompt base"""
        if self.base_prompt_file.exists():
            with open(self.base_prompt_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        else:
            self._ensure_base_prompt()
            return self.get_base_prompt()
    
    def save_new_version(self, prompt_text: str, name: str, description: str) -> Dict:
        """Guarda una nueva versión del prompt"""
        # Generar ID único
        version_id = f"v{len(self.history) + 1}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        new_version = {
            "version": version_id,
            "name": name,
            "description": description,
            "created_at": datetime.now().isoformat(),
            "prompt": prompt_text,
            "is_base": False,
            "changes_from_previous": self._detect_changes(prompt_text)
        }
        
        # Guardar archivo individual
        version_file = self.versions_path / f"{version_id}.json"
        with open(version_file, 'w', encoding='utf-8') as f:
            json.dump(new_version, f, indent=2, ensure_ascii=False)
        
        # Actualizar historial
        self.history.insert(0, new_version)
        self._save_history()
        
        return new_version
    
    def update_base_prompt(self, prompt_text: str, description: str) -> Dict:
        """Actualiza el prompt base"""
        # Guardar versión actual del base como respaldo
        current_base = self.get_base_prompt()
        backup_name = f"Respaldo Base - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        self.save_new_version(current_base['prompt'], backup_name, "Respaldo automático del prompt base anterior")
        
        # Actualizar el prompt base
        updated_base = {
            "version": "base",
            "name": "Prompt Base Actualizado",
            "description": description,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "prompt": prompt_text,
            "is_base": True
        }
        
        with open(self.base_prompt_file, 'w', encoding='utf-8') as f:
            json.dump(updated_base, f, indent=2, ensure_ascii=False)
        
        # Actualizar en historial
        for i, version in enumerate(self.history):
            if version.get('is_base'):
                self.history[i] = updated_base
                break
        
        self._save_history()
        return updated_base
    
    def get_version(self, version_id: str) -> Optional[Dict]:
        """Obtiene una versión específica"""
        for version in self.history:
            if version['version'] == version_id:
                return version
        
        # Buscar en archivos
        version_file = self.versions_path / f"{version_id}.json"
        if version_file.exists():
            with open(version_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        
        return None
    
    def get_all_versions(self) -> List[Dict]:
        """Obtiene todas las versiones disponibles"""
        return self.history
    
    def delete_version(self, version_id: str) -> bool:
        """Elimina una versión (excepto la base)"""
        if version_id == "base":
            return False
        
        # Eliminar del historial
        self.history = [v for v in self.history if v['version'] != version_id]
        self._save_history()
        
        # Eliminar archivo
        version_file = self.versions_path / f"{version_id}.json"
        if version_file.exists():
            version_file.unlink()
        
        return True
    
    def _detect_changes(self, new_prompt: str) -> Dict:
        """Detecta cambios respecto a la versión anterior"""
        if not self.history:
            return {"type": "initial", "summary": "Primera versión"}
        
        previous = self.history[0]['prompt']
        
        # Análisis simple de cambios
        changes = {
            "lines_added": 0,
            "lines_removed": 0,
            "characters_changed": abs(len(new_prompt) - len(previous)),
            "summary": ""
        }
        
        # Comparar líneas
        prev_lines = set(previous.split('\n'))
        new_lines = set(new_prompt.split('\n'))
        
        changes["lines_added"] = len(new_lines - prev_lines)
        changes["lines_removed"] = len(prev_lines - new_lines)
        
        if changes["lines_added"] > changes["lines_removed"]:
            changes["summary"] = f"Agregadas {changes['lines_added']} líneas"
        elif changes["lines_removed"] > changes["lines_added"]:
            changes["summary"] = f"Eliminadas {changes['lines_removed']} líneas"
        else:
            changes["summary"] = f"Modificadas ~{changes['characters_changed']} caracteres"
        
        return changes
    
    def export_version(self, version_id: str, export_path: str) -> bool:
        """Exporta una versión a un archivo"""
        version = self.get_version(version_id)
        if version:
            with open(export_path, 'w', encoding='utf-8') as f:
                json.dump(version, f, indent=2, ensure_ascii=False)
            return True
        return False
    
    def import_version(self, import_path: str) -> Optional[Dict]:
        """Importa una versión desde un archivo"""
        try:
            with open(import_path, 'r', encoding='utf-8') as f:
                version_data = json.load(f)
            
            # Validar estructura
            required_fields = ['prompt', 'name', 'description']
            if all(field in version_data for field in required_fields):
                return self.save_new_version(
                    version_data['prompt'],
                    f"Importado: {version_data['name']}",
                    version_data['description']
                )
        except Exception as e:
            print(f"Error importando versión: {e}")
        
        return None
