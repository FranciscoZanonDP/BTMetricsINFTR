-- Script para configurar la función exec_sql en Supabase
-- Esta función permite ejecutar consultas SQL dinámicas desde el bot

-- Crear función para ejecutar SQL dinámico
CREATE OR REPLACE FUNCTION exec_sql(sql_query text, params anyarray DEFAULT '{}')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
    dynamic_sql text;
BEGIN
    -- Validar que la consulta no sea peligrosa
    IF sql_query ILIKE '%DROP%' OR 
       sql_query ILIKE '%DELETE%' OR 
       sql_query ILIKE '%TRUNCATE%' OR
       sql_query ILIKE '%ALTER%' OR
       sql_query ILIKE '%CREATE%' OR
       sql_query ILIKE '%INSERT%' OR
       sql_query ILIKE '%UPDATE%' THEN
        RAISE EXCEPTION 'Operación no permitida: %', sql_query;
    END IF;

    -- Construir la consulta dinámica
    dynamic_sql := 'SELECT json_agg(t) FROM (' || sql_query || ') t';
    
    -- Ejecutar la consulta con parámetros
    EXECUTE dynamic_sql INTO result USING params;
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'error', SQLERRM,
            'sql_state', SQLSTATE
        );
END;
$$;

-- Otorgar permisos a la función
GRANT EXECUTE ON FUNCTION exec_sql(text, anyarray) TO authenticated;
GRANT EXECUTE ON FUNCTION exec_sql(text, anyarray) TO service_role;

-- Comentario sobre la función
COMMENT ON FUNCTION exec_sql(text, anyarray) IS 'Función para ejecutar consultas SQL de solo lectura de forma segura'; 