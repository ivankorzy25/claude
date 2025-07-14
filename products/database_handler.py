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
from .data_validator import DataValidator

class DatabaseHandler:
    """Maneja la conexión y operaciones con MySQL"""
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or self._load_config_from_file()
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

    def get_connection(self):
        """Crea y retorna una nueva conexión a la base de datos."""
        use_cloud_sql = self.config.get("use_cloud_sql", False)
        db_user = self.config.get("user")
        db_pass = self.config.get("password")
        db_name = self.config.get("database")

        if use_cloud_sql:
            instance_connection_name = self.config.get("instance_connection_name")
            if not all([instance_connection_name, db_user, db_name]):
                self.logger.error("Configuración de Cloud SQL incompleta.")
                raise ConnectionError("Configuración de Cloud SQL incompleta.")
            
            return self.connector.connect(
                instance_connection_name,
                "pymysql",
                user=db_user,
                password=db_pass,
                db=db_name,
                cursorclass=pymysql.cursors.DictCursor
            )
        else:
            db_host = self.config.get("host")
            db_port = self.config.get("port")
            if not all([db_host, db_port, db_user, db_name]):
                self.logger.error("Configuración de base de datos local incompleta.")
                raise ConnectionError("Configuración de base de datos local incompleta.")
            
            return pymysql.connect(
                host=db_host,
                port=int(db_port),
                user=db_user,
                password=db_pass,
                database=db_name,
                cursorclass=pymysql.cursors.DictCursor
            )

    def test_connection(self) -> bool:
        """Prueba la conexión a la base de datos."""
        connection = None
        try:
            connection = self.get_connection()
            connection_type = "Cloud SQL" if self.config.get("use_cloud_sql") else "MySQL local"
            self.logger.info(f"Prueba de conexión a {connection_type} exitosa")
            return True
        except Exception as e:
            connection_type = "Cloud SQL" if self.config.get("use_cloud_sql") else "MySQL local"
            self.logger.error(f"Error en prueba de conexión a {connection_type}: {e}")
            return False
        finally:
            if connection:
                connection.close()

    def get_all_products(self) -> pd.DataFrame:
        """Obtiene todos los productos de la tabla con validación automática"""
        connection = None
        try:
            connection = self.get_connection()
            # Query simplificado - obtener todos los datos y validar en Python
            query = f"""
            SELECT * FROM {self.config['table']}
            WHERE SKU IS NOT NULL 
            AND SKU != ''
            AND Descripción IS NOT NULL 
            AND Descripción != ''
            ORDER BY SKU
            LIMIT 3000
            """
            
            self.logger.info(f"get_all_products: Ejecutando query para obtener datos brutos")
            df_raw = pd.read_sql(query, connection)
            
            if df_raw.empty:
                self.logger.warning("get_all_products: No se obtuvieron datos de la base de datos")
                return pd.DataFrame()
            
            self.logger.info(f"get_all_products: Obtenidos {len(df_raw)} registros brutos de la BD")
            
            # Aplicar validación automática con DataValidator
            validator = DataValidator()
            df_clean, validation_report = validator.validate_dataframe(df_raw)
            
            # Log del reporte de validación
            self.logger.info(f"get_all_products: Validación completada")
            self.logger.info(f"  - Filas originales: {validation_report['stats']['original_rows']}")
            self.logger.info(f"  - Filas finales: {validation_report['stats']['final_rows']}")
            self.logger.info(f"  - Filas removidas: {validation_report['stats']['removed_rows']}")
            self.logger.info(f"  - Porcentaje removido: {validation_report['stats']['removal_percentage']:.1f}%")
            self.logger.info(f"  - Puntaje de calidad: {validation_report['data_quality_score']:.1f}/100")
            
            # Log de problemas encontrados
            if validation_report['issues']:
                self.logger.info("get_all_products: Problemas detectados y corregidos:")
                for issue in validation_report['issues']:
                    self.logger.info(f"  - {issue['type']}: {issue['description']} ({issue['count']} casos)")
            
            # Log de muestra de datos finales
            if not df_clean.empty:
                first_row = df_clean.iloc[0]
                last_row = df_clean.iloc[-1]
                self.logger.info(f"Primera fila válida - SKU: '{first_row.get('SKU')}', Descripción: '{first_row.get('Descripción')}'")
                self.logger.info(f"Última fila válida - SKU: '{last_row.get('SKU')}', Descripción: '{last_row.get('Descripción')}'")
                
                # Verificar diversidad de datos
                unique_skus = df_clean['SKU'].nunique()
                unique_descriptions = df_clean['Descripción'].nunique()
                self.logger.info(f"Diversidad de datos - SKUs únicos: {unique_skus}, Descripciones únicas: {unique_descriptions}")
            else:
                self.logger.warning("¡No se encontraron registros válidos después de la validación!")
            
            return df_clean
            
        except Exception as e:
            self.logger.error(f"get_all_products: Error obteniendo productos: {e}")
            import traceback
            self.logger.error(f"Traceback completo: {traceback.format_exc()}")
            return pd.DataFrame()
        finally:
            if connection:
                connection.close()
    
    def get_products_filtered(self, filters: Dict[str, Any]) -> pd.DataFrame:
        """Obtiene productos con filtros aplicados"""
        connection = None
        try:
            connection = self.get_connection()
            # Base query con filtros para excluir filas inválidas
            base_query = f"""SELECT * FROM {self.config['table']} WHERE 1=1 """
            params = []
            self.logger.info(f"get_products_filtered: Filtros recibidos: {filters}")
            
            # Construir query con filtros
            if filters.get('familia'):
                base_query += " AND Familia = %s"
                params.append(filters['familia'])
            
            if filters.get('marca'):
                base_query += " AND Marca = %s"
                params.append(filters['marca'])
            
            # Filtros de stock mejorados
            if filters.get('stock_min') is not None:
                base_query += " AND CAST(Stock AS SIGNED) >= %s"
                params.append(filters['stock_min'])

            if filters.get('stock_max') is not None:
                base_query += " AND CAST(Stock AS SIGNED) <= %s"
                params.append(filters['stock_max'])
            
            # Filtros especiales de stock
            if filters.get('stock_disponible'):
                base_query += " AND (Stock = 'Disponible' OR CAST(Stock AS SIGNED) > 0)"
            
            if filters.get('stock_consultar'):
                base_query += " AND Stock = 'Consultar'"
            
            # Filtros de precio
            if filters.get('precio_min') is not None:
                base_query += " AND CAST(Precio_USD_con_IVA AS DECIMAL(10,2)) >= %s"
                params.append(filters['precio_min'])
            
            if filters.get('precio_max') is not None:
                base_query += " AND CAST(Precio_USD_con_IVA AS DECIMAL(10,2)) <= %s"
                params.append(filters['precio_max'])
            
            # Filtros de potencia
            if filters.get('potencia_min') is not None:
                base_query += " AND CAST(REGEXP_REPLACE(Potencia, '[^0-9.]', '') AS DECIMAL(10,2)) >= %s"
                params.append(filters['potencia_min'])
            
            if filters.get('potencia_max') is not None:
                base_query += " AND CAST(REGEXP_REPLACE(Potencia, '[^0-9.]', '') AS DECIMAL(10,2)) <= %s"
                params.append(filters['potencia_max'])
            
            # Filtro de combustible
            if filters.get('combustible'):
                base_query += " AND Combustible LIKE %s"
                params.append(f"%{filters['combustible']}%")
            
            # Filtros de cabina y TTA
            if filters.get('has_cabina') is not None:
                if filters['has_cabina']:
                    base_query += " AND (Cabina IS NOT NULL AND Cabina != '' AND Cabina != 'Sin Cabina')"
                else:
                    base_query += " AND (Cabina IS NULL OR Cabina = '' OR Cabina = 'Sin Cabina')"
            
            if filters.get('has_tta') is not None:
                if filters['has_tta']:
                    base_query += " AND (TTA_Incluido = 'Sí' OR TTA_Incluido = 'Si' OR TTA_Incluido = '1')"
                else:
                    base_query += " AND (TTA_Incluido = 'No' OR TTA_Incluido = '0' OR TTA_Incluido IS NULL)"
            
            # Búsqueda de texto
            if filters.get('search_text'):
                search = f"%{filters['search_text']}%"
                base_query += " AND (SKU LIKE %s OR Descripción LIKE %s OR Modelo LIKE %s OR Marca LIKE %s)"
                params.extend([search, search, search, search])
            
            # Ordenamiento
            order_by = filters.get('order_by', 'SKU')
            order_dir = filters.get('order_dir', 'ASC')
            
            # Validar columna de ordenamiento
            valid_columns = ['SKU', 'Descripción', 'Marca', 'Familia', 'Stock', 'Precio_USD_con_IVA', 'Potencia']
            if order_by in valid_columns:
                base_query += f" ORDER BY {order_by} {order_dir}"
            else:
                base_query += " ORDER BY SKU ASC"
            
            # Límite
            if filters.get('limit') and isinstance(filters['limit'], int) and filters['limit'] > 0:
                base_query += f" LIMIT {filters['limit']}"
            
            self.logger.info(f"Ejecutando query: {base_query}")
            self.logger.info(f"Parámetros: {params}")
            df = pd.read_sql(base_query, connection, params=params)
            
            # Aplicar el mismo filtro que en get_all_products
            if not df.empty:
                # Remover filas donde SKU sea igual al nombre de la columna
                df = df[df['SKU'] != 'SKU']
                
                # Remover cualquier fila donde múltiples campos sean iguales a sus nombres de columna
                mask = True
                for col in ['SKU', 'Descripción', 'Marca', 'Familia']:
                    if col in df.columns:
                        mask &= (df[col] != col)
                df = df[mask]
                
                # Reset index después del filtrado
                df = df.reset_index(drop=True)
            
            self.logger.info(f"Filtrados {len(df)} productos (después de filtrar datos inválidos)")
            return df
        except Exception as e:
            self.logger.error(f"Error en consulta filtrada: {e}")
            self.logger.error(f"Query: {base_query}")
            self.logger.error(f"Params: {params}")
            return pd.DataFrame()
        finally:
            if connection:
                connection.close()
        params = []
        self.logger.info(f"get_products_filtered: Filtros recibidos: {filters}")
        
        # Construir query con filtros
        if filters.get('familia'):
            base_query += " AND Familia = %s"
            params.append(filters['familia'])
        
        if filters.get('marca'):
            base_query += " AND Marca = %s"
            params.append(filters['marca'])
        
        # Filtros de stock mejorados
        if filters.get('stock_min') is not None:
            base_query += " AND CAST(Stock AS SIGNED) >= %s"
            params.append(filters['stock_min'])

        if filters.get('stock_max') is not None:
            base_query += " AND CAST(Stock AS SIGNED) <= %s"
            params.append(filters['stock_max'])
        
        # Filtros especiales de stock
        if filters.get('stock_disponible'):
            base_query += " AND (Stock = 'Disponible' OR CAST(Stock AS SIGNED) > 0)"
        
        if filters.get('stock_consultar'):
            base_query += " AND Stock = 'Consultar'"
        
        # Filtros de precio
        if filters.get('precio_min') is not None:
            base_query += " AND CAST(Precio_USD_con_IVA AS DECIMAL(10,2)) >= %s"
            params.append(filters['precio_min'])
        
        if filters.get('precio_max') is not None:
            base_query += " AND CAST(Precio_USD_con_IVA AS DECIMAL(10,2)) <= %s"
            params.append(filters['precio_max'])
        
        # Filtros de potencia
        if filters.get('potencia_min') is not None:
            base_query += " AND CAST(REGEXP_REPLACE(Potencia, '[^0-9.]', '') AS DECIMAL(10,2)) >= %s"
            params.append(filters['potencia_min'])
        
        if filters.get('potencia_max') is not None:
            base_query += " AND CAST(REGEXP_REPLACE(Potencia, '[^0-9.]', '') AS DECIMAL(10,2)) <= %s"
            params.append(filters['potencia_max'])
        
        # Filtro de combustible
        if filters.get('combustible'):
            base_query += " AND Combustible LIKE %s"
            params.append(f"%{filters['combustible']}%")
        
        # Filtros de cabina y TTA
        if filters.get('has_cabina') is not None:
            if filters['has_cabina']:
                base_query += " AND (Cabina IS NOT NULL AND Cabina != '' AND Cabina != 'Sin Cabina')"
            else:
                base_query += " AND (Cabina IS NULL OR Cabina = '' OR Cabina = 'Sin Cabina')"
        
        if filters.get('has_tta') is not None:
            if filters['has_tta']:
                base_query += " AND (TTA_Incluido = 'Sí' OR TTA_Incluido = 'Si' OR TTA_Incluido = '1')"
            else:
                base_query += " AND (TTA_Incluido = 'No' OR TTA_Incluido = '0' OR TTA_Incluido IS NULL)"
        
        # Búsqueda de texto
        if filters.get('search_text'):
            search = f"%{filters['search_text']}%"
            base_query += " AND (SKU LIKE %s OR Descripción LIKE %s OR Modelo LIKE %s OR Marca LIKE %s)"
            params.extend([search, search, search, search])
        
        # Ordenamiento
        order_by = filters.get('order_by', 'SKU')
        order_dir = filters.get('order_dir', 'ASC')
        
        # Validar columna de ordenamiento
        valid_columns = ['SKU', 'Descripción', 'Marca', 'Familia', 'Stock', 'Precio_USD_con_IVA', 'Potencia']
        if order_by in valid_columns:
            base_query += f" ORDER BY {order_by} {order_dir}"
        else:
            base_query += " ORDER BY SKU ASC"
        
        # Límite
        if filters.get('limit') and isinstance(filters['limit'], int) and filters['limit'] > 0:
            base_query += f" LIMIT {filters['limit']}"
        
        try:
            self.logger.info(f"Ejecutando query: {base_query}")
            self.logger.info(f"Parámetros: {params}")
            df = pd.read_sql(base_query, connection, params=params)
            
            # Aplicar el mismo filtro que en get_all_products
            if not df.empty:
                # Remover filas donde SKU sea igual al nombre de la columna
                df = df[df['SKU'] != 'SKU']
                
                # Remover cualquier fila donde múltiples campos sean iguales a sus nombres de columna
                mask = True
                for col in ['SKU', 'Descripción', 'Marca', 'Familia']:
                    if col in df.columns:
                        mask &= (df[col] != col)
                df = df[mask]
                
                # Reset index después del filtrado
                df = df.reset_index(drop=True)
            
            self.logger.info(f"Filtrados {len(df)} productos (después de filtrar datos inválidos)")
            return df
        except Exception as e:
            self.logger.error(f"Error en consulta filtrada: {e}")
            self.logger.error(f"Query: {base_query}")
            self.logger.error(f"Params: {params}")
            return pd.DataFrame()
        finally:
            if connection:
                connection.close()

    def get_distinct_values(self, column: str) -> List[str]:
        """Obtiene valores únicos de una columna"""
        connection = None
        try:
            connection = self.get_connection()
            query = f"SELECT DISTINCT {column} FROM {self.config['table']} WHERE {column} IS NOT NULL ORDER BY {column}"
            with connection.cursor() as cursor:
                cursor.execute(query)
                results = cursor.fetchall()
                return [row[column] for row in results if row[column]]
        except Exception as e:
            self.logger.error(f"Error obteniendo valores únicos de {column}: {e}")
            return []
        finally:
            if connection:
                connection.close()

    def get_products_by_ids(self, ids: List[str]) -> pd.DataFrame:
        """Obtiene productos específicos por SKU"""
        if not ids:
            return pd.DataFrame()
        
        connection = None
        try:
            connection = self.get_connection()
            placeholders = ', '.join(['%s'] * len(ids))
            query = f"SELECT * FROM {self.config['table']} WHERE SKU IN ({placeholders})"
            df = pd.read_sql(query, connection, params=ids)
            return df
        except Exception as e:
            self.logger.error(f"Error obteniendo productos por IDs: {e}")
            return pd.DataFrame()
        finally:
            if connection:
                connection.close()

    def get_statistics(self) -> Dict[str, Any]:
        """Obtiene estadísticas de la base de datos"""
        connection = None
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
            connection = self.get_connection()
            # Total de productos
            query = f"SELECT COUNT(*) as count FROM {self.config['table']}"
            with connection.cursor() as cursor:
                cursor.execute(query)
                stats['total_products'] = cursor.fetchone()['count']
            
            # Familias únicas
            stats['total_families'] = len(self.get_distinct_values('Familia'))
            
            # Marcas únicas
            stats['total_brands'] = len(self.get_distinct_values('Marca'))
            
            # Productos con/sin stock
            query = f"SELECT COUNT(*) as count FROM {self.config['table']} WHERE Stock > 0"
            with connection.cursor() as cursor:
                cursor.execute(query)
                stats['products_with_stock'] = cursor.fetchone()['count']
            
            stats['products_without_stock'] = stats['total_products'] - stats['products_with_stock']
            
            # Precio promedio
            query = f"SELECT AVG(Precio_USD_con_IVA) as avg_price FROM {self.config['table']} WHERE Precio_USD_con_IVA > 0"
            with connection.cursor() as cursor:
                cursor.execute(query)
                result = cursor.fetchone()
                stats['average_price'] = round(result['avg_price'], 2) if result['avg_price'] else 0
            
            stats['last_update'] = datetime.now().isoformat()
            
        except Exception as e:
            self.logger.error(f"Error obteniendo estadísticas: {e}")
        finally:
            if connection:
                connection.close()
        
        return stats
    
    def update_product_field(self, sku: str, field: str, value: Any) -> bool:
        """Actualiza un campo específico de un producto"""
        connection = None
        try:
            connection = self.get_connection()
            query = f"UPDATE {self.config['table']} SET {field} = %s WHERE SKU = %s"
            with connection.cursor() as cursor:
                cursor.execute(query, (value, sku))
                connection.commit()
                return cursor.rowcount > 0
        except Exception as e:
            self.logger.error(f"Error actualizando producto {sku}: {e}")
            if connection:
                connection.rollback()
            return False
        finally:
            if connection:
                connection.close()

    def bulk_update_field(self, updates: List[Dict[str, Any]]) -> Dict[str, int]:
        """Actualiza múltiples productos en lote"""
        connection = None
        results = {'success': 0, 'failed': 0}
        
        try:
            connection = self.get_connection()
            with connection.cursor() as cursor:
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
                
                connection.commit()
        except Exception as e:
            self.logger.error(f"Error en actualización masiva: {e}")
            if connection:
                connection.rollback()
        finally:
            if connection:
                connection.close()

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
