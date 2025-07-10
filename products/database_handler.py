"""
Manejador de Base de Datos MySQL
Gestiona la conexión y consultas a la base de datos
"""

import pymysql
import pandas as pd
from typing import Dict, List, Any, Optional
import json
from datetime import datetime
from pathlib import Path
import logging
from google.cloud.sql.connector import Connector

class DatabaseHandler:
    """Maneja la conexión y operaciones con MySQL"""
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or self._load_config_from_file()
        self.connection = None
        self.logger = logging.getLogger(__name__)
        self.connector = Connector()

    def _load_config_from_file(self) -> Dict[str, Any]:
        """Carga configuración desde archivo"""
        config_file = Path("config/database_config.json")
        if config_file.exists():
            try:
                with open(config_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                self.logger.error(f"Error cargando configuración: {e}")
        return {}

    def connect(self) -> bool:
        """Establece conexión con la base de datos usando Cloud SQL Connector"""
        try:
            instance_connection_name = self.config.get("instance_connection_name")
            db_user = self.config.get("user")
            db_pass = self.config.get("password")
            db_name = self.config.get("database")

            if not all([instance_connection_name, db_user, db_pass, db_name]):
                self.logger.error("Configuración de base de datos incompleta.")
                return False

            self.connection = self.connector.connect(
                instance_connection_name,
                "pymysql",
                user=db_user,
                password=db_pass,
                db=db_name,
                cursorclass=pymysql.cursors.DictCursor
            )
            self.logger.info("Conexión a Cloud SQL establecida")
            return True
        except Exception as e:
            self.logger.error(f"Error conectando a Cloud SQL: {e}")
            return False
    
    def disconnect(self):
        """Cierra la conexión con la base de datos"""
        if self.connection:
            self.connection.close()
            self.connection = None
            self.logger.info("Conexión a MySQL cerrada")
    
    def is_connected(self) -> bool:
        """Verifica si hay conexión activa"""
        if not self.connection:
            return False
        try:
            self.connection.ping(reconnect=True)
            return True
        except:
            return False
    
    def get_all_products(self) -> pd.DataFrame:
        """Obtiene todos los productos de la tabla"""
        if not self.is_connected():
            self.connect()
        
        try:
            query = f"SELECT * FROM {self.config['table']}"
            df = pd.read_sql(query, self.connection)
            self.logger.info(f"Obtenidos {len(df)} productos de la base de datos")
            return df
        except Exception as e:
            self.logger.error(f"Error obteniendo productos: {e}")
            return pd.DataFrame()
    
    def get_products_filtered(self, filters: Dict[str, Any]) -> pd.DataFrame:
        """Obtiene productos con filtros aplicados"""
        if not self.is_connected():
            self.connect()
        
        base_query = f"SELECT * FROM {self.config['table']} WHERE 1=1"
        params = []
        
        # Construir query con filtros
        if filters.get('familia'):
            base_query += " AND Familia = %s"
            params.append(filters['familia'])
        
        if filters.get('marca'):
            base_query += " AND Marca = %s"
            params.append(filters['marca'])
        
        if filters.get('stock_min') is not None:
            base_query += " AND Stock >= %s"
            params.append(filters['stock_min'])
        
        if filters.get('precio_min') is not None:
            base_query += " AND Precio_USD_con_IVA >= %s"
            params.append(filters['precio_min'])
        
        if filters.get('precio_max') is not None:
            base_query += " AND Precio_USD_con_IVA <= %s"
            params.append(filters['precio_max'])
        
        if filters.get('search_text'):
            search = f"%{filters['search_text']}%"
            base_query += " AND (SKU LIKE %s OR Descripción LIKE %s OR Modelo LIKE %s)"
            params.extend([search, search, search])
        
        # Ordenamiento
        order_by = filters.get('order_by', 'SKU')
        order_dir = filters.get('order_dir', 'ASC')
        base_query += f" ORDER BY {order_by} {order_dir}"
        
        # Límite
        if filters.get('limit'):
            base_query += f" LIMIT {filters['limit']}"
        
        try:
            df = pd.read_sql(base_query, self.connection, params=params)
            self.logger.info(f"Filtrados {len(df)} productos")
            return df
        except Exception as e:
            self.logger.error(f"Error en consulta filtrada: {e}")
            return pd.DataFrame()
    
    def get_distinct_values(self, column: str) -> List[str]:
        """Obtiene valores únicos de una columna"""
        if not self.is_connected():
            self.connect()
        
        try:
            query = f"SELECT DISTINCT {column} FROM {self.config['table']} WHERE {column} IS NOT NULL ORDER BY {column}"
            with self.connection.cursor() as cursor:
                cursor.execute(query)
                results = cursor.fetchall()
                return [row[column] for row in results if row[column]]
        except Exception as e:
            self.logger.error(f"Error obteniendo valores únicos de {column}: {e}")
            return []
    
    def get_products_by_ids(self, ids: List[str]) -> pd.DataFrame:
        """Obtiene productos específicos por SKU"""
        if not ids:
            return pd.DataFrame()
        
        if not self.is_connected():
            self.connect()
        
        placeholders = ', '.join(['%s'] * len(ids))
        query = f"SELECT * FROM {self.config['table']} WHERE SKU IN ({placeholders})"
        
        try:
            df = pd.read_sql(query, self.connection, params=ids)
            return df
        except Exception as e:
            self.logger.error(f"Error obteniendo productos por IDs: {e}")
            return pd.DataFrame()
    
    def get_statistics(self) -> Dict[str, Any]:
        """Obtiene estadísticas de la base de datos"""
        if not self.is_connected():
            self.connect()
        
        stats = {
            'total_products': 0,
            'total_families': 0,
            'total_brands': 0,
            'products_with_stock': 0,
            'products_without_stock': 0,
            'average_price': 0,
            'last_update': None
        }
        
        try:
            # Total de productos
            query = f"SELECT COUNT(*) as count FROM {self.config['table']}"
            with self.connection.cursor() as cursor:
                cursor.execute(query)
                stats['total_products'] = cursor.fetchone()['count']
            
            # Familias únicas
            stats['total_families'] = len(self.get_distinct_values('Familia'))
            
            # Marcas únicas
            stats['total_brands'] = len(self.get_distinct_values('Marca'))
            
            # Productos con/sin stock
            query = f"SELECT COUNT(*) as count FROM {self.config['table']} WHERE Stock > 0"
            with self.connection.cursor() as cursor:
                cursor.execute(query)
                stats['products_with_stock'] = cursor.fetchone()['count']
            
            stats['products_without_stock'] = stats['total_products'] - stats['products_with_stock']
            
            # Precio promedio
            query = f"SELECT AVG(Precio_USD_con_IVA) as avg_price FROM {self.config['table']} WHERE Precio_USD_con_IVA > 0"
            with self.connection.cursor() as cursor:
                cursor.execute(query)
                result = cursor.fetchone()
                stats['average_price'] = round(result['avg_price'], 2) if result['avg_price'] else 0
            
            stats['last_update'] = datetime.now().isoformat()
            
        except Exception as e:
            self.logger.error(f"Error obteniendo estadísticas: {e}")
        
        return stats
    
    def update_product_field(self, sku: str, field: str, value: Any) -> bool:
        """Actualiza un campo específico de un producto"""
        if not self.is_connected():
            self.connect()
        
        try:
            query = f"UPDATE {self.config['table']} SET {field} = %s WHERE SKU = %s"
            with self.connection.cursor() as cursor:
                cursor.execute(query, (value, sku))
                self.connection.commit()
                return cursor.rowcount > 0
        except Exception as e:
            self.logger.error(f"Error actualizando producto {sku}: {e}")
            self.connection.rollback()
            return False
    
    def bulk_update_field(self, updates: List[Dict[str, Any]]) -> Dict[str, int]:
        """Actualiza múltiples productos en lote"""
        if not self.is_connected():
            self.connect()
        
        results = {'success': 0, 'failed': 0}
        
        try:
            with self.connection.cursor() as cursor:
                for update in updates:
                    try:
                        query = f"UPDATE {self.config['table']} SET {update['field']} = %s WHERE SKU = %s"
                        cursor.execute(query, (update['value'], update['sku']))
                        if cursor.rowcount > 0:
                            results['success'] += 1
                        else:
                            results['failed'] += 1
                    except Exception as e:
                        self.logger.error(f"Error en update de {update['sku']}: {e}")
                        results['failed'] += 1
                
                self.connection.commit()
        except Exception as e:
            self.logger.error(f"Error en actualización masiva: {e}")
            self.connection.rollback()
        
        return results
    
    def export_to_excel(self, df: pd.DataFrame, filename: str = None) -> str:
        """Exporta DataFrame a Excel"""
        if filename is None:
            filename = f"productos_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        try:
            filepath = Path("exports") / filename
            filepath.parent.mkdir(exist_ok=True)
            
            with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, sheet_name='Productos')
                
                # Ajustar anchos de columna
                worksheet = writer.sheets['Productos']
                for idx, col in enumerate(df.columns):
                    max_length = max(
                        df[col].astype(str).apply(len).max(),
                        len(col)
                    ) + 2
                    worksheet.column_dimensions[chr(65 + idx)].width = min(max_length, 50)
            
            self.logger.info(f"Exportado a {filepath}")
            return str(filepath)
        except Exception as e:
            self.logger.error(f"Error exportando a Excel: {e}")
            return ""
