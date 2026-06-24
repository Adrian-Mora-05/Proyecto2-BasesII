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
from airflow.operators.bash import BashOperator
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
    if engine == "mongodb":
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
#  T5a/b/c: Spark — via SparkSubmitOperator
#  Los jobs corren en el cluster Spark, no en el contenedor
#  de Airflow (que no tiene Java).
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
    # Ejecutamos spark-submit dentro del contenedor spark-master
    # usando subprocess desde el scheduler de Airflow.
    # El socket de Docker debe estar montado en el scheduler.

    def _run_spark_job(job_name: str, **context):
        import subprocess
        cmd = [
            "docker", "exec", "spark-master",
            "/opt/spark/bin/spark-submit",
            "--master", "spark://spark-master:7077",
            "--conf", "spark.sql.warehouse.dir=/opt/hive/data/warehouse",
            "--conf", "spark.sql.shuffle.partitions=8",
            "--conf", "spark.hadoop.hive.metastore.uris=thrift://hive-metastore:9083",
            "--conf", "spark.sql.catalogImplementation=hive",
            "--conf", "spark.hadoop.javax.jdo.option.ConnectionURL=jdbc:postgresql://hive-metastore-db:5432/metastore",
            "--conf", "spark.hadoop.javax.jdo.option.ConnectionDriverName=org.postgresql.Driver",
            "--conf", "spark.hadoop.javax.jdo.option.ConnectionUserName=hive",
            "--conf", "spark.hadoop.javax.jdo.option.ConnectionPassword=hive",
            f"/opt/spark-jobs/{job_name}.py",
        ]
        logger.info(f"[Spark] Ejecutando: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        # Spark escribe INFO/WARN en stderr aunque tenga éxito.
        # Solo fallamos si el returncode es != 0.
        logger.info(f"[Spark] returncode: {result.returncode}")
        if result.stdout:
            logger.info(f"[Spark] stdout: {result.stdout[-2000:]}")
        if result.stderr:
            logger.info(f"[Spark] stderr: {result.stderr[-2000:]}")
        if result.returncode != 0:
            raise Exception(
                f"spark-submit falló para {job_name} "
                f"(returncode={result.returncode}): {result.stderr[-500:]}"
            )
        logger.info(f"[Spark] {job_name} completado OK")

    spark_tendencias = PythonOperator(
        task_id         = "spark_tendencias_consumo",
        python_callable = _run_spark_job,
        op_kwargs       = {"job_name": "tendencias_consumo"},
    )

    spark_pico = PythonOperator(
        task_id         = "spark_horarios_pico",
        python_callable = _run_spark_job,
        op_kwargs       = {"job_name": "horarios_pico"},
    )

    spark_crec = PythonOperator(
        task_id         = "spark_crecimiento_mensual",
        python_callable = _run_spark_job,
        op_kwargs       = {"job_name": "crecimiento_mensual"},
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