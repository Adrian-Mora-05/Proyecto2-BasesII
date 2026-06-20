# ============================================================
#  Spark Job: Tendencias de Consumo
#  Proyecto: Reserva Inteligente de Restaurantes — Etapa 3
#  Archivo: analytics/spark/jobs/tendencias_consumo.py
#
#  Análisis:
#    - Productos más vendidos por mes y categoría
#    - Ingresos por restaurante y categoría a lo largo del tiempo
#    - Top 5 platos por mes
#    - Categorías con mayor crecimiento
#
#  Ejecución manual:
#    spark-submit \
#      --master spark://spark-master:7077 \
#      --conf spark.sql.warehouse.dir=/opt/hive/data/warehouse \
#      tendencias_consumo.py
#
#  Salida: tabla Hive restaurant_dw.resultado_tendencias
# ============================================================

import os
import sys
import logging
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.window import Window

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tendencias_consumo")

HIVE_WAREHOUSE = os.environ.get("HIVE_WAREHOUSE_DIR", "/opt/hive/data/warehouse")
SPARK_MASTER   = os.environ.get("SPARK_MASTER_URL",   "spark://spark-master:7077")
OUTPUT_PATH    = os.environ.get("OUTPUT_PATH",         "/opt/spark-jobs/output")


def create_spark_session() -> SparkSession:
    return (
        SparkSession.builder
        .appName("tendencias_consumo")
        .master(SPARK_MASTER)
        .config("spark.sql.warehouse.dir", HIVE_WAREHOUSE)
        .config("spark.sql.adaptive.enabled", "true")
        .config("spark.sql.shuffle.partitions", "8")
        .config("spark.hadoop.hive.metastore.uris", "thrift://hive-metastore:9083")
        .config("spark.sql.catalogImplementation", "hive")
        .enableHiveSupport()
        .getOrCreate()
    )


def load_base_tables(spark: SparkSession):
    spark.sql("USE restaurant_dw")
    # fact_pedido comparte nombres de columna con varias dimensiones
    # (anio, mes, precio_unitario, etc). Seleccionamos explícitamente
    # solo las columnas de hechos + las FKs, evitando cualquier colisión.
    fact_pedido = spark.table("fact_pedido").select(
        "id_tiempo", "id_restaurante", "id_usuario", "id_plato",
        "id_tipo_pedido", "id_estado_pedido",
        "id_pedido_origen", "id_plato_origen",
        "cantidad",
        F.col("precio_unitario").alias("precio_unitario_venta"),
        "subtotal", "precio_total_pedido",
        "latitud_entrega", "longitud_entrega",
    )
    return {
        "fact_pedido":       fact_pedido,
        "dim_tiempo":        spark.table("dim_tiempo").withColumnRenamed("id", "id_tiempo"),
        "dim_plato":         spark.table("dim_plato").withColumnRenamed("id", "id_plato").withColumnRenamed("nombre", "nombre_plato"),
        "dim_restaurante":   spark.table("dim_restaurante").withColumnRenamed("id", "id_restaurante").withColumnRenamed("nombre", "nombre_restaurante"),
        "dim_estado_pedido": spark.table("dim_estado_pedido").withColumnRenamed("id", "id_estado_pedido").withColumnRenamed("nombre", "estado_nombre"),
        "dim_usuario":       spark.table("dim_usuario").withColumnRenamed("id", "id_usuario").withColumnRenamed("nombre", "nombre_usuario"),
        "dim_tipo_pedido":   spark.table("dim_tipo_pedido").withColumnRenamed("id", "id_tipo_pedido").withColumnRenamed("nombre", "tipo_nombre"),
    }


def analisis_ingresos_mes_categoria(tbls: dict):
    """
    Ingresos totales agrupados por año, mes y categoría.
    Incluye variación respecto al mes anterior (MoM).
    """
    logger.info("Calculando ingresos por mes y categoría...")

    df = (
        tbls["fact_pedido"]
        .join(tbls["dim_tiempo"],        "id_tiempo")
        .join(tbls["dim_plato"],          "id_plato")
        .join(tbls["dim_restaurante"],    "id_restaurante")
        .join(tbls["dim_estado_pedido"],  "id_estado_pedido")
        .filter(F.col("estado_nombre") == "completado")
        .groupBy(
            F.col("anio"),
            F.col("mes"),
            F.col("nombre_mes"),
            F.col("categoria"),
            F.col("nombre_restaurante").alias("restaurante"),
        )
        .agg(
            F.countDistinct(F.col("id_pedido_origen")).alias("total_pedidos"),
            F.sum("cantidad").alias("unidades_vendidas"),
            F.round(F.sum("subtotal"), 2).alias("ingresos"),
            F.round(F.avg("precio_unitario_venta"), 2).alias("precio_promedio"),
        )
    )

    # Variación MoM por categoría y restaurante
    w = Window.partitionBy("categoria", "restaurante").orderBy("anio", "mes")
    df = df.withColumn(
        "ingresos_mes_anterior", F.lag("ingresos", 1).over(w)
    ).withColumn(
        "variacion_mom_pct",
        F.when(
            F.col("ingresos_mes_anterior") > 0,
            F.round(
                (F.col("ingresos") - F.col("ingresos_mes_anterior"))
                * 100.0 / F.col("ingresos_mes_anterior"), 2
            )
        ).otherwise(F.lit(None))
    ).drop("ingresos_mes_anterior")

    return df


def analisis_top_platos_por_mes(tbls: dict):
    """
    Top 5 platos más vendidos (por unidades) en cada mes.
    """
    logger.info("Calculando top platos por mes...")

    df_base = (
        tbls["fact_pedido"]
        .join(tbls["dim_tiempo"],       "id_tiempo")
        .join(tbls["dim_plato"],         "id_plato")
        .join(tbls["dim_estado_pedido"], "id_estado_pedido")
        .filter(F.col("estado_nombre") == "completado")
        .groupBy(
            F.col("anio"),
            F.col("mes"),
            F.col("nombre_mes"),
            F.col("nombre_plato").alias("plato"),
            F.col("categoria"),
        )
        .agg(
            F.sum("cantidad").alias("unidades_vendidas"),
            F.round(F.sum("subtotal"), 2).alias("ingresos"),
        )
    )

    # Rankear dentro de cada mes
    w_rank = Window.partitionBy("anio", "mes").orderBy(F.desc("unidades_vendidas"))
    df_top = (
        df_base
        .withColumn("rank_mes", F.rank().over(w_rank))
        .filter(F.col("rank_mes") <= 5)
        .orderBy("anio", "mes", "rank_mes")
    )

    return df_top


def analisis_categorias_crecimiento(tbls: dict):
    """
    Categorías con mayor crecimiento acumulado en el período.
    Útil para decisiones de menú.
    """
    logger.info("Calculando crecimiento por categoría...")

    df = (
        tbls["fact_pedido"]
        .join(tbls["dim_tiempo"],        "id_tiempo")
        .join(tbls["dim_plato"],          "id_plato")
        .join(tbls["dim_estado_pedido"],  "id_estado_pedido")
        .filter(F.col("estado_nombre") == "completado")
        .groupBy(F.col("categoria"), F.col("anio"), F.col("mes"))
        .agg(
            F.round(F.sum("subtotal"), 2).alias("ingresos"),
            F.sum("cantidad").alias("unidades_vendidas"),
        )
    )

    w = Window.partitionBy("categoria").orderBy("anio", "mes")
    df = df.withColumn(
        "ingresos_anterior", F.lag("ingresos", 1).over(w)
    ).withColumn(
        "crecimiento_pct",
        F.when(
            F.col("ingresos_anterior") > 0,
            F.round(
                (F.col("ingresos") - F.col("ingresos_anterior"))
                * 100.0 / F.col("ingresos_anterior"), 2
            )
        ).otherwise(F.lit(None))
    ).drop("ingresos_anterior")

    return df


def save_results(spark: SparkSession, dfs: dict):
    """
    Guarda cada DataFrame como tabla Hive (consumida por Superset).
    Hace DROP explícito antes de crear para evitar el error
    LOCATION_ALREADY_EXISTS cuando la tabla ya existe de una
    corrida anterior.
    """
    for nombre, df in dfs.items():
        tabla_hive = f"restaurant_dw.{nombre}"
        logger.info(f"Guardando {tabla_hive} ...")
        spark.sql(f"DROP TABLE IF EXISTS {tabla_hive}")
        df.write.mode("overwrite").saveAsTable(tabla_hive)
        logger.info(f"  → {df.count()} filas guardadas.")


def main():
    spark = create_spark_session()
    logger.info(f"Spark session iniciada. Master: {SPARK_MASTER}")

    try:
        tbls = load_base_tables(spark)

        dfs = {
            "resultado_tendencias_mes_categoria": analisis_ingresos_mes_categoria(tbls),
            "resultado_top_platos_mes":           analisis_top_platos_por_mes(tbls),
            "resultado_categorias_crecimiento":   analisis_categorias_crecimiento(tbls),
        }

        save_results(spark, dfs)
        logger.info("✅ tendencias_consumo completado.")

    except Exception as e:
        logger.error(f"❌ Error en tendencias_consumo: {e}", exc_info=True)
        sys.exit(1)

    finally:
        spark.stop()


if __name__ == "__main__":
    main()