"""
Gestor Principal de Productos
Coordina la base de datos, filtros y operaciones
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Callable
import logging
from datetime import datetime
import json
from pathlib import Path

from .database_handler import DatabaseHandler
from .product_filters import ProductFilters, FilterCriteria

class ProductManager:
    """Gestor principal del módulo de productos"""
    
    def __init__(self):
        self.db_handler = DatabaseHandler()
        self.filters = ProductFilters()
        self.selected_products = set()
        self.product_cache = pd.DataFrame()
        self.callbacks = {
            'on_selection_change': None,
            'on_filter_change': None,
            'on_data_refresh': None
        }
        self.logger = logging.getLogger(__name__)
        
    def set_callback(self, event_name: str, callback: Callable):
        """Establece callbacks para eventos"""
        if event_name in self.callbacks:
            self.callbacks[event_name] = callback
    
    def connect_database(self) -> bool:
        """Conecta a la base de datos"""
        return self.db_handler.connect()
    
    def disconnect_database(self):
        """Desconecta de la base de datos"""
        self.db_handler.disconnect()
    
    def refresh_products(self, use_filter: bool = True) -> pd.DataFrame:
        """Refresca la lista de productos desde la base de datos"""
        try:
            if use_filter and self.filters.current_filter != FilterCriteria():
                filter_dict = self.filters.apply_filter(self.filters.current_filter)
                self.product_cache = self.db_handler.get_products_filtered(filter_dict)
            else:
                self.product_cache = self.db_handler.get_all_products()
            
            # Preparar DataFrame para compatibilidad
            self.product_cache = self._prepare_dataframe(self.product_cache)
            
            # Callback
            if self.callbacks['on_data_refresh']:
                self.callbacks['on_data_refresh'](len(self.product_cache))
            
            self.logger.info(f"Productos actualizados: {len(self.product_cache)} registros")
            return self.product_cache
            
        except Exception as e:
            self.logger.error(f"Error actualizando productos: {e}")
            return pd.DataFrame()
    
    def _prepare_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Prepara el DataFrame con columnas adicionales y formato"""
        if df.empty:
            return df
        
        # Agregar columnas calculadas
        if 'Potencia' in df.columns:
            df['Potencia_Numerica'] = df['Potencia'].apply(self._extract_numeric_value)
        
        # Agregar columna de selección
        df['selected'] = df['SKU'].isin(self.selected_products)
        
        # Formatear precios
        if 'Precio_USD_con_IVA' in df.columns:
            # Asegurarse de que la columna sea numérica, convirtiendo errores a NaN
            df['Precio_USD_con_IVA'] = pd.to_numeric(df['Precio_USD_con_IVA'], errors='coerce')
            
            df['Precio_Formateado'] = df['Precio_USD_con_IVA'].apply(
                lambda x: f"${x:,.2f}" if pd.notna(x) else "N/A"
            )
        
        # Reemplazar NaN por None para compatibilidad con JSON
        return df.replace({np.nan: None})
    
    def _extract_numeric_value(self, text: str) -> float:
        """Extrae valor numérico de un texto"""
        import re
        if pd.isna(text):
            return 0
        match = re.search(r'(\d+(?:[.,]\d+)?)', str(text))
        if match:
            return float(match.group(1).replace(',', '.'))
        return 0
    
    def apply_filter(self, criteria: FilterCriteria) -> pd.DataFrame:
        """Aplica un filtro y actualiza los productos"""
        self.filters.current_filter = criteria
        return self.refresh_products(use_filter=True)
    
    def search_products(self, query: str) -> pd.DataFrame:
        """Búsqueda rápida de productos"""
        if not query:
            return self.product_cache
        
        # Parsear query avanzado
        advanced_filters = self.filters.parse_search_query(query)
        
        if advanced_filters:
            # Crear nuevo criterio con los filtros parseados
            criteria = FilterCriteria(**advanced_filters)
            return self.apply_filter(criteria)
        else:
            # Búsqueda simple en caché
            query_lower = query.lower()
            mask = (
                self.product_cache['SKU'].str.lower().str.contains(query_lower, na=False) |
                self.product_cache['Descripción'].str.lower().str.contains(query_lower, na=False) |
                self.product_cache['Modelo'].str.lower().str.contains(query_lower, na=False)
            )
            return self.product_cache[mask]
    
    def select_product(self, sku: str, selected: bool = True):
        """Selecciona o deselecciona un producto"""
        if selected:
            self.selected_products.add(sku)
        else:
            self.selected_products.discard(sku)
        
        # Actualizar DataFrame
        if not self.product_cache.empty:
            self.product_cache.loc[self.product_cache['SKU'] == sku, 'selected'] = selected
        
        # Callback
        if self.callbacks['on_selection_change']:
            self.callbacks['on_selection_change'](len(self.selected_products))
    
    def select_all(self, select: bool = True):
        """Selecciona o deselecciona todos los productos visibles"""
        if select:
            visible_skus = self.product_cache['SKU'].tolist()
            self.selected_products.update(visible_skus)
            self.product_cache['selected'] = True
        else:
            self.selected_products.clear()
            self.product_cache['selected'] = False
        
        # Callback
        if self.callbacks['on_selection_change']:
            self.callbacks['on_selection_change'](len(self.selected_products))
    
    def select_by_criteria(self, criteria: Dict[str, Any]):
        """Selecciona productos según criterios específicos"""
        mask = pd.Series([True] * len(self.product_cache))
        
        if 'min_stock' in criteria:
            mask &= self.product_cache['Stock'] >= criteria['min_stock']
        
        if 'max_price' in criteria:
            mask &= self.product_cache['Precio_USD_con_IVA'] <= criteria['max_price']
        
        if 'familia' in criteria:
            mask &= self.product_cache['Familia'] == criteria['familia']
        
        if 'marca' in criteria:
            mask &= self.product_cache['Marca'] == criteria['marca']
        
        # Seleccionar productos que cumplan los criterios
        matching_skus = self.product_cache[mask]['SKU'].tolist()
        self.selected_products.update(matching_skus)
        self.product_cache.loc[mask, 'selected'] = True
        
        # Callback
        if self.callbacks['on_selection_change']:
            self.callbacks['on_selection_change'](len(self.selected_products))
    
    def get_selected_products(self) -> pd.DataFrame:
        """Obtiene los productos seleccionados"""
        if not self.selected_products:
            return pd.DataFrame()
        
        return self.product_cache[self.product_cache['SKU'].isin(self.selected_products)]
    
    def get_product_details(self, sku: str) -> Optional[Dict[str, Any]]:
        """Obtiene detalles completos de un producto"""
        product = self.product_cache[self.product_cache['SKU'] == sku]
        
        if product.empty:
            # Buscar en base de datos
            df = self.db_handler.get_products_by_ids([sku])
            if not df.empty:
                product = df
        
        if not product.empty:
            return product.iloc[0].to_dict()
        
        return None
    
    def get_filter_options(self) -> Dict[str, List[str]]:
        """Obtiene opciones disponibles para filtros"""
        return {
            'familias': self.db_handler.get_distinct_values('Familia'),
            'marcas': self.db_handler.get_distinct_values('Marca'),
            'combustibles': ['diesel', 'nafta', 'gas'],
            'saved_filters': list(self.filters.saved_filters.keys()),
            'preset_filters': list(self.filters.filter_presets.keys())
        }
    
    def save_selection(self, name: str) -> bool:
        """Guarda la selección actual"""
        try:
            selection_file = Path("selections") / f"{name}.json"
            selection_file.parent.mkdir(exist_ok=True)
            
            selection_data = {
                'name': name,
                'timestamp': datetime.now().isoformat(),
                'products': list(self.selected_products),
                'filter': self.filters.current_filter.__dict__,
                'count': len(self.selected_products)
            }
            
            with open(selection_file, 'w') as f:
                json.dump(selection_data, f, indent=2)
            
            self.logger.info(f"Selección guardada: {name}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error guardando selección: {e}")
            return False
    
    def load_selection(self, name: str) -> bool:
        """Carga una selección guardada"""
        try:
            selection_file = Path("selections") / f"{name}.json"
            
            if not selection_file.exists():
                return False
            
            with open(selection_file, 'r') as f:
                selection_data = json.load(f)
            
            # Restaurar selección
            self.selected_products = set(selection_data['products'])
            
            # Restaurar filtro si existe
            if 'filter' in selection_data:
                self.filters.current_filter = FilterCriteria(**selection_data['filter'])
            
            # Actualizar productos
            self.refresh_products()
            
            self.logger.info(f"Selección cargada: {name}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error cargando selección: {e}")
            return False
    
    def export_selected_products(self, format: str = 'excel') -> str:
        """Exporta los productos seleccionados"""
        selected_df = self.get_selected_products()
        
        if selected_df.empty:
            return ""
        
        if format == 'excel':
            return self.db_handler.export_to_excel(selected_df)
        elif format == 'json':
            filename = f"export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            filepath = Path("exports") / filename
            filepath.parent.mkdir(exist_ok=True)
            
            selected_df.to_json(filepath, orient='records', force_ascii=False, indent=2)
            return str(filepath)
        
        return ""
    
    def get_statistics(self) -> Dict[str, Any]:
        """Obtiene estadísticas de productos"""
        db_stats = self.db_handler.get_statistics()
        
        # Agregar estadísticas de selección
        db_stats['selected_products'] = len(self.selected_products)
        db_stats['filtered_products'] = len(self.product_cache)
        
        if not self.product_cache.empty:
            selected_df = self.get_selected_products()
            if not selected_df.empty:
                db_stats['selected_total_value'] = selected_df['Precio_USD_con_IVA'].sum()
                db_stats['selected_total_stock'] = selected_df['Stock'].sum()
        
        return db_stats
    
    def prepare_for_processing(self) -> List[Dict[str, Any]]:
        """Prepara los productos seleccionados para procesamiento"""
        selected_df = self.get_selected_products()
        
        if selected_df.empty:
            return []
        
        # Convertir a formato esperado por otros módulos
        products = []
        for _, row in selected_df.iterrows():
            product = {
                'sku': row['SKU'],
                'nombre': row['Descripción'],
                'marca': row.get('Marca', ''),
                'modelo': row.get('Modelo', ''),
                'familia': row.get('Familia', ''),
                'precio': row.get('Precio_USD_con_IVA', 0),
                'stock': row.get('Stock', 0),
                'pdf_url': row.get('URL_PDF', ''),
                # Agregar más campos según necesidad
                'row_data': row.to_dict()  # Datos completos
            }
            products.append(product)
        
        return products
