-- ============================================================
--  VISTAS OLAP — 5 cubos requeridos
--  Proyecto: Reserva Inteligente de Restaurantes — Etapa 3
--  Base de datos Hive: restaurant_dw
--  Ejecutar DESPUÉS de 01_star_schema.hql
-- ============================================================

USE restaurant_dw;

-- ============================================================
--  Cubo 1: Ingresos por mes y categoría de producto
--  → Dashboard: "Ingresos por mes y categoría de producto"
--  → Análisis: tendencias de consumo por categoría
-- ============================================================
CREATE OR REPLACE VIEW v_ingresos_mes_categoria AS
SELECT
    t.anio,
    t.mes,
    t.nombre_mes,
    p.categoria,
    r.nombre                                AS restaurante,
    r.zona_geografica                       AS zona_restaurante,
    COUNT(DISTINCT f.id_pedido_origen)      AS total_pedidos,
    SUM(f.cantidad)                         AS unidades_vendidas,
    ROUND(SUM(f.subtotal), 2)               AS ingresos,
    ROUND(AVG(f.precio_unitario), 2)        AS precio_promedio
FROM fact_pedido f
JOIN dim_tiempo         t   ON f.id_tiempo        = t.id
JOIN dim_plato          p   ON f.id_plato         = p.id
JOIN dim_restaurante    r   ON f.id_restaurante   = r.id
JOIN dim_estado_pedido  e   ON f.id_estado_pedido = e.id
WHERE e.nombre = 'completado'
GROUP BY
    t.anio, t.mes, t.nombre_mes,
    p.categoria,
    r.nombre, r.zona_geografica;

-- ============================================================
--  Cubo 2: Actividad de clientes por zona geográfica
--  → Dashboard: "Actividad de clientes por zona geográfica"
--  → Análisis: distribución geográfica de la demanda
--
--  NOTA: dim_usuario.zona_geografica no se usa porque la tabla
--  usuario en el OLTP no almacena coordenadas del cliente.
--  En su lugar, derivamos la "zona del cliente" a partir de las
--  coordenadas de entrega de cada pedido (fact_pedido), que sí
--  reflejan dónde solicitó el cliente que le llevaran el pedido.
--  Las mismas reglas de zona que usa transform.py (_zona_geografica).
-- ============================================================
CREATE OR REPLACE VIEW v_actividad_zona AS
SELECT
    t.anio,
    t.mes,
    t.nombre_mes,
    CASE
        WHEN f.latitud_entrega IS NULL OR f.longitud_entrega IS NULL THEN 'Desconocida'
        WHEN f.latitud_entrega BETWEEN 9.90 AND 9.96
         AND f.longitud_entrega BETWEEN -84.10 AND -84.04 THEN 'San José Centro'
        WHEN f.latitud_entrega BETWEEN 9.88 AND 9.93
         AND f.longitud_entrega BETWEEN -84.16 AND -84.12 THEN 'Escazú'
        WHEN f.latitud_entrega BETWEEN 9.93 AND 9.98
         AND f.longitud_entrega BETWEEN -84.12 AND -84.06 THEN 'Santa Ana'
        WHEN f.latitud_entrega BETWEEN 9.85 AND 9.92
         AND f.longitud_entrega BETWEEN -83.95 AND -83.88 THEN 'Cartago Centro'
        WHEN f.latitud_entrega BETWEEN 9.98 AND 10.02
         AND f.longitud_entrega BETWEEN -84.12 AND -84.06 THEN 'Heredia Centro'
        WHEN f.latitud_entrega BETWEEN 10.00 AND 10.05
         AND f.longitud_entrega BETWEEN -84.23 AND -84.17 THEN 'Alajuela Centro'
        ELSE 'Otra zona'
    END                                      AS zona_cliente,
    r.zona_geografica                       AS zona_restaurante,
    r.nombre                                AS restaurante,
    COUNT(DISTINCT f.id_usuario)            AS clientes_unicos,
    COUNT(DISTINCT f.id_pedido_origen)      AS total_pedidos,
    ROUND(SUM(f.subtotal), 2)               AS ingresos,
    ROUND(AVG(f.precio_total_pedido), 2)    AS ticket_promedio
FROM fact_pedido f
JOIN dim_tiempo         t   ON f.id_tiempo       = t.id
JOIN dim_restaurante    r   ON f.id_restaurante  = r.id
GROUP BY
    t.anio, t.mes, t.nombre_mes,
    CASE
        WHEN f.latitud_entrega IS NULL OR f.longitud_entrega IS NULL THEN 'Desconocida'
        WHEN f.latitud_entrega BETWEEN 9.90 AND 9.96
         AND f.longitud_entrega BETWEEN -84.10 AND -84.04 THEN 'San José Centro'
        WHEN f.latitud_entrega BETWEEN 9.88 AND 9.93
         AND f.longitud_entrega BETWEEN -84.16 AND -84.12 THEN 'Escazú'
        WHEN f.latitud_entrega BETWEEN 9.93 AND 9.98
         AND f.longitud_entrega BETWEEN -84.12 AND -84.06 THEN 'Santa Ana'
        WHEN f.latitud_entrega BETWEEN 9.85 AND 9.92
         AND f.longitud_entrega BETWEEN -83.95 AND -83.88 THEN 'Cartago Centro'
        WHEN f.latitud_entrega BETWEEN 9.98 AND 10.02
         AND f.longitud_entrega BETWEEN -84.12 AND -84.06 THEN 'Heredia Centro'
        WHEN f.latitud_entrega BETWEEN 10.00 AND 10.05
         AND f.longitud_entrega BETWEEN -84.23 AND -84.17 THEN 'Alajuela Centro'
        ELSE 'Otra zona'
    END,
    r.zona_geografica, r.nombre;

-- ============================================================
--  Cubo 3: Pedidos completados vs cancelados
--  → Dashboard: "Estadísticas de pedidos completados vs cancelados"
--  → Análisis: tasa de cancelación por restaurante y tipo
-- ============================================================
CREATE OR REPLACE VIEW v_estado_pedidos AS
SELECT
    t.anio,
    t.mes,
    t.nombre_mes,
    r.nombre                                AS restaurante,
    r.zona_geografica,
    e.nombre                                AS estado,
    tp.nombre                               AS tipo_pedido,
    COUNT(DISTINCT f.id_pedido_origen)      AS total_pedidos,
    ROUND(SUM(f.precio_total_pedido), 2)    AS monto_total,
    ROUND(AVG(f.precio_total_pedido), 2)    AS ticket_promedio
FROM fact_pedido f
JOIN dim_tiempo         t   ON f.id_tiempo        = t.id
JOIN dim_restaurante    r   ON f.id_restaurante   = r.id
JOIN dim_estado_pedido  e   ON f.id_estado_pedido = e.id
JOIN dim_tipo_pedido    tp  ON f.id_tipo_pedido   = tp.id
GROUP BY
    t.anio, t.mes, t.nombre_mes,
    r.nombre, r.zona_geografica,
    e.nombre, tp.nombre;

-- ============================================================
--  Cubo 4: Horarios pico
--  → Análisis Spark: demanda por hora, día y restaurante
--  → Identifica franjas de mayor y menor actividad
-- ============================================================
CREATE OR REPLACE VIEW v_horarios_pico AS
SELECT
    t.hora,
    t.nombre_dia,
    t.dia_semana,
    t.es_fin_semana,
    t.es_hora_pico,
    t.anio,
    t.mes,
    r.nombre                                AS restaurante,
    r.zona_geografica,
    COUNT(DISTINCT f.id_pedido_origen)      AS total_pedidos,
    SUM(f.cantidad)                         AS unidades_vendidas,
    ROUND(SUM(f.subtotal), 2)               AS ingresos,
    COUNT(DISTINCT f.id_usuario)            AS clientes_unicos
FROM fact_pedido f
JOIN dim_tiempo         t   ON f.id_tiempo       = t.id
JOIN dim_restaurante    r   ON f.id_restaurante  = r.id
GROUP BY
    t.hora, t.nombre_dia, t.dia_semana,
    t.es_fin_semana, t.es_hora_pico,
    t.anio, t.mes,
    r.nombre, r.zona_geografica;

-- ============================================================
--  Cubo 5: Ocupación y frecuencia de uso de mesas
--  → Análisis: qué mesas se usan más, en qué horarios,
--    y cuál es la tasa de cancelación por restaurante
-- ============================================================
CREATE OR REPLACE VIEW v_ocupacion_mesas AS
SELECT
    t.anio,
    t.mes,
    t.nombre_mes,
    t.hora,
    t.nombre_dia,
    t.es_fin_semana,
    r.nombre                                AS restaurante,
    r.zona_geografica,
    fr.mesa_num,
    fr.estado,
    COUNT(*)                                AS total_reservaciones,
    SUM(CASE WHEN fr.estado = 'reservada'  THEN 1 ELSE 0 END) AS confirmadas,
    SUM(CASE WHEN fr.estado = 'cancelada'  THEN 1 ELSE 0 END) AS canceladas,
    ROUND(AVG(fr.cant_personas), 2)         AS promedio_personas,
    ROUND(AVG(fr.tasa_ocupacion), 2)        AS promedio_ocupacion_pct,
    ROUND(AVG(fr.duracion_minutos), 2)      AS duracion_promedio_min
FROM fact_reservacion fr
JOIN dim_tiempo         t   ON fr.id_tiempo       = t.id
JOIN dim_restaurante    r   ON fr.id_restaurante  = r.id
GROUP BY
    t.anio, t.mes, t.nombre_mes,
    t.hora, t.nombre_dia, t.es_fin_semana,
    r.nombre, r.zona_geografica,
    fr.mesa_num, fr.estado;
