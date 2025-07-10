"""
Módulo de Navegación para STEL Shop
Gestión del navegador y automatización de procesos
"""

from .selenium_handler import SeleniumHandler
from .browser_manager import BrowserManager
from .stel_navigator import StelNavigator

__version__ = "1.0.0"
__all__ = ['SeleniumHandler', 'BrowserManager', 'StelNavigator']
