"""
Controlador principal del módulo de navegación
Coordina browser_manager y stel_navigator
"""

import time
import threading
from typing import Dict, Any, List, Optional, Callable
from pathlib import Path
import json
from datetime import datetime
import traceback

from .browser_manager import BrowserManager
from .stel_navigator import StelNavigator

class SeleniumHandler:
    """Controlador principal de navegación"""
    
    def __init__(self):
        self.browser_manager = None
        self.navigator = None
        self.is_paused = False
        self.is_processing = False
        self.current_task = None
        self.process_thread = None
        self.stats = {
            "products_processed": 0,
            "products_failed": 0,
            "start_time": None,
            "errors": []
        }
        self.callbacks = {
            "on_product_complete": None,
            "on_progress": None,
            "on_error": None,
            "on_log": None
        }
        
    def set_callback(self, event_name: str, callback: Callable):
        """Establece callbacks para eventos"""
        if event_name in self.callbacks:
            self.callbacks[event_name] = callback
    
    def _log(self, message: str, level: str = "INFO"):
        """Registra un mensaje de log"""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "level": level,
            "message": message
        }
        
        if self.callbacks["on_log"]:
            self.callbacks["on_log"](log_entry)
        
        print(f"[{level}] {message}")
    
    def initialize_browser(self) -> Dict[str, Any]:
        """Inicializa el navegador"""
        self._log("Inicializando navegador...")
        
        self.browser_manager = BrowserManager()
        result = self.browser_manager.initialize_browser()
        
        if result["success"]:
            self.navigator = StelNavigator(self.browser_manager)
            self._log("Navegador iniciado correctamente")
            
            # Navegar a Stelorder
            nav_result = self.navigator.navigate_to_login()
            if nav_result["success"]:
                self._log("Navegación a Stelorder completada. Por favor, inicia sesión manualmente.")
            
        else:
            self._log(f"Error iniciando navegador: {result['message']}", "ERROR")
            
        return result
    
    def check_login_status(self) -> bool:
        """Verifica el estado de login"""
        if not self.navigator:
            return False
            
        is_logged = self.navigator.check_login_status()
        
        if is_logged:
            self._log("Login confirmado")
        
        return is_logged
    
    def process_products(self, products: List[Dict[str, Any]], 
                        generation_callback: Callable) -> None:
        """Procesa una lista de productos"""
        
        def _process():
            self.is_processing = True
            self.stats["start_time"] = time.time()
            self.stats["products_processed"] = 0
            self.stats["products_failed"] = 0
            
            self._log(f"Iniciando procesamiento de {len(products)} productos")
            
            for i, product in enumerate(products):
                # Verificar pausa
                while self.is_paused and self.is_processing:
                    time.sleep(0.5)
                
                # Verificar si se detuvo el proceso
                if not self.is_processing:
                    break
                
                self.current_task = f"Procesando {product['sku']} ({i+1}/{len(products)})"
                
                try:
                    # Generar descripciones usando el callback
                    self._log(f"Generando descripciones para {product['sku']}")
                    descriptions = generation_callback(product)
                    
                    # Preparar campos para actualizar
                    fields = {
                        'descripcion': descriptions.get('descripcion', ''),
                        'descripcion_detallada': descriptions.get('descripcion_detallada', ''),
                        'seo_titulo': descriptions.get('seo_titulo', ''),
                        'seo_descripcion': descriptions.get('seo_descripcion', '')
                    }
                    
                    # Procesar producto
                    result = self.navigator.process_product_complete(
                        product['sku'], 
                        fields,
                        progress_callback=self.callbacks["on_progress"]
                    )
                    
                    if result["success"]:
                        self.stats["products_processed"] += 1
                        self._log(f"✅ Producto {product['sku']} actualizado correctamente")
                    else:
                        self.stats["products_failed"] += 1
                        self.stats["errors"].append({
                            "sku": product['sku'],
                            "error": result["error"]
                        })
                        self._log(f"❌ Error en {product['sku']}: {result['error']}", "ERROR")
                        
                        # Tomar screenshot en caso de error
                        screenshot = self.navigator.take_screenshot_on_error(f"error_{product['sku']}")
                        if screenshot:
                            self._log(f"Screenshot guardado: {screenshot}", "DEBUG")
                    
                    # Callback de producto completado
                    if self.callbacks["on_product_complete"]:
                        self.callbacks["on_product_complete"](result)
                    
                    # Pequeña pausa entre productos
                    time.sleep(2)
                    
                except Exception as e:
                    self._log(f"Error procesando {product['sku']}: {str(e)}", "ERROR")
                    self.stats["products_failed"] += 1
                    self.stats["errors"].append({
                        "sku": product.get('sku', 'UNKNOWN'),
                        "error": str(e)
                    })
                    
                    if self.callbacks["on_error"]:
                        self.callbacks["on_error"]({
                            "sku": product.get('sku'),
                            "error": str(e),
                            "traceback": traceback.format_exc()
                        })
            
            # Finalizar proceso
            self.is_processing = False
            self.current_task = None
            
            total_time = time.time() - self.stats["start_time"]
            self._log(f"Proceso finalizado. Procesados: {self.stats['products_processed']}, "
                     f"Errores: {self.stats['products_failed']}, "
                     f"Tiempo total: {total_time:.2f}s")
        
        # Iniciar en thread separado
        self.process_thread = threading.Thread(target=_process)
        self.process_thread.daemon = True
        self.process_thread.start()
    
    def pause_processing(self):
        """Pausa el procesamiento"""
        self.is_paused = True
        self._log("Procesamiento pausado")
    
    def resume_processing(self):
        """Reanuda el procesamiento"""
        self.is_paused = False
        self._log("Procesamiento reanudado")
    
    def stop_processing(self):
        """Detiene el procesamiento"""
        self.is_processing = False
        self.is_paused = False
        self._log("Procesamiento detenido")
        
        # Esperar a que termine el thread
        if self.process_thread and self.process_thread.is_alive():
            self.process_thread.join(timeout=5)
    
    def close_browser(self):
        """Cierra el navegador"""
        self._log("Cerrando navegador...")
        
        if self.is_processing:
            self.stop_processing()
        
        if self.browser_manager:
            success = self.browser_manager.close_browser()
            if success:
                self._log("Navegador cerrado correctamente")
            else:
                self._log("Error al cerrar navegador", "ERROR")
                
            self.browser_manager = None
            self.navigator = None
    
    def get_status(self) -> Dict[str, Any]:
        """Obtiene el estado actual del módulo"""
        status = {
            "browser_status": None,
            "is_processing": self.is_processing,
            "is_paused": self.is_paused,
            "current_task": self.current_task,
            "stats": self.stats
        }
        
        if self.browser_manager:
            status["browser_status"] = self.browser_manager.get_status()
        
        return status
    
    def export_stats(self, filepath: str = None) -> str:
        """Exporta estadísticas del proceso"""
        if not filepath:
            filepath = f"stats_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        stats_export = {
            "timestamp": datetime.now().isoformat(),
            "stats": self.stats,
            "browser_info": self.browser_manager.get_status() if self.browser_manager else None
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(stats_export, f, indent=2, ensure_ascii=False)
        
        self._log(f"Estadísticas exportadas a: {filepath}")
        return filepath
