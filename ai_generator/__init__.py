"""
Módulo AI Generator para STEL Shop
Gestión inteligente de descripciones con IA
"""

from .ai_handler import AIHandler
from .prompt_manager import PromptManager

__version__ = "1.0.0"
__all__ = ['AIHandler', 'PromptManager']

# Configuración por defecto
DEFAULT_CONFIG = {
    'temperature': 0.7,
    'max_tokens': 2000,
    'model': 'gemini-1.5-flash'
}
