"""
Gestor del Navegador Chrome
Maneja la inicialización y control del navegador
"""

import os
import time
import json
from pathlib import Path
from typing import Optional, Dict, Any
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.common.exceptions import SessionNotCreatedException, WebDriverException

class BrowserManager:
    """Gestiona la instancia del navegador Chrome"""
    
    def __init__(self, profile_name: str = "selenium_stel_profile"):
        self.profile_name = profile_name
        self.driver: Optional[webdriver.Chrome] = None
        self.wait: Optional[WebDriverWait] = None
        self.profile_path = Path("./browser_profiles") / profile_name
        self.is_running = False
        self.start_time = None
        self.config = self._load_config()
        
    def _load_config(self) -> Dict[str, Any]:
        """Carga la configuración del navegador"""
        default_config = {
            "timeout": 60,
            "implicit_wait": 10,
            "page_load_timeout": 30,
            "headless": False,
            "window_size": "1280,720",
            "disable_images": False,
            "user_agent": None
        }
        
        config_file = Path("config/browser_config.json")
        if config_file.exists():
            try:
                with open(config_file, 'r') as f:
                    user_config = json.load(f)
                    default_config.update(user_config)
            except Exception as e:
                print(f"Error cargando configuración: {e}")
        
        return default_config
    
    def initialize_browser(self) -> Dict[str, Any]:
        """Inicializa el navegador Chrome con perfil persistente"""
        try:
            # Crear directorio de perfil si no existe
            os.makedirs(self.profile_path, exist_ok=True)
            
            # Configurar opciones de Chrome
            options = Options()
            options.add_experimental_option("detach", True)
            options.add_argument(f"user-data-dir={os.path.abspath(self.profile_path)}")
            
            # Configuraciones adicionales
            if self.config["window_size"]:
                options.add_argument(f"--window-size={self.config['window_size']}")
            
            if self.config["disable_images"]:
                prefs = {"profile.managed_default_content_settings.images": 2}
                options.add_experimental_option("prefs", prefs)
            
            if self.config["user_agent"]:
                options.add_argument(f'user-agent={self.config["user_agent"]}')
            
            # Opciones para mejorar estabilidad
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--disable-blink-features=AutomationControlled")
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option('useAutomationExtension', False)
            
            # Inicializar driver
            service = Service()
            self.driver = webdriver.Chrome(service=service, options=options)
            
            # Configurar timeouts
            self.driver.implicitly_wait(self.config["implicit_wait"])
            self.driver.set_page_load_timeout(self.config["page_load_timeout"])
            
            # Crear objeto wait
            self.wait = WebDriverWait(self.driver, self.config["timeout"])
            
            # Marcar como activo
            self.is_running = True
            self.start_time = time.time()
            
            return {
                "success": True,
                "message": "Navegador iniciado correctamente",
                "session_id": self.driver.session_id
            }
            
        except SessionNotCreatedException as e:
            return {
                "success": False,
                "error": "profile_in_use",
                "message": "El perfil ya está en uso. Cierra todas las ventanas de Chrome con este perfil."
            }
        except Exception as e:
            return {
                "success": False,
                "error": "initialization_failed",
                "message": f"Error al inicializar navegador: {str(e)}"
            }
    
    def close_browser(self) -> bool:
        """Cierra el navegador de forma segura"""
        try:
            if self.driver:
                self.driver.quit()
                self.driver = None
                self.wait = None
                self.is_running = False
                return True
        except Exception as e:
            print(f"Error al cerrar navegador: {e}")
        return False
    
    def is_alive(self) -> bool:
        """Verifica si el navegador sigue activo"""
        if not self.driver or not self.is_running:
            return False
        
        try:
            # Intentar obtener el título de la página actual
            _ = self.driver.title
            return True
        except WebDriverException:
            self.is_running = False
            return False
    
    def navigate_to(self, url: str) -> Dict[str, Any]:
        """Navega a una URL específica"""
        if not self.is_alive():
            return {"success": False, "error": "Browser not running"}
        
        try:
            self.driver.get(url)
            return {"success": True, "current_url": self.driver.current_url}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def refresh_page(self) -> bool:
        """Refresca la página actual"""
        if not self.is_alive():
            return False
        
        try:
            self.driver.refresh()
            return True
        except:
            return False
    
    def get_status(self) -> Dict[str, Any]:
        """Obtiene el estado actual del navegador"""
        status = {
            "is_running": self.is_running,
            "is_alive": self.is_alive(),
            "profile": self.profile_name,
            "uptime": None,
            "current_url": None,
            "page_title": None
        }
        
        if self.is_alive():
            try:
                status["current_url"] = self.driver.current_url
                status["page_title"] = self.driver.title
                if self.start_time:
                    status["uptime"] = time.time() - self.start_time
            except:
                pass
        
        return status
    
    def take_screenshot(self, filename: str = None) -> Optional[str]:
        """Toma una captura de pantalla"""
        if not self.is_alive():
            return None
        
        try:
            if not filename:
                filename = f"screenshot_{int(time.time())}.png"
            
            screenshot_dir = Path("screenshots")
            screenshot_dir.mkdir(exist_ok=True)
            filepath = screenshot_dir / filename
            
            self.driver.save_screenshot(str(filepath))
            return str(filepath)
        except Exception as e:
            print(f"Error tomando screenshot: {e}")
            return None
    
    def execute_script(self, script: str, *args) -> Any:
        """Ejecuta JavaScript en la página"""
        if not self.is_alive():
            return None
        
        try:
            return self.driver.execute_script(script, *args)
        except Exception as e:
            print(f"Error ejecutando script: {e}")
            return None
    
    def cleanup_profile(self) -> bool:
        """Limpia los archivos del perfil (usar con cuidado)"""
        try:
            if self.is_running:
                self.close_browser()
            
            # Esperar un momento para asegurar que Chrome liberó los archivos
            time.sleep(2)
            
            # Aquí podrías implementar limpieza selectiva de archivos
            # Por ahora, solo retornamos True
            return True
        except Exception as e:
            print(f"Error limpiando perfil: {e}")
            return False
