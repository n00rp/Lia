"""
Konfigurationsfil för Simulink WebView Navigation System
"""

import os
from pathlib import Path

class Config:
    """Bas-konfiguration"""
    
    # Nätverksmapp - ÄNDRA DETTA TILL DIN FAKTISKA SÖKVÄG
    NETWORK_PATH = os.environ.get('NETWORK_PATH', r'\\network\System_Releases')
    
    # Lokal testmapp (om nätverket inte är tillgängligt)
    LOCAL_TEST_PATH = os.environ.get('LOCAL_TEST_PATH', r'C:\TestData\System_Releases')
    
    # Välj vilken sökväg som ska användas
    USE_NETWORK = os.environ.get('USE_NETWORK', 'True').lower() == 'true'
    BASE_PATH = NETWORK_PATH if USE_NETWORK else LOCAL_TEST_PATH
    
    # Cache-inställningar
    CACHE_ENABLED = True
    CACHE_TIMEOUT = 300  # 5 minuter
    
    # Filfilter
    SVG_PATTERN = "*.svg"
    JSON_PATTERN = "*.json"
    
    # Version-mönster (regex)
    VERSION_PATTERN = r'Produkter\.(\d+_\d+\.\d+\.\d+\.\d+)'
    
    # Server-inställningar
    DEBUG = os.environ.get('DEBUG', 'True').lower() == 'true'
    HOST = os.environ.get('HOST', '0.0.0.0')
    PORT = int(os.environ.get('PORT', 5000))


class DevelopmentConfig(Config):
    """Utvecklings-konfiguration"""
    DEBUG = True
    USE_NETWORK = False  # Använd lokal mapp för utveckling


class ProductionConfig(Config):
    """Produktions-konfiguration"""
    DEBUG = False
    USE_NETWORK = True  # Använd nätverksmapp i produktion


# Välj konfiguration baserat på miljövariabel
config_map = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}

def get_config(env=None):
    """Hämta konfiguration baserat på miljö"""
    env = env or os.environ.get('FLASK_ENV', 'default')
    return config_map.get(env, DevelopmentConfig)
