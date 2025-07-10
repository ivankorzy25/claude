"""
Navegador específico para STEL Order
Maneja las operaciones específicas de la plataforma
"""

import time
import re
from typing import Dict, Any, Optional, List, Callable
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, ElementClickInterceptedException

class StelNavigator:
    """Navegación específica para Stelorder"""
    
    def __init__(self, browser_manager):
        self.browser = browser_manager
        self.driver = browser_manager.driver
        self.wait = browser_manager.wait
        self.base_url = "https://www.stelorder.com/app/"
        self.is_logged_in = False
        self.current_section = None
        
    def navigate_to_login(self) -> Dict[str, Any]:
        """Navega a la página de login"""
        result = self.browser.navigate_to(self.base_url)
        
        if result["success"]:
            # Esperar a que la página cargue
            time.sleep(3)
            self.current_section = "login"
            
        return result
    
    def check_login_status(self) -> bool:
        """Verifica si el usuario está logueado"""
        try:
            # Buscar elementos que indiquen que estamos logueados
            # Ajustar según la estructura real de Stelorder
            logged_indicators = [
                "//a[@id='ui-id-2']",  # Tab de catálogo
                "//div[@class='header-usuario']",
                "//button[contains(@class, 'logout')]"
            ]
            
            for indicator in logged_indicators:
                try:
                    self.wait.until(EC.presence_of_element_located((By.XPATH, indicator)))
                    self.is_logged_in = True
                    return True
                except:
                    continue
                    
            return False
            
        except Exception as e:
            print(f"Error verificando login: {e}")
            return False
    
    def navigate_to_catalog(self) -> Dict[str, Any]:
        """Navega al catálogo de productos"""
        try:
            # Método 1: URL directa
            self.driver.get("about:blank")
            time.sleep(1)
            self.driver.get("https://app.stelorder.com/app/#main_catalogo")
            time.sleep(5)
            
            # Refrescar página
            self.driver.refresh()
            time.sleep(3)
            
            # Método 2: Click en pestaña
            try:
                catalog_tab = self.wait.until(
                    EC.presence_of_element_located((By.XPATH, "//a[@id='ui-id-2']"))
                )
                self.driver.execute_script("arguments[0].click();", catalog_tab)
                time.sleep(3)
            except:
                pass
            
            # Verificar que estamos en catálogo
            buscador = self.wait.until(
                EC.presence_of_element_located((By.XPATH, "//input[contains(@class, 'buscadorListado')]"))
            )
            
            if buscador.is_displayed() and buscador.is_enabled():
                self.current_section = "catalog"
                return {"success": True, "message": "Catálogo cargado"}
            else:
                return {"success": False, "error": "Buscador no disponible"}
                
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def clear_filters(self) -> bool:
        """Limpia los filtros del catálogo"""
        try:
            clear_button = self.wait.until(
                EC.element_to_be_clickable((By.XPATH, "//*[@id='main_catalogo']/div[2]/div[1]/button[4]"))
            )
            self.driver.execute_script("arguments[0].scrollIntoView(true);", clear_button)
            self.driver.execute_script("arguments[0].click();", clear_button)
            time.sleep(2)
            return True
        except:
            return False
    
    def search_product(self, sku: str, clear_first: bool = True) -> Dict[str, Any]:
        """Busca un producto por SKU"""
        try:
            # Obtener el buscador
            buscador = self.wait.until(
                EC.element_to_be_clickable((By.XPATH, "//input[contains(@class, 'buscadorListado')]"))
            )
            
            # Limpiar si es necesario
            if clear_first:
                buscador.clear()
                self.driver.execute_script("arguments[0].value = '';", buscador)
                time.sleep(0.5)
            
            # Escribir SKU letra por letra
            for letra in sku:
                buscador.send_keys(letra)
                time.sleep(0.05)
            
            # Esperar resultados
            time.sleep(3)
            
            return {"success": True, "message": f"Búsqueda realizada: {sku}"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def select_product_from_results(self, sku: str) -> Dict[str, Any]:
        """Selecciona un producto de los resultados de búsqueda"""
        try:
            # Buscar en la tabla de resultados
            filas = self.driver.find_elements(By.XPATH, "//table[@class='tablaListado']//tr[@class='lineaTD']")
            
            for fila in filas:
                try:
                    celdas = fila.find_elements(By.TAG_NAME, "td")
                    for celda in celdas:
                        if sku in celda.text:
                            self.driver.execute_script("arguments[0].click();", fila)
                            time.sleep(3)
                            return {"success": True, "message": "Producto seleccionado"}
                except:
                    continue
            
            # Si no se encontró, intentar el primer resultado
            try:
                primer_fila = self.wait.until(
                    EC.element_to_be_clickable((By.XPATH, "//td[@class='tdTextoLargo tdBold']"))
                )
                self.driver.execute_script("arguments[0].click();", primer_fila)
                time.sleep(3)
                return {"success": True, "message": "Primer resultado seleccionado"}
            except:
                return {"success": False, "error": "No se encontró el producto"}
                
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def navigate_to_shop_tab(self) -> Dict[str, Any]:
        """Navega a la pestaña Shop del producto"""
        try:
            # Intentar diferentes selectores
            selectors = [
                "//a[@id='ui-id-31']",
                "//li[contains(@class, 'ui-tabs-tab')]/a[contains(text(), 'Shop')]",
                "//a[contains(text(), 'Shop')]"
            ]
            
            for selector in selectors:
                try:
                    shop_tab = self.wait.until(EC.element_to_be_clickable((By.XPATH, selector)))
                    self.driver.execute_script("arguments[0].scrollIntoView(true);", shop_tab)
                    time.sleep(1)
                    self.driver.execute_script("arguments[0].click();", shop_tab)
                    time.sleep(3)
                    return {"success": True, "message": "Pestaña Shop activada"}
                except:
                    continue
                    
            return {"success": False, "error": "No se encontró la pestaña Shop"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def click_edit_shop(self) -> Dict[str, Any]:
        """Hace clic en el botón Editar Shop"""
        try:
            selectors = [
                "//*[@id='editarShop']",
                "//button[contains(text(), 'Editar')]",
                "//button[contains(@class, 'editarShop')]"
            ]
            
            for selector in selectors:
                try:
                    edit_btn = self.wait.until(EC.element_to_be_clickable((By.XPATH, selector)))
                    self.driver.execute_script("arguments[0].scrollIntoView(true);", edit_btn)
                    time.sleep(1)
                    self.driver.execute_script("arguments[0].click();", edit_btn)
                    time.sleep(3)
                    
                    # Verificar que el modal se abrió
                    modal = self.wait.until(
                        EC.visibility_of_element_located((By.ID, "editarObjetoCatalogoConfiguracionShop_dialog"))
                    )
                    
                    if modal:
                        return {"success": True, "message": "Modal de edición abierto"}
                except:
                    continue
                    
            return {"success": False, "error": "No se pudo abrir el editor"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def update_shop_fields(self, fields: Dict[str, str]) -> Dict[str, Any]:
        """Actualiza los campos del producto en el modal de Shop"""
        try:
            results = {"updated": [], "failed": []}
            
            # Obtener el modal
            modal = self.wait.until(
                EC.visibility_of_element_located((By.ID, "editarObjetoCatalogoConfiguracionShop_dialog"))
            )
            
            # Mostrar campos SEO si es necesario
            if any(key.startswith('seo') for key in fields.keys()):
                try:
                    show_seo = modal.find_element(By.ID, "trMostrarOcultarCamposSeoShopTable")
                    self.driver.execute_script("arguments[0].click();", show_seo)
                    time.sleep(1)
                except:
                    pass
            
            # Actualizar cada campo
            field_mapping = {
                'descripcion': 'descriptionShop',
                'seo_titulo': 'seoTitleShop',
                'seo_descripcion': 'seoDescriptionShop',
                'destacado': 'destacadoShop'
            }
            
            for field_key, field_value in fields.items():
                if field_key in field_mapping:
                    try:
                        element_id = field_mapping[field_key]
                        element = modal.find_element(By.ID, element_id)
                        
                        # Limpiar y actualizar
                        element.clear()
                        self.driver.execute_script("arguments[0].value = '';", element)
                        
                        # Para descripción, manejar saltos de línea
                        if field_key == 'descripcion':
                            for linea in field_value.split('\n'):
                                element.send_keys(linea)
                                element.send_keys(Keys.SHIFT + Keys.ENTER)
                                time.sleep(0.05)
                        else:
                            element.send_keys(field_value)
                        
                        results["updated"].append(field_key)
                        
                    except Exception as e:
                        results["failed"].append({"field": field_key, "error": str(e)})
                
                # Manejar descripción detallada (CKEditor)
                elif field_key == 'descripcion_detallada':
                    try:
                        # Buscar iframe del CKEditor
                        iframe = modal.find_element(By.CSS_SELECTOR, "iframe.cke_wysiwyg_frame")
                        self.driver.switch_to.frame(iframe)
                        
                        body = self.wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
                        
                        # Limpiar y actualizar contenido
                        self.driver.execute_script("arguments[0].innerHTML = '';", body)
                        time.sleep(0.5)
                        
                        self.driver.execute_script("arguments[0].innerHTML = arguments[1];", body, field_value)
                        
                        # Disparar eventos para que CKEditor reconozca el cambio
                        self.driver.execute_script("""
                            var event = new Event('input', { bubbles: true });
                            arguments[0].dispatchEvent(event);
                            var changeEvent = new Event('change', { bubbles: true });
                            arguments[0].dispatchEvent(changeEvent);
                        """, body)
                        
                        self.driver.switch_to.default_content()
                        results["updated"].append(field_key)
                        
                    except Exception as e:
                        self.driver.switch_to.default_content()
                        results["failed"].append({"field": field_key, "error": str(e)})
            
            return {"success": True, "results": results}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def save_shop_changes(self) -> Dict[str, Any]:
        """Guarda los cambios del modal de Shop"""
        try:
            # Buscar botón guardar
            save_btn = self.wait.until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, "button.opcionMenuGuardar.primaryButton"))
            )
            
            self.driver.execute_script("arguments[0].scrollIntoView(true);", save_btn)
            time.sleep(1)
            self.driver.execute_script("arguments[0].click();", save_btn)
            
            # Esperar a que el modal se cierre
            self.wait.until(
                EC.invisibility_of_element_located((By.ID, "editarObjetoCatalogoConfiguracionShop_dialog"))
            )
            
            time.sleep(3)
            return {"success": True, "message": "Cambios guardados"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def process_product_complete(self, sku: str, fields: Dict[str, str], 
                               progress_callback: Optional[Callable] = None) -> Dict[str, Any]:
        """Proceso completo para actualizar un producto"""
        steps = [
            ("Navegando al catálogo", lambda: self.navigate_to_catalog()),
            ("Buscando producto", lambda: self.search_product(sku)),
            ("Seleccionando producto", lambda: self.select_product_from_results(sku)),
            ("Abriendo pestaña Shop", lambda: self.navigate_to_shop_tab()),
            ("Abriendo editor", lambda: self.click_edit_shop()),
            ("Actualizando campos", lambda: self.update_shop_fields(fields)),
            ("Guardando cambios", lambda: self.save_shop_changes())
        ]
        
        results = {
            "sku": sku,
            "success": True,
            "steps_completed": [],
            "error": None
        }
        
        for i, (step_name, step_func) in enumerate(steps):
            try:
                if progress_callback:
                    progress_callback({
                        "step": i + 1,
                        "total": len(steps),
                        "description": step_name,
                        "sku": sku
                    })
                
                step_result = step_func()
                
                if step_result.get("success"):
                    results["steps_completed"].append(step_name)
                else:
                    results["success"] = False
                    results["error"] = f"{step_name}: {step_result.get('error', 'Error desconocido')}"
                    break
                    
            except Exception as e:
                results["success"] = False
                results["error"] = f"{step_name}: {str(e)}"
                break
        
        return results
    
    def take_screenshot_on_error(self, prefix: str = "error") -> Optional[str]:
        """Toma screenshot cuando hay un error"""
        return self.browser.take_screenshot(f"{prefix}_{int(time.time())}.png")
