-- ============================================================
--  DATA WAREHOUSE — Esquema Estrella en HiveQL
--  Proyecto: Reserva Inteligente de Restaurantes — Etapa 3
--  Motor: Apache Hive (ORC + particionado)
--  Base de datos Hive: restaurant_dw
-- ============================================================

CREATE DATABASE IF NOT EXISTS restaurant_dw
COMMENT 'Data Warehouse del sistema de reservas'
WITH DBPROPERTIES ('creator'='etapa3', 'version'='1.0');

USE restaurant_dw;

-- ============================================================
--  DIMENSIONES
--  En Hive las PKs y FKs son declarativas (no se enforzan).
--  El ETL (Airflow + Spark) garantiza la integridad.
-- ============================================================

-- ------------------------------------------------------------
--  dim_tiempo
--  Granularidad: hora exacta
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dim_tiempo (
    id              BIGINT      COMMENT 'Surrogate key',
    fecha           STRING      COMMENT 'Fecha en formato YYYY-MM-DD',
    anio            INT,
    trimestre       INT         COMMENT '1 a 4',
    mes             INT         COMMENT '1 a 12',
    semana_anio     INT         COMMENT 'Número de semana ISO',
    dia_mes         INT,
    dia_semana      INT         COMMENT '1=lunes, 7=domingo',
    nombre_dia      STRING,
    nombre_mes      STRING,
    hora            INT         COMMENT '0 a 23',
    es_fin_semana   BOOLEAN,
    es_hora_pico    BOOLEAN     COMMENT 'TRUE si hora entre 12-14 o 18-21'
)
COMMENT 'Dimensión de tiempo con granularidad horaria'
STORED AS ORC
TBLPROPERTIES ('orc.compress'='SNAPPY');

-- ------------------------------------------------------------
--  dim_restaurante
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dim_restaurante (
    id              BIGINT,
    id_origen       INT         COMMENT 'PK en el sistema OLTP',
    nombre          STRING,
    direccion       STRING,
    latitud         DOUBLE,
    longitud        DOUBLE,
    zona_geografica STRING      COMMENT 'Derivada por el ETL según coordenadas',
    activo          BOOLEAN,
    cargado_en      STRING      COMMENT 'Timestamp ISO de la carga'
)
COMMENT 'Dimensión de restaurantes'
STORED AS ORC
TBLPROPERTIES ('orc.compress'='SNAPPY');

-- ------------------------------------------------------------
--  dim_usuario
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dim_usuario (
    id              BIGINT,
    id_origen       INT,
    nombre          STRING,
    correo          STRING,
    rol             STRING      COMMENT 'admin | cliente',
    latitud         DOUBLE      COMMENT 'Última ubicación conocida',
    longitud        DOUBLE,
    zona_geografica STRING,
    cargado_en      STRING
)
COMMENT 'Dimensión de usuarios'
STORED AS ORC
TBLPROPERTIES ('orc.compress'='SNAPPY');

-- ------------------------------------------------------------
--  dim_plato
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dim_plato (
    id              BIGINT,
    id_origen       INT,
    nombre          STRING,
    descripcion     STRING      COMMENT 'Nunca NULL: usar Producto sin descripción',
    precio_unitario DOUBLE,
    categoria       STRING      COMMENT 'Nunca NULL: usar Sin categoría',
    id_menu_origen  INT,
    activo          BOOLEAN,
    cargado_en      STRING
)
COMMENT 'Dimensión de platos del menú'
STORED AS ORC
TBLPROPERTIES ('orc.compress'='SNAPPY');

-- ------------------------------------------------------------
--  dim_tipo_pedido
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dim_tipo_pedido (
    id      BIGINT,
    nombre  STRING      COMMENT 'comer aquí | para llevar'
)
COMMENT 'Dimensión de tipos de pedido'
STORED AS ORC
TBLPROPERTIES ('orc.compress'='SNAPPY');

-- ------------------------------------------------------------
--  dim_estado_pedido
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dim_estado_pedido (
    id      BIGINT,
    nombre  STRING      COMMENT 'completado | cancelado'
)
COMMENT 'Dimensión de estados de pedido'
STORED AS ORC
TBLPROPERTIES ('orc.compress'='SNAPPY');


-- ============================================================
--  TABLAS DE HECHOS
--  Particionadas por anio y mes para performance en Spark.
-- ============================================================

-- ------------------------------------------------------------
--  fact_pedido
--  Granularidad: una fila por plato dentro de un pedido.
--  Partición: anio / mes  (facilita queries de tendencias)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fact_pedido (
    id                  BIGINT      COMMENT 'Surrogate key',

    -- FKs a dimensiones
    id_tiempo           BIGINT,
    id_restaurante      BIGINT,
    id_usuario          BIGINT,
    id_plato            BIGINT,
    id_tipo_pedido      BIGINT,
    id_estado_pedido    BIGINT,

    -- Trazabilidad al OLTP
    id_pedido_origen    STRING,
    id_plato_origen     STRING,

    -- Métricas
    cantidad            INT,
    precio_unitario     DOUBLE,
    subtotal            DOUBLE,
    precio_total_pedido DOUBLE      COMMENT 'Total del pedido completo (desnormalizado)',

    -- Geolocalización de entrega
    latitud_entrega     DOUBLE,
    longitud_entrega    DOUBLE
)
COMMENT 'Hechos de pedidos — granularidad: plato x pedido'
PARTITIONED BY (anio INT, mes INT)
STORED AS ORC
TBLPROPERTIES (
    'orc.compress'='SNAPPY',
    'transactional'='false'
);

-- ------------------------------------------------------------
--  fact_reservacion
--  Granularidad: una fila por reservación
--  Partición: anio / mes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fact_reservacion (
    id                      BIGINT,

    id_tiempo               BIGINT,
    id_restaurante          BIGINT,
    id_usuario              BIGINT,

    id_reservacion_origen   INT,

    -- Métricas
    cant_personas           INT,
    duracion_minutos        INT,
    mesa_num                INT,
    capacidad_mesa          INT,
    tasa_ocupacion          DOUBLE      COMMENT 'cant_personas / capacidad * 100',
    estado                  STRING      COMMENT 'reservada | cancelada'
)
COMMENT 'Hechos de reservaciones — granularidad: reservación'
PARTITIONED BY (anio INT, mes INT)
STORED AS ORC
TBLPROPERTIES (
    'orc.compress'='SNAPPY',
    'transactional'='false'
);
