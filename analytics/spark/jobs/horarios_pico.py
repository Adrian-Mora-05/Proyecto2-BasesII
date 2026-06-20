# ============================================================
#  Spark Job: Horarios Pico
#  Archivo: analytics/spark/jobs/horarios_pico.py
# ============================================================

import os, sys, logging
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.window import Window

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("horarios_pico")

HIVE_WAREHOUSE = os.environ.get("HIVE_WAREHOUSE_DIR", "/opt/hive/data/warehouse")
SPARK_MASTER   = os.environ.get("SPARK_MASTER_URL",   "spark://spark-master:7077")
OUTPUT_PATH    = os.environ.get("OUTPUT_PATH",         "/opt/spark-jobs/output")


def create_spark_session():
    return (
        SparkSession.builder
        .appName("horarios_pico")
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
    fact_reservacion = spark.table("fact_reservacion").select(
        "id_tiempo", "id_restaurante", "id_usuario",
        "id_reservacion_origen", "cant_personas", "duracion_minutos",
        "mesa_num", "capacidad_mesa", "tasa_ocupacion", "estado",
    )
    return {
        "fact_pedido":       fact_pedido,
        "fact_reservacion":  fact_reservacion,
        "dim_tiempo":        spark.table("dim_tiempo").withColumnRenamed("id", "id_tiempo"),
        "dim_restaurante":   spark.table("dim_restaurante")
                                  .withColumnRenamed("id", "id_restaurante")
                                  .withColumnRenamed("nombre", "nombre_restaurante"),
        "dim_estado_pedido": spark.table("dim_estado_pedido")
                                  .withColumnRenamed("id", "id_estado_pedido")
                                  .withColumnRenamed("nombre", "estado_nombre"),
    }


def analisis_demanda_por_hora(tbls):
    logger.info("Calculando demanda por hora...")
    df = (
        tbls["fact_pedido"]
        .join(tbls["dim_tiempo"],      "id_tiempo")
        .join(tbls["dim_restaurante"],  "id_restaurante")
        .groupBy("hora", "es_hora_pico", "es_fin_semana",
                 F.col("nombre_restaurante").alias("restaurante"),
                 "zona_geografica")
        .agg(
            F.countDistinct("id_pedido_origen").alias("total_pedidos"),
            F.countDistinct("id_usuario").alias("clientes_unicos"),
            F.sum("cantidad").alias("unidades_vendidas"),
            F.round(F.sum("subtotal"), 2).alias("ingresos"),
            F.round(F.avg("precio_unitario_venta"), 2).alias("ticket_promedio"),
        )
    )
    w = Window.partitionBy("restaurante")
    return df.withColumn(
        "pct_pedidos_del_total",
        F.round(F.col("total_pedidos") * 100.0 / F.sum("total_pedidos").over(w), 2)
    ).orderBy("restaurante", "hora")


def analisis_pico_dia_semana(tbls):
    logger.info("Calculando pico por día de semana y hora...")
    df = (
        tbls["fact_pedido"]
        .join(tbls["dim_tiempo"],      "id_tiempo")
        .join(tbls["dim_restaurante"],  "id_restaurante")
        .groupBy("dia_semana", "nombre_dia", "hora", "es_fin_semana",
                 F.col("nombre_restaurante").alias("restaurante"))
        .agg(
            F.countDistinct("id_pedido_origen").alias("total_pedidos"),
            F.round(F.sum("subtotal"), 2).alias("ingresos"),
        )
    )
    w = Window.partitionBy("restaurante", "dia_semana").orderBy(F.desc("total_pedidos"))
    return df.withColumn("rank_hora_en_dia", F.rank().over(w)).orderBy("restaurante", "dia_semana", "hora")


def analisis_fin_semana_vs_semana(tbls):
    logger.info("Calculando comparativa fin de semana vs semana...")
    return (
        tbls["fact_pedido"]
        .join(tbls["dim_tiempo"],      "id_tiempo")
        .join(tbls["dim_restaurante"],  "id_restaurante")
        .withColumn("tipo_dia",
            F.when(F.col("es_fin_semana"), F.lit("Fin de semana"))
             .otherwise(F.lit("Día de semana")))
        .groupBy("tipo_dia", F.col("nombre_restaurante").alias("restaurante"), "hora")
        .agg(
            F.countDistinct("id_pedido_origen").alias("total_pedidos"),
            F.round(F.avg("subtotal"), 2).alias("ticket_promedio"),
            F.round(F.sum("subtotal"), 2).alias("ingresos_totales"),
        )
        .orderBy("restaurante", "tipo_dia", "hora")
    )


def analisis_ocupacion_mesas_horaria(tbls):
    logger.info("Calculando ocupación de mesas por hora...")
    fr = tbls["fact_reservacion"]
    dt = tbls["dim_tiempo"]
    dr = tbls["dim_restaurante"]
    return (
        fr
        .join(dt, fr["id_tiempo"]      == dt["id_tiempo"])
        .join(dr, fr["id_restaurante"] == dr["id_restaurante"])
        .filter(F.col("estado") == "reservada")
        .groupBy("hora", "es_fin_semana", F.col("nombre_restaurante").alias("restaurante"))
        .agg(
            F.count("*").alias("total_reservaciones"),
            F.round(F.avg("cant_personas"), 2).alias("personas_promedio"),
            F.round(F.avg("tasa_ocupacion"), 2).alias("ocupacion_promedio_pct"),
            F.round(F.avg("duracion_minutos"), 2).alias("duracion_promedio_min"),
        )
        .orderBy("restaurante", "hora")
    )


def save_results(spark, dfs):
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
            "resultado_demanda_por_hora":        analisis_demanda_por_hora(tbls),
            "resultado_pico_dia_semana":         analisis_pico_dia_semana(tbls),
            "resultado_fin_semana_vs_semana":    analisis_fin_semana_vs_semana(tbls),
            "resultado_ocupacion_mesas_horaria": analisis_ocupacion_mesas_horaria(tbls),
        }
        save_results(spark, dfs)
        logger.info("✅ horarios_pico completado.")
    except Exception as e:
        logger.error(f"❌ Error en horarios_pico: {e}", exc_info=True)
        sys.exit(1)
    finally:
        spark.stop()


if __name__ == "__main__":
    main()