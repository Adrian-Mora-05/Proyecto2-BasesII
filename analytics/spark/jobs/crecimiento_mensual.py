# ============================================================
#  Spark Job: Crecimiento Mensual
#  Archivo: analytics/spark/jobs/crecimiento_mensual.py
# ============================================================

import os, sys, logging
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.window import Window

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("crecimiento_mensual")

HIVE_WAREHOUSE = os.environ.get("HIVE_WAREHOUSE_DIR", "/opt/hive/data/warehouse")
SPARK_MASTER   = os.environ.get("SPARK_MASTER_URL",   "spark://spark-master:7077")
OUTPUT_PATH    = os.environ.get("OUTPUT_PATH",         "/opt/spark-jobs/output")


def create_spark_session():
    return (
        SparkSession.builder
        .appName("crecimiento_mensual")
        .master(SPARK_MASTER)
        .config("spark.sql.warehouse.dir", HIVE_WAREHOUSE)
        .config("spark.sql.adaptive.enabled", "true")
        .config("spark.sql.shuffle.partitions", "8")
        .config("spark.hadoop.hive.metastore.uris", "thrift://hive-metastore:9083")
        .config("spark.sql.catalogImplementation", "hive")
        .enableHiveSupport()
        .getOrCreate()
    )


def load_base_tables(spark):
    spark.sql("USE restaurant_dw")
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
        "dim_restaurante":   spark.table("dim_restaurante")
                                  .withColumnRenamed("id", "id_restaurante")
                                  .withColumnRenamed("nombre", "nombre_restaurante"),
        "dim_estado_pedido": spark.table("dim_estado_pedido")
                                  .withColumnRenamed("id", "id_estado_pedido")
                                  .withColumnRenamed("nombre", "estado_nombre"),
        "dim_tipo_pedido":   spark.table("dim_tipo_pedido")
                                  .withColumnRenamed("id", "id_tipo_pedido")
                                  .withColumnRenamed("nombre", "tipo_nombre"),
    }


def _base_mensual(tbls):
    return (
        tbls["fact_pedido"]
        .join(tbls["dim_tiempo"],       "id_tiempo")
        .join(tbls["dim_restaurante"],   "id_restaurante")
        .join(tbls["dim_estado_pedido"], "id_estado_pedido")
        .filter(F.col("estado_nombre") == "completado")
        .groupBy("anio", "mes", "nombre_mes",
                 F.col("nombre_restaurante").alias("restaurante"))
        .agg(
            F.countDistinct("id_pedido_origen").alias("total_pedidos"),
            F.countDistinct("id_usuario").alias("clientes_unicos"),
            F.round(F.sum("precio_total_pedido"), 2).alias("ingresos_totales"),
            F.round(F.avg("precio_total_pedido"), 2).alias("ticket_promedio"),
        )
    )


def analisis_crecimiento_mom(tbls):
    logger.info("Calculando crecimiento MoM...")
    df = _base_mensual(tbls)
    w = Window.partitionBy("restaurante").orderBy("anio", "mes")
    return (
        df
        .withColumn("pedidos_ant",  F.lag("total_pedidos",    1).over(w))
        .withColumn("clientes_ant", F.lag("clientes_unicos",  1).over(w))
        .withColumn("ingresos_ant", F.lag("ingresos_totales", 1).over(w))
        .withColumn("crec_pedidos_pct",
            F.when(F.col("pedidos_ant") > 0,
                F.round((F.col("total_pedidos") - F.col("pedidos_ant")) * 100.0 / F.col("pedidos_ant"), 2)
            ).otherwise(F.lit(None)))
        .withColumn("crec_clientes_pct",
            F.when(F.col("clientes_ant") > 0,
                F.round((F.col("clientes_unicos") - F.col("clientes_ant")) * 100.0 / F.col("clientes_ant"), 2)
            ).otherwise(F.lit(None)))
        .withColumn("crec_ingresos_pct",
            F.when(F.col("ingresos_ant") > 0,
                F.round((F.col("ingresos_totales") - F.col("ingresos_ant")) * 100.0 / F.col("ingresos_ant"), 2)
            ).otherwise(F.lit(None)))
        .drop("pedidos_ant", "clientes_ant", "ingresos_ant")
        .orderBy("restaurante", "anio", "mes")
    )


def analisis_crecimiento_ytd(tbls):
    logger.info("Calculando crecimiento YTD...")
    df = _base_mensual(tbls)
    w_ytd  = Window.partitionBy("restaurante", "anio").orderBy("mes").rowsBetween(Window.unboundedPreceding, Window.currentRow)
    w_anio = Window.partitionBy("restaurante", "mes").orderBy("anio")
    return (
        df
        .withColumn("pedidos_ytd",  F.sum("total_pedidos").over(w_ytd))
        .withColumn("ingresos_ytd", F.round(F.sum("ingresos_totales").over(w_ytd), 2))
        .withColumn("pedidos_ytd_ant",  F.lag("pedidos_ytd",  1).over(w_anio))
        .withColumn("ingresos_ytd_ant", F.lag("ingresos_ytd", 1).over(w_anio))
        .withColumn("crec_pedidos_ytd_pct",
            F.when(F.col("pedidos_ytd_ant") > 0,
                F.round((F.col("pedidos_ytd") - F.col("pedidos_ytd_ant")) * 100.0 / F.col("pedidos_ytd_ant"), 2)
            ).otherwise(F.lit(None)))
        .withColumn("crec_ingresos_ytd_pct",
            F.when(F.col("ingresos_ytd_ant") > 0,
                F.round((F.col("ingresos_ytd") - F.col("ingresos_ytd_ant")) * 100.0 / F.col("ingresos_ytd_ant"), 2)
            ).otherwise(F.lit(None)))
        .drop("pedidos_ytd_ant", "ingresos_ytd_ant")
        .orderBy("restaurante", "anio", "mes")
    )


def analisis_tasa_cancelacion(tbls):
    logger.info("Calculando tasa de cancelación mensual...")
    df = (
        tbls["fact_pedido"]
        .join(tbls["dim_tiempo"],       "id_tiempo")
        .join(tbls["dim_restaurante"],   "id_restaurante")
        .join(tbls["dim_estado_pedido"], "id_estado_pedido")
        .groupBy("anio", "mes", "nombre_mes",
                 F.col("nombre_restaurante").alias("restaurante"),
                 F.col("estado_nombre").alias("estado"))
        .agg(F.countDistinct("id_pedido_origen").alias("total"))
    )
    return (
        df.groupBy("anio", "mes", "nombre_mes", "restaurante")
        .pivot("estado", ["completado", "cancelado"])
        .sum("total")
        .withColumnRenamed("completado", "completados")
        .withColumnRenamed("cancelado",  "cancelados")
        .fillna(0)
        .withColumn("total", F.col("completados") + F.col("cancelados"))
        .withColumn("tasa_cancelacion_pct",
            F.when(F.col("total") > 0,
                F.round(F.col("cancelados") * 100.0 / F.col("total"), 2)
            ).otherwise(F.lit(0.0)))
        .orderBy("restaurante", "anio", "mes")
    )


def analisis_crecimiento_tipo_pedido(tbls):
    logger.info("Calculando crecimiento por tipo de pedido...")
    df = (
        tbls["fact_pedido"]
        .join(tbls["dim_tiempo"],       "id_tiempo")
        .join(tbls["dim_restaurante"],   "id_restaurante")
        .join(tbls["dim_tipo_pedido"],   "id_tipo_pedido")
        .join(tbls["dim_estado_pedido"], "id_estado_pedido")
        .filter(F.col("estado_nombre") == "completado")
        .groupBy("anio", "mes", "nombre_mes",
                 F.col("nombre_restaurante").alias("restaurante"),
                 F.col("tipo_nombre").alias("tipo_pedido"))
        .agg(
            F.countDistinct("id_pedido_origen").alias("total_pedidos"),
            F.round(F.sum("precio_total_pedido"), 2).alias("ingresos"),
        )
    )
    w = Window.partitionBy("restaurante", "tipo_pedido").orderBy("anio", "mes")
    return (
        df.withColumn("pedidos_ant", F.lag("total_pedidos", 1).over(w))
        .withColumn("crecimiento_pct",
            F.when(F.col("pedidos_ant") > 0,
                F.round((F.col("total_pedidos") - F.col("pedidos_ant")) * 100.0 / F.col("pedidos_ant"), 2)
            ).otherwise(F.lit(None)))
        .drop("pedidos_ant")
        .orderBy("restaurante", "tipo_pedido", "anio", "mes")
    )


import shutil

HIVE_WAREHOUSE_PATH = os.environ.get("HIVE_WAREHOUSE_DIR", "/opt/hive/data/warehouse")


def _force_clean_table(spark, nombre):
    """Elimina metadata Y directorio físico para evitar LOCATION_ALREADY_EXISTS."""
    tabla_hive = f"restaurant_dw.{nombre}"
    spark.sql(f"DROP TABLE IF EXISTS {tabla_hive}")
    ruta_fisica = f"{HIVE_WAREHOUSE_PATH}/restaurant_dw.db/{nombre}"
    if os.path.exists(ruta_fisica):
        logger.info(f"Eliminando directorio huérfano: {ruta_fisica}")
        shutil.rmtree(ruta_fisica, ignore_errors=True)


def save_results(spark, dfs):
    for nombre, df in dfs.items():
        tabla_hive = f"restaurant_dw.{nombre}"
        logger.info(f"Guardando {tabla_hive} ...")
        _force_clean_table(spark, nombre)
        df.write.mode("overwrite").saveAsTable(tabla_hive)
        logger.info(f"  → {df.count()} filas guardadas.")


def main():
    spark = create_spark_session()
    logger.info(f"Spark session iniciada. Master: {SPARK_MASTER}")
    try:
        tbls = load_base_tables(spark)
        dfs = {
            "resultado_crecimiento_mensual":      analisis_crecimiento_mom(tbls),
            "resultado_crecimiento_ytd":          analisis_crecimiento_ytd(tbls),
            "resultado_tasa_cancelacion_mensual": analisis_tasa_cancelacion(tbls),
            "resultado_crecimiento_tipo_pedido":  analisis_crecimiento_tipo_pedido(tbls),
        }
        save_results(spark, dfs)
        logger.info("✅ crecimiento_mensual completado.")
    except Exception as e:
        logger.error(f"❌ Error en crecimiento_mensual: {e}", exc_info=True)
        sys.exit(1)
    finally:
        spark.stop()


if __name__ == "__main__":
    main()
