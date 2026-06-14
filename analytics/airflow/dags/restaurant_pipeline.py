# ============================================================
#  DAG: restaurant_pipeline
#  Proyecto: Reserva Inteligente de Restaurantes — Etapa 3
#  Archivo: analytics/airflow/dags/restaurant_pipeline.py
#
#  Pipeline completo:
#    1. Extraer desde Postgres o Mongo (según DB_ENGINE)
#    2. Cargar dimensiones en Hive
#    3. Cargar hechos en Hive
#    4. Ejecutar jobs de Spark (tendencias, pico, crecimiento)
#    5. Reindexar ElasticSearch si cambiaron platos
#
#  Schedule: diario a las 2 AM
#  Catchup: False (no reprocesa días pasados al activar)
# ============================================================

from __future__ import annotations

import os
import sys
import json
import logging
from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.python import PythonOperator, BranchPythonOperator
from airflow.operators.empty import EmptyOperator
from airflow.utils.dates import days_ago

# Rutas montadas en el contenedor de Airflow
sys.path.insert(0, "/opt/airflow/etl")
sys.path.insert(0, "/opt/airflow/spark_jobs")

logger = logging.getLogger(__name__)

# ── Configuración ────────────────────────────────────────────
DB_ENGINE        = os.environ.get("DB_ENGINE", "postgres")
SPARK_MASTER_URL = os.environ.get("SPARK_MASTER_URL", "spark://spark-master:7077")
SEARCH_SERVICE   = os.environ.get("SEARCH_SERVICE_URL", "http://search-service:3001")

DEFAULT_ARGS = {
    "owner":            "etapa3",
    "depends_on_past":  False,
    "email_on_failure": False,
    "email_on_retry":   False,
    "retries":          2,
    "retry_delay":      timedelta(minutes=5),
}


# ============================================================
#  Funciones de cada tarea
# ============================================================

# ------------------------------------------------------------
#  T0: decidir qué extractor usar según DB_ENGINE
# ------------------------------------------------------------
def branch_engine(**context):
    """
    BranchPythonOperator: devuelve el task_id del extractor
    correcto según la variable de entorno DB_ENGINE.
    """
    engine = DB_ENGINE.strip().lower()
    logger.info(f"DB_ENGINE={engine}")
    if engine == "mongo":
        return "extract_mongo"
    return "extract_postgres"


# ------------------------------------------------------------
#  T1a: Extracción desde PostgreSQL
# ------------------------------------------------------------
def extract_from_postgres(**context):
    import etl_postgres as src

    # En la primera corrida "desde" es None (carga completa).
    # En corridas siguientes toma la fecha de la última ejecución exitosa.
    desde = context["data_interval_start"] if not context["dag_run"].external_trigger else None

    payload = {
        "tipos_pedido":    src.extract_tipos_pedido(),
        "estados_pedido":  src.extract_estados_pedido(),
        "restaurantes":    src.extract_restaurantes(),
        "usuarios":        src.extract_usuarios(),
        "platos":          src.extract_platos(),
        "pedidos":         src.extract_pedidos(desde=desde),
        "reservaciones":   src.extract_reservaciones(desde=desde),
    }

    # XCom — pasar datos a las tareas siguientes
    context["ti"].xcom_push(key="raw_data", value=json.dumps(payload, default=str))
    logger.info(
        f"[Postgres] Extraídos: "
        f"{len(payload['pedidos'])} pedidos, "
        f"{len(payload['reservaciones'])} reservaciones, "
        f"{len(payload['platos'])} platos."
    )


# ------------------------------------------------------------
#  T1b: Extracción desde MongoDB
# ------------------------------------------------------------
def extract_from_mongo(**context):
    import etl_mongo as src

    desde = context["data_interval_start"] if not context["dag_run"].external_trigger else None

    payload = {
        "tipos_pedido":    src.extract_tipos_pedido(),
        "estados_pedido":  src.extract_estados_pedido(),
        "restaurantes":    src.extract_restaurantes(),
        "usuarios":        src.extract_usuarios(),
        "platos":          src.extract_platos(),
        "pedidos":         src.extract_pedidos(desde=desde),
        "reservaciones":   src.extract_reservaciones(desde=desde),
    }

    context["ti"].xcom_push(key="raw_data", value=json.dumps(payload, default=str))
    logger.info(
        f"[Mongo] Extraídos: "
        f"{len(payload['pedidos'])} pedidos, "
        f"{len(payload['reservaciones'])} reservaciones, "
        f"{len(payload['platos'])} platos."
    )


# ------------------------------------------------------------
#  T2: Unificar XCom de cualquiera de los dos extractores
# ------------------------------------------------------------
def unify_extract(**context):
    """
    Recoge el XCom de whichever extractor corrió
    y lo re-publica bajo una clave estándar "unified_data".
    """
    ti = context["ti"]

    # Intentar obtener de postgres primero, luego mongo
    raw = ti.xcom_pull(task_ids="extract_postgres", key="raw_data")
    if raw is None:
        raw = ti.xcom_pull(task_ids="extract_mongo", key="raw_data")

    if raw is None:
        raise ValueError("No se recibieron datos de ningún extractor.")

    ti.xcom_push(key="unified_data", value=raw)
    data = json.loads(raw)
    logger.info(f"Datos unificados: {list(data.keys())}")


# ------------------------------------------------------------
#  T3: Cargar catálogos y dimensiones en Hive
# ------------------------------------------------------------
def load_dimensions(**context):
    import transform as t

    ti   = context["ti"]
    raw  = ti.xcom_pull(task_ids="unify_extract", key="unified_data")
    data = json.loads(raw)

    # Catálogos pequeños
    t.load_catalogos(data["tipos_pedido"], data["estados_pedido"])

    # Dimensiones principales — guardar los mapas de surrogate keys
    mapa_rest    = t.load_dim_restaurantes(data["restaurantes"])
    mapa_usuario = t.load_dim_usuarios(data["usuarios"])
    mapa_plato   = t.load_dim_platos(data["platos"])

    # dim_tiempo: recopilar todas las fechas de pedidos y reservaciones
    fechas = (
        [p["fecha_hora"] for p in data["pedidos"]      if p.get("fecha_hora")]
        + [r["fecha_hora"] for r in data["reservaciones"] if r.get("fecha_hora")]
    )
    mapa_tiempo = t.load_dim_tiempo(fechas)

    # Mapas de catálogos para los hechos
    mapa_tipo   = {tp["nombre"]: tp["id"] for tp in data["tipos_pedido"]}
    mapa_estado = {ep["nombre"]: ep["id"] for ep in data["estados_pedido"]}

    # Guardar todos los mapas en XCom para la tarea de hechos
    ti.xcom_push(key="mapas", value=json.dumps({
        "tiempo":    {str(k): v for k, v in mapa_tiempo.items()},
        "rest":      mapa_rest,
        "usuario":   mapa_usuario,
        "plato":     mapa_plato,
        "tipo":      mapa_tipo,
        "estado":    mapa_estado,
    }, default=str))

    logger.info("Dimensiones cargadas en Hive.")


# ------------------------------------------------------------
#  T4: Cargar hechos en Hive
# ------------------------------------------------------------
def load_facts(**context):
    import transform as t

    ti   = context["ti"]
    raw  = ti.xcom_pull(task_ids="unify_extract",  key="unified_data")
    maps = ti.xcom_pull(task_ids="load_dimensions", key="mapas")

    data  = json.loads(raw)
    mapas = json.loads(maps)

    # Reconstruir claves de dim_tiempo como tuplas
    mapa_tiempo = {
        tuple(k.split("|")) if "|" in k else tuple(eval(k)): v
        for k, v in mapas["tiempo"].items()
    }

    t.load_fact_pedidos(
        pedidos      = data["pedidos"],
        mapa_tiempo  = mapa_tiempo,
        mapa_rest    = mapas["rest"],
        mapa_usuario = mapas["usuario"],
        mapa_plato   = mapas["plato"],
        mapa_tipo    = mapas["tipo"],
        mapa_estado  = mapas["estado"],
    )

    t.load_fact_reservaciones(
        reservaciones = data["reservaciones"],
        mapa_tiempo   = mapa_tiempo,
        mapa_rest     = mapas["rest"],
        mapa_usuario  = mapas["usuario"],
    )

    logger.info("Hechos cargados en Hive.")


# ------------------------------------------------------------
#  T5a: Spark — Tendencias de consumo
# ------------------------------------------------------------
def run_spark_tendencias(**context):
    from pyspark.sql import SparkSession

    spark = SparkSession.builder \
        .appName("tendencias_consumo") \
        .master(SPARK_MASTER_URL) \
        .config("spark.sql.warehouse.dir", "/opt/hive/data/warehouse") \
        .enableHiveSupport() \
        .getOrCreate()

    try:
        spark.sql("USE restaurant_dw")

        df = spark.sql("""
            SELECT
                t.anio,
                t.mes,
                t.nombre_mes,
                p.categoria,
                r.nombre                            AS restaurante,
                SUM(f.cantidad)                     AS unidades_vendidas,
                ROUND(SUM(f.subtotal), 2)           AS ingresos,
                COUNT(DISTINCT f.id_pedido_origen)  AS total_pedidos,
                ROUND(AVG(f.precio_unitario), 2)    AS precio_promedio
            FROM fact_pedido f
            JOIN dim_tiempo         t ON f.id_tiempo        = t.id
            JOIN dim_plato          p ON f.id_plato         = p.id
            JOIN dim_restaurante    r ON f.id_restaurante   = r.id
            JOIN dim_estado_pedido  e ON f.id_estado_pedido = e.id
            WHERE e.nombre = 'completado'
            GROUP BY t.anio, t.mes, t.nombre_mes, p.categoria, r.nombre
            ORDER BY t.anio, t.mes, ingresos DESC
        """)

        # Guardar como tabla Hive para que Superset la consuma
        df.write.mode("overwrite").saveAsTable("restaurant_dw.resultado_tendencias")

        count = df.count()
        logger.info(f"[Spark] tendencias_consumo: {count} filas escritas.")

    finally:
        spark.stop()


# ------------------------------------------------------------
#  T5b: Spark — Horarios pico
# ------------------------------------------------------------
def run_spark_horarios_pico(**context):
    from pyspark.sql import SparkSession

    spark = SparkSession.builder \
        .appName("horarios_pico") \
        .master(SPARK_MASTER_URL) \
        .config("spark.sql.warehouse.dir", "/opt/hive/data/warehouse") \
        .enableHiveSupport() \
        .getOrCreate()

    try:
        spark.sql("USE restaurant_dw")

        df = spark.sql("""
            SELECT
                t.hora,
                t.nombre_dia,
                t.dia_semana,
                t.es_fin_semana,
                t.es_hora_pico,
                r.nombre                                AS restaurante,
                COUNT(DISTINCT f.id_pedido_origen)      AS total_pedidos,
                SUM(f.cantidad)                         AS unidades_vendidas,
                ROUND(SUM(f.subtotal), 2)               AS ingresos,
                COUNT(DISTINCT f.id_usuario)            AS clientes_unicos,
                ROUND(
                    COUNT(DISTINCT f.id_pedido_origen) * 100.0
                    / SUM(COUNT(DISTINCT f.id_pedido_origen)) OVER (
                        PARTITION BY r.nombre
                    ), 2
                )                                       AS pct_pedidos_restaurante
            FROM fact_pedido f
            JOIN dim_tiempo         t ON f.id_tiempo      = t.id
            JOIN dim_restaurante    r ON f.id_restaurante = r.id
            GROUP BY
                t.hora, t.nombre_dia, t.dia_semana,
                t.es_fin_semana, t.es_hora_pico, r.nombre
            ORDER BY total_pedidos DESC
        """)

        df.write.mode("overwrite").saveAsTable("restaurant_dw.resultado_horarios_pico")

        logger.info(f"[Spark] horarios_pico: {df.count()} filas escritas.")

    finally:
        spark.stop()


# ------------------------------------------------------------
#  T5c: Spark — Crecimiento mensual
# ------------------------------------------------------------
def run_spark_crecimiento(**context):
    from pyspark.sql import SparkSession
    from pyspark.sql import functions as F
    from pyspark.sql.window import Window

    spark = SparkSession.builder \
        .appName("crecimiento_mensual") \
        .master(SPARK_MASTER_URL) \
        .config("spark.sql.warehouse.dir", "/opt/hive/data/warehouse") \
        .enableHiveSupport() \
        .getOrCreate()

    try:
        spark.sql("USE restaurant_dw")

        # Agregado mensual base
        df_base = spark.sql("""
            SELECT
                t.anio,
                t.mes,
                r.nombre                                AS restaurante,
                COUNT(DISTINCT f.id_pedido_origen)      AS total_pedidos,
                COUNT(DISTINCT f.id_usuario)            AS clientes_unicos,
                ROUND(SUM(f.precio_total_pedido), 2)    AS ingresos_totales
            FROM fact_pedido f
            JOIN dim_tiempo         t ON f.id_tiempo      = t.id
            JOIN dim_restaurante    r ON f.id_restaurante = r.id
            JOIN dim_estado_pedido  e ON f.id_estado_pedido = e.id
            WHERE e.nombre = 'completado'
            GROUP BY t.anio, t.mes, r.nombre
        """)

        # Ventana para calcular mes anterior por restaurante
        w = Window.partitionBy("restaurante").orderBy("anio", "mes")

        df_crec = df_base \
            .withColumn("pedidos_mes_anterior",  F.lag("total_pedidos",   1).over(w)) \
            .withColumn("ingresos_mes_anterior", F.lag("ingresos_totales", 1).over(w)) \
            .withColumn("crecimiento_pedidos_pct",
                F.when(F.col("pedidos_mes_anterior") > 0,
                    F.round(
                        (F.col("total_pedidos") - F.col("pedidos_mes_anterior"))
                        * 100.0 / F.col("pedidos_mes_anterior"), 2
                    )
                ).otherwise(None)
            ) \
            .withColumn("crecimiento_ingresos_pct",
                F.when(F.col("ingresos_mes_anterior") > 0,
                    F.round(
                        (F.col("ingresos_totales") - F.col("ingresos_mes_anterior"))
                        * 100.0 / F.col("ingresos_mes_anterior"), 2
                    )
                ).otherwise(None)
            )

        df_crec.write.mode("overwrite").saveAsTable("restaurant_dw.resultado_crecimiento_mensual")

        logger.info(f"[Spark] crecimiento_mensual: {df_crec.count()} filas escritas.")

    finally:
        spark.stop()


# ------------------------------------------------------------
#  T6: Reindexar ElasticSearch si cambiaron platos
# ------------------------------------------------------------
def reindex_elasticsearch(**context):
    import requests

    ti       = context["ti"]
    raw      = ti.xcom_pull(task_ids="unify_extract", key="unified_data")
    data     = json.loads(raw)
    platos   = data.get("platos", [])

    if not platos:
        logger.info("No hay platos nuevos — se omite reindexado.")
        return

    try:
        resp = requests.post(
            f"{SEARCH_SERVICE}/search/reindex",
            json={"platos": platos},
            timeout=30,
        )
        resp.raise_for_status()
        logger.info(f"[ElasticSearch] Reindexado OK: {resp.json()}")
    except requests.exceptions.RequestException as e:
        # No falla el pipeline completo si el search service no está disponible
        logger.warning(f"[ElasticSearch] Reindexado falló (no crítico): {e}")


# ============================================================
#  Definición del DAG
# ============================================================

with DAG(
    dag_id          = "restaurant_pipeline",
    description     = "ETL diario: OLTP → Hive → Spark → ElasticSearch",
    default_args    = DEFAULT_ARGS,
    schedule_interval = "0 2 * * *",   # diario a las 2 AM
    start_date      = days_ago(1),
    catchup         = False,
    tags            = ["etapa3", "etl", "analytics"],
    max_active_runs = 1,
) as dag:

    # ── T0: Branch según motor ────────────────────────────────
    branch = BranchPythonOperator(
        task_id         = "branch_engine",
        python_callable = branch_engine,
    )

    # ── T1a / T1b: Extracción ────────────────────────────────
    extract_pg = PythonOperator(
        task_id         = "extract_postgres",
        python_callable = extract_from_postgres,
    )

    extract_mg = PythonOperator(
        task_id         = "extract_mongo",
        python_callable = extract_from_mongo,
    )

    # ── Punto de convergencia después del branch ─────────────
    join = EmptyOperator(
        task_id         = "join_extract",
        trigger_rule    = "none_failed_min_one_success",
    )

    # ── T2: Unificar XCom ────────────────────────────────────
    unify = PythonOperator(
        task_id         = "unify_extract",
        python_callable = unify_extract,
    )

    # ── T3: Dimensiones ──────────────────────────────────────
    dims = PythonOperator(
        task_id         = "load_dimensions",
        python_callable = load_dimensions,
    )

    # ── T4: Hechos ───────────────────────────────────────────
    facts = PythonOperator(
        task_id         = "load_facts",
        python_callable = load_facts,
    )

    # ── T5: Jobs de Spark (en paralelo) ──────────────────────
    spark_tendencias = PythonOperator(
        task_id         = "spark_tendencias_consumo",
        python_callable = run_spark_tendencias,
    )

    spark_pico = PythonOperator(
        task_id         = "spark_horarios_pico",
        python_callable = run_spark_horarios_pico,
    )

    spark_crec = PythonOperator(
        task_id         = "spark_crecimiento_mensual",
        python_callable = run_spark_crecimiento,
    )

    # ── T6: Reindexar ElasticSearch ──────────────────────────
    reindex = PythonOperator(
        task_id         = "reindex_elasticsearch",
        python_callable = reindex_elasticsearch,
        trigger_rule    = "all_done",   # corre aunque Spark falle
    )

    # ── Fin ──────────────────────────────────────────────────
    end = EmptyOperator(task_id="end")

    # ============================================================
    #  Dependencias
    #
    #  branch ──┬── extract_postgres ──┐
    #            └── extract_mongo    ──┴── join ── unify ── dims ── facts ──┬── spark_tendencias ──┐
    #                                                                          ├── spark_pico        ──┼── reindex ── end
    #                                                                          └── spark_crecimiento ──┘
    # ============================================================

    branch >> [extract_pg, extract_mg] >> join >> unify >> dims >> facts
    facts  >> [spark_tendencias, spark_pico, spark_crec] >> reindex >> end