"""
Validador de Datos para el Sistema de Productos
Detecta y corrige problemas comunes en los datos de la base de datos
"""

import pandas as pd
import numpy as np
import re
from typing import Dict, List, Tuple, Any
import logging

class DataValidator:
    """Validador de calidad de datos para productos"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # Patrones para detectar filas de encabezado
        self.header_patterns = [
            r'^(SKU|Descripción|Marca|Familia|Stock|Modelo|Potencia)$',
            r'^(sku|descripcion|marca|familia|stock|modelo|potencia)$',
            r'^[A-Za-z_]+$'  # Solo letras y guiones bajos
        ]
        
        # Valores que indican filas inválidas
        self.invalid_values = {
            'SKU': ['SKU', 'sku', 'Descripción', 'Marca', 'Familia', 'Stock'],
            'Descripción': ['Descripción', 'descripcion', 'SKU', 'Marca', 'Familia'],
            'Marca': ['Marca', 'marca', 'SKU', 'Descripción', 'Familia'],
            'Familia': ['Familia', 'familia', 'SKU', 'Descripción', 'Marca']
        }
    
    def validate_dataframe(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Valida y limpia un DataFrame completo
        Retorna: (DataFrame limpio, reporte de validación)
        """
        if df.empty:
            return df, {'status': 'empty', 'issues': [], 'stats': {}}
        
        self.logger.info(f"DataValidator: Iniciando validación de {len(df)} filas")
        
        original_count = len(df)
        issues = []
        
        # 1. Detectar y remover filas de encabezado
        df_clean, header_issues = self._remove_header_rows(df)
        issues.extend(header_issues)
        
        # 2. Validar campos obligatorios
        df_clean, required_issues = self._validate_required_fields(df_clean)
        issues.extend(required_issues)
        
        # 3. Detectar filas duplicadas
        df_clean, duplicate_issues = self._remove_duplicates(df_clean)
        issues.extend(duplicate_issues)
        
        # 4. Validar tipos de datos
        df_clean, type_issues = self._validate_data_types(df_clean)
        issues.extend(type_issues)
        
        # 5. Detectar anomalías en los datos
        anomaly_issues = self._detect_anomalies(df_clean)
        issues.extend(anomaly_issues)
        
        final_count = len(df_clean)
        removed_count = original_count - final_count
        
        # Generar reporte
        report = {
            'status': 'completed',
            'stats': {
                'original_rows': original_count,
                'final_rows': final_count,
                'removed_rows': removed_count,
                'removal_percentage': (removed_count / original_count * 100) if original_count > 0 else 0
            },
            'issues': issues,
            'data_quality_score': self._calculate_quality_score(df_clean)
        }
        
        self.logger.info(f"DataValidator: Validación completada - {final_count}/{original_count} filas válidas")
        
        return df_clean, report
    
    def _remove_header_rows(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[Dict]]:
        """Detecta y remueve filas que contienen nombres de columnas como datos"""
        issues = []
        if df.empty:
            return df, issues

        # Contar cuántas columnas de una fila coinciden con valores de encabezado
        header_match_count = pd.DataFrame(index=df.index, columns=self.invalid_values.keys(), dtype=int)
        for col, invalid_list in self.invalid_values.items():
            if col in df.columns:
                header_match_count[col] = df[col].isin(invalid_list).astype(int)
        
        # Una fila se considera un encabezado si al menos 2 de sus campos coinciden
        is_header_mask = header_match_count.sum(axis=1) >= 2

        # Contar cuántas filas se van a eliminar
        header_rows_count = is_header_mask.sum()

        if header_rows_count > 0:
            issues.append({
                'type': 'header_row_detected',
                'count': int(header_rows_count),
                'description': f'Detectadas y removidas {header_rows_count} filas que parecían ser encabezados.'
            })
            self.logger.info(f"_remove_header_rows: Removiendo {header_rows_count} filas de encabezado.")
            
            # Devolver el DataFrame sin las filas de encabezado
            return df[~is_header_mask].reset_index(drop=True), issues
        
        return df, issues
    
    def _validate_required_fields(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[Dict]]:
        """Valida que los campos obligatorios tengan valores válidos"""
        issues = []
        
        if df.empty:
            return df, issues
        
        required_fields = ['SKU', 'Descripción']
        valid_mask = pd.Series([True] * len(df))
        
        for field in required_fields:
            if field not in df.columns:
                continue
            
            # REGLA RELAJADA: Se reduce la longitud mínima a 1
            field_mask = (
                df[field].notna() &
                (df[field].astype(str).str.strip() != '') &
                (df[field].astype(str).str.len() >= 1)
            )
            
            invalid_count = (~field_mask).sum()
            if invalid_count > 0:
                valid_mask &= field_mask
                issues.append({
                    'type': 'required_field_invalid',
                    'field': field,
                    'count': invalid_count,
                    'description': f'Valores inválidos en campo obligatorio {field}'
                })
        
        removed_df = df[~valid_mask]
        if not removed_df.empty:
            self.logger.warning(f"_validate_required_fields: Removidas {len(removed_df)} filas por campos inválidos. Muestra:")
            for _, row in removed_df.head(3).iterrows():
                self.logger.warning(f"  - Fila removida (required): {row.to_dict()}")

        df_clean = df[valid_mask].reset_index(drop=True)
        return df_clean, issues
    
    def _remove_duplicates(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[Dict]]:
        """Detecta y remueve filas duplicadas"""
        issues = []
        
        if df.empty or 'SKU' not in df.columns:
            return df, issues
        
        # Detectar duplicados por SKU, ignorando el SKU 'SKU' que es probablemente un header
        # y otros valores no válidos.
        valid_sku_mask = ~df['SKU'].isin(['SKU', 'sku', None, ''])
        
        # Aplicar la detección de duplicados solo a las filas con SKUs válidos
        duplicate_mask = df[valid_sku_mask].duplicated(subset=['SKU'], keep='first')
        
        # Re-indexar la máscara para que coincida con el DataFrame original
        duplicate_mask = duplicate_mask.reindex(df.index, fill_value=False)
        duplicate_count = duplicate_mask.sum()
        
        if duplicate_count > 0:
            issues.append({
                'type': 'duplicate_sku',
                'count': duplicate_count,
                'description': f'SKUs duplicados encontrados'
            })
        
        removed_df = df[duplicate_mask]
        if not removed_df.empty:
            self.logger.warning(f"_remove_duplicates: Removidas {len(removed_df)} filas duplicadas. Muestra:")
            for _, row in removed_df.head(3).iterrows():
                self.logger.warning(f"  - Fila removida (duplicate): {row.to_dict()}")

        df_clean = df[~duplicate_mask].reset_index(drop=True)
        return df_clean, issues
    
    def _validate_data_types(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[Dict]]:
        """Valida tipos de datos y convierte cuando es necesario"""
        issues = []
        
        if df.empty:
            return df, issues
        
        # Validar campos numéricos
        numeric_fields = ['Precio_USD_con_IVA', 'Stock', 'Potencia_Numerica']
        
        for field in numeric_fields:
            if field not in df.columns:
                continue
            
            # Intentar convertir a numérico
            original_values = df[field].copy()
            df[field] = pd.to_numeric(df[field], errors='coerce')
            
            # Contar conversiones fallidas
            conversion_failures = df[field].isna().sum() - original_values.isna().sum()
            
            if conversion_failures > 0:
                issues.append({
                    'type': 'data_type_conversion',
                    'field': field,
                    'count': conversion_failures,
                    'description': f'Valores no numéricos en campo {field}'
                })
        
        return df, issues
    
    def _detect_anomalies(self, df: pd.DataFrame) -> List[Dict]:
        """Detecta anomalías en los datos"""
        issues = []
        
        if df.empty:
            return issues
        
        # Detectar SKUs con patrones anómalos
        if 'SKU' in df.columns:
            # SKUs muy cortos
            short_sku_count = (df['SKU'].astype(str).str.len() < 3).sum()
            if short_sku_count > 0:
                issues.append({
                    'type': 'anomaly_short_sku',
                    'count': short_sku_count,
                    'description': 'SKUs demasiado cortos (menos de 3 caracteres)'
                })
            
            # SKUs que son solo números
            numeric_sku_count = df['SKU'].astype(str).str.match(r'^\d+$').sum()
            if numeric_sku_count > len(df) * 0.8:  # Más del 80%
                issues.append({
                    'type': 'anomaly_numeric_sku',
                    'count': numeric_sku_count,
                    'description': 'Muchos SKUs son solo números'
                })
        
        # Detectar descripciones muy cortas
        if 'Descripción' in df.columns:
            short_desc_count = (df['Descripción'].astype(str).str.len() < 10).sum()
            if short_desc_count > 0:
                issues.append({
                    'type': 'anomaly_short_description',
                    'count': short_desc_count,
                    'description': 'Descripciones muy cortas (menos de 10 caracteres)'
                })
        
        # Detectar precios anómalos
        if 'Precio_USD_con_IVA' in df.columns:
            numeric_prices = pd.to_numeric(df['Precio_USD_con_IVA'], errors='coerce')
            
            # Precios negativos
            negative_prices = (numeric_prices < 0).sum()
            if negative_prices > 0:
                issues.append({
                    'type': 'anomaly_negative_price',
                    'count': negative_prices,
                    'description': 'Precios negativos encontrados'
                })
            
            # Precios extremadamente altos
            if not numeric_prices.empty:
                q99 = numeric_prices.quantile(0.99)
                extreme_prices = (numeric_prices > q99 * 10).sum()
                if extreme_prices > 0:
                    issues.append({
                        'type': 'anomaly_extreme_price',
                        'count': extreme_prices,
                        'description': 'Precios extremadamente altos detectados'
                    })
        
        return issues
    
    def _calculate_quality_score(self, df: pd.DataFrame) -> float:
        """Calcula un puntaje de calidad de datos (0-100)"""
        if df.empty:
            return 0.0
        
        score = 100.0
        
        # Penalizar por campos vacíos en columnas importantes
        important_fields = ['SKU', 'Descripción', 'Marca', 'Familia']
        
        for field in important_fields:
            if field in df.columns:
                null_percentage = df[field].isna().sum() / len(df)
                score -= null_percentage * 20  # Penalizar hasta 20 puntos por campo
        
        # Bonificar por diversidad de datos
        if 'SKU' in df.columns:
            uniqueness = df['SKU'].nunique() / len(df)
            score += (uniqueness - 0.8) * 10 if uniqueness > 0.8 else 0
        
        return max(0.0, min(100.0, score))
    
    def quick_validate(self, df: pd.DataFrame) -> bool:
        """Validación rápida para verificar si los datos son utilizables"""
        if df.empty:
            return False
        
        # Verificar campos mínimos
        required_fields = ['SKU', 'Descripción']
        if not all(field in df.columns for field in required_fields):
            return False
        
        # Verificar que no todas las filas sean headers
        header_count = 0
        for field in required_fields:
            header_count += (df[field].astype(str).str.strip() == field).sum()
        
        # Si más del 50% son headers, los datos no son utilizables
        if header_count > len(df) * 0.5:
            return False
        
        return True
    
    def get_data_summary(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Genera un resumen de los datos"""
        if df.empty:
            return {'status': 'empty'}
        
        summary = {
            'total_rows': len(df),
            'columns': list(df.columns),
            'column_count': len(df.columns)
        }
        
        # Estadísticas por columna
        for col in ['SKU', 'Descripción', 'Marca', 'Familia']:
            if col in df.columns:
                summary[f'{col.lower()}_stats'] = {
                    'unique_count': df[col].nunique(),
                    'null_count': df[col].isna().sum(),
                    'empty_count': (df[col].astype(str).str.strip() == '').sum()
                }
        
        return summary
