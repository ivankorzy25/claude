"""
Módulo de Productos para STEL Shop
Gestión de productos desde MySQL con selección flexible
"""

from .product_manager import ProductManager
from .database_handler import DatabaseHandler
from .product_filters import ProductFilters, FilterCriteria

__version__ = "1.0.0"
__all__ = ['ProductManager', 'DatabaseHandler', 'ProductFilters', 'FilterCriteria']
