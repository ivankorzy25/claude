"""
Sistema de Filtros para Productos
Maneja la lógica de filtrado y búsqueda avanzada
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
import re

@dataclass
class FilterCriteria:
    """Criterios de filtrado para productos"""
    familia: Optional[str] = None
    marca: Optional[str] = None
    stock: Optional[str] = None  # Mantener 'stock' para compatibilidad con frontend
    stock_min: Optional[int] = None
    stock_max: Optional[int] = None
    precio_min: Optional[float] = None
    precio_max: Optional[float] = None
    search_text: Optional[str] = None
    has_cabina: Optional[bool] = None
    has_tta: Optional[bool] = None
    combustible: Optional[str] = None
    potencia_min: Optional[float] = None
    potencia_max: Optional[float] = None
    order_by: str = 'SKU'
    order_dir: str = 'ASC'
    limit: Optional[int] = None
    selected_only: bool = False
    selected_skus: List[str] = field(default_factory=list)

class ProductFilters:
    """Gestiona los filtros de productos"""
    
    def __init__(self):
        self.current_filter = FilterCriteria()
        self.saved_filters = {}
        self.filter_presets = self._load_presets()
    
    def _load_presets(self) -> Dict[str, FilterCriteria]:
        """Carga filtros predefinidos"""
        return {
            'en_stock': FilterCriteria(
                stock_min=1,
                order_by='Stock',
                order_dir='DESC'
            ),
            'sin_stock': FilterCriteria(
                stock_max=0,
                order_by='SKU'
            ),
            'generadores_diesel': FilterCriteria(
                familia='Grupos Electrógenos',
                combustible='diesel'
            ),
            'alta_potencia': FilterCriteria(
                potencia_min=100,
                order_by='Potencia',
                order_dir='DESC'
            ),
            'precio_bajo': FilterCriteria(
                precio_max=5000,
                order_by='Precio_USD_con_IVA',
                order_dir='ASC'
            ),
            'con_cabina': FilterCriteria(
                has_cabina=True
            ),
            'recientes': FilterCriteria(
                order_by='fecha_actualizacion',
                order_dir='DESC',
                limit=100
            )
        }
    
    def apply_filter(self, criteria: FilterCriteria) -> Dict[str, Any]:
        """Convierte FilterCriteria a diccionario para consulta SQL"""
        filter_dict = {}
        
        # Filtros básicos
        if criteria.familia:
            filter_dict['familia'] = criteria.familia
        
        if criteria.marca:
            filter_dict['marca'] = criteria.marca
        
        if criteria.stock_min is not None:
            filter_dict['stock_min'] = criteria.stock_min
        
        if criteria.stock_max is not None:
            filter_dict['stock_max'] = criteria.stock_max
        
        # Manejo del filtro 'stock' del frontend
        if criteria.stock:
            if criteria.stock == 'con_stock':
                filter_dict['stock_min'] = 1
            elif criteria.stock == 'sin_stock':
                filter_dict['stock_max'] = 0
            elif criteria.stock == 'disponible':
                filter_dict['stock_disponible'] = True
            elif criteria.stock == 'consultar':
                filter_dict['stock_consultar'] = True
        
        if criteria.precio_min is not None:
            filter_dict['precio_min'] = criteria.precio_min
        
        if criteria.precio_max is not None:
            filter_dict['precio_max'] = criteria.precio_max
        
        if criteria.search_text:
            filter_dict['search_text'] = criteria.search_text
        
        # Filtros avanzados (requieren procesamiento adicional)
        if criteria.has_cabina is not None:
            filter_dict['has_cabina'] = criteria.has_cabina
        
        if criteria.has_tta is not None:
            filter_dict['has_tta'] = criteria.has_tta
        
        if criteria.combustible:
            filter_dict['combustible'] = criteria.combustible
        
        if criteria.potencia_min is not None:
            filter_dict['potencia_min'] = criteria.potencia_min
        
        if criteria.potencia_max is not None:
            filter_dict['potencia_max'] = criteria.potencia_max
        
        # Ordenamiento y límite
        filter_dict['order_by'] = criteria.order_by
        filter_dict['order_dir'] = criteria.order_dir
        
        if criteria.limit:
            filter_dict['limit'] = criteria.limit
        
        return filter_dict
    
    def parse_search_query(self, query: str) -> Dict[str, Any]:
        """Parsea una búsqueda avanzada con operadores"""
        filters = {}
        
        # Patrones de búsqueda
        patterns = {
            'familia': r'familia:(\S+)',
            'marca': r'marca:(\S+)',
            'stock': r'stock:([><=]+)(\d+)',
            'precio': r'precio:([><=]+)(\d+)',
            'potencia': r'potencia:([><=]+)(\d+)',
            'cabina': r'cabina:(si|no|true|false)',
            'tta': r'tta:(si|no|true|false)'
        }
        
        for key, pattern in patterns.items():
            match = re.search(pattern, query, re.IGNORECASE)
            if match:
                if key in ['stock', 'precio', 'potencia']:
                    operator = match.group(1)
                    value = int(match.group(2))
                    
                    if operator == '>':
                        filters[f'{key}_min'] = value + 1
                    elif operator == '>=':
                        filters[f'{key}_min'] = value
                    elif operator == '<':
                        filters[f'{key}_max'] = value - 1
                    elif operator == '<=':
                        filters[f'{key}_max'] = value
                    elif operator == '=':
                        filters[f'{key}_min'] = value
                        filters[f'{key}_max'] = value
                
                elif key in ['cabina', 'tta']:
                    value = match.group(1).lower()
                    filters[f'has_{key}'] = value in ['si', 'true']
                
                else:
                    filters[key] = match.group(1)
                
                # Remover del query
                query = re.sub(pattern, '', query, flags=re.IGNORECASE)
        
        # El resto es búsqueda de texto
        remaining_text = query.strip()
        if remaining_text:
            filters['search_text'] = remaining_text
        
        return filters
    
    def save_filter(self, name: str, criteria: FilterCriteria = None):
        """Guarda un filtro con nombre"""
        if criteria is None:
            criteria = self.current_filter
        
        self.saved_filters[name] = criteria
    
    def load_filter(self, name: str) -> Optional[FilterCriteria]:
        """Carga un filtro guardado"""
        if name in self.saved_filters:
            return self.saved_filters[name]
        elif name in self.filter_presets:
            return self.filter_presets[name]
        return None
    
    def get_filter_summary(self, criteria: FilterCriteria) -> str:
        """Genera un resumen legible del filtro"""
        parts = []
        
        if criteria.familia:
            parts.append(f"Familia: {criteria.familia}")
        
        if criteria.marca:
            parts.append(f"Marca: {criteria.marca}")
        
        if criteria.stock_min is not None or criteria.stock_max is not None:
            stock_str = "Stock: "
            if criteria.stock_min is not None and criteria.stock_max is not None:
                stock_str += f"{criteria.stock_min}-{criteria.stock_max}"
            elif criteria.stock_min is not None:
                stock_str += f"≥{criteria.stock_min}"
            else:
                stock_str += f"≤{criteria.stock_max}"
            parts.append(stock_str)
        
        if criteria.precio_min is not None or criteria.precio_max is not None:
            precio_str = "Precio: "
            if criteria.precio_min is not None and criteria.precio_max is not None:
                precio_str += f"${criteria.precio_min}-${criteria.precio_max}"
            elif criteria.precio_min is not None:
                precio_str += f"≥${criteria.precio_min}"
            else:
                precio_str += f"≤${criteria.precio_max}"
            parts.append(precio_str)
        
        if criteria.has_cabina is not None:
            parts.append(f"Cabina: {'Sí' if criteria.has_cabina else 'No'}")
        
        if criteria.has_tta is not None:
            parts.append(f"TTA: {'Sí' if criteria.has_tta else 'No'}")
        
        if criteria.search_text:
            parts.append(f'Búsqueda: "{criteria.search_text}"')
        
        return " | ".join(parts) if parts else "Sin filtros"
    
    def clear_filter(self):
        """Limpia el filtro actual"""
        self.current_filter = FilterCriteria()
    
    def export_filters(self) -> Dict[str, Any]:
        """Exporta todos los filtros guardados"""
        return {
            'current': self.current_filter.__dict__,
            'saved': {name: f.__dict__ for name, f in self.saved_filters.items()},
            'presets': {name: f.__dict__ for name, f in self.filter_presets.items()}
        }
    
    def import_filters(self, data: Dict[str, Any]):
        """Importa filtros desde un diccionario"""
        if 'current' in data:
            self.current_filter = FilterCriteria(**data['current'])
        
        if 'saved' in data:
            self.saved_filters = {
                name: FilterCriteria(**f_dict) 
                for name, f_dict in data['saved'].items()
            }
