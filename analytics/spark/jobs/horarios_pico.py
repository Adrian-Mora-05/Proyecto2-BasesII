# ============================================================
#  Spark Job: Horarios Pico
#  Proyecto: Reserva Inteligente de Restaurantes — Etapa 3
#  Archivo: analytics/spark/jobs/horarios_pico.py
#
#  Análisis:
#    - Distribución de pedidos por hora del día
#    - Horas pico vs horas valle por restaurante
#    - Comparativa fin de semana vs días de semana
#    - Ocupación de mesas por franja horaria
#
#  Ejecución manual:
#    spark-submit \
#      --master spark://spark-master:7077 \
#      --conf spark.sql.warehouse.dir=/opt/hive/data/warehouse \
#      horarios_pico.py
#
#  Salida: tabla Hive restaurant_dw.resultado_horarios_pico
# ============================================================

import os
import sys
import logging
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.window import Window

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("horarios_pico")

HIVE_WAREHOUSE = os.environ.get("HIVE_WAREHOUSE_DIR", "/opt/hive/data/warehouse")
SPARK_MASTER   = os.environ.get("SPARK_MASTER_URL",   "spark://spark-master:7077")
OUTPUT_PATH    = os.environ.get("OUTPUT_PATH",         "/opt/spark-jobs/output")


def create_spark_session() -> SparkSession:
    return (
        SparkSession.builder
        .appName("horarios_pico")
        .master(SPARK_MASTER)
        .config("spark.sql.warehouse.dir", HIVE_WAREHOUSE)
        .config("spark.sql.adaptive.enabled", "true")
        .config("spark.sql.shuffle.partitions", "8")
        .enableHiveSupport()
        .getOrCreate()
    )


def load_base_tables(spark: SparkSession):
    spark.sql("USE restaurant_dw")
    return {
        "fact_pedido":       spark.table("fact_pedido"),
        "fact_reservacion":  spark.table("fact_reservacion"),
        "dim_tiempo":        spark.table("dim_tiempo"),
        "dim_restaurante":   spark.table("dim_restaurante"),
        "dim_estado_pedido": spark.table("dim_estado_pedido"),
    }


def analisis_demanda_por_hora(tbls: dict):
    """
    Pedidos y ingresos agrupados por hora del día y restaurante.
    Incluye porcentaje del total diario para identificar picos.
    """
    logger.info("Calculando demanda por hora...")

    df = (
        tbls["fact_pedido"]
        .join(tbls["dim_tiempo"],       "id_tiempo")
        .join(tbls["dim_restaurante"],   tbls["fact_pedido"]["id_restaurante"] == tbls["dim_restaurante"]["id"])
        .groupBy(
            tbls["dim_tiempo"]["hora"],
            tbls["dim_tiempo"]["es_hora_pico"],
            tbls["dim_tiempo"]["es_fin_semana"],
            tbls["dim_restaurante"]["nombre"].alias("restaurante"),
            tbls["dim_restaurante"]["zona_geografica"],
        )
        .agg(
            F.countDistinct(tbls["fact_pedido"]["id_pedido_origen"]).alias("total_pedidos"),
            F.countDistinct(tbls["fact_pedido"]["id_usuario"]).alias("clientes_unicos"),
            F.sum("cantidad").alias("unidades_vendidas"),
            F.round(F.sum("subtotal"), 2).alias("ingresos"),
            F.round(F.avg("precio_unitario"), 2).alias("ticket_promedio"),
        )
    )

    # Porcentaje del total por restaurante
    w_rest = Window.partitionBy("restaurante")
    df = df.withColumn(
        "pct_pedidos_del_total",
        F.round(
            F.col("total_pedidos") * 100.0
            / F.sum("total_pedidos").over(w_rest), 2
        )
    ).orderBy("restaurante", "hora")

    return df


def analisis_pico_dia_semana(tbls: dict):
    """
    Cruce de hora del día × día de la semana.
    Permite identificar si el pico del viernes a las 8pm
    es distinto al del martes a las 8pm.
    """
    logger.info("Calculando pico por día de semana y hora...")

    df = (
        tbls["fact_pedido"]
        .join(tbls["dim_tiempo"],      "id_tiempo")
        .join(tbls["dim_restaurante"],  tbls["fact_pedido"]["id_restaurante"] == tbls["dim_restaurante"]["id"])
        .groupBy(
            tbls["dim_tiempo"]["dia_semana"],
            tbls["dim_tiempo"]["nombre_dia"],
            tbls["dim_tiempo"]["hora"],
            tbls["dim_tiempo"]["es_fin_semana"],
            tbls["dim_restaurante"]["nombre"].alias("restaurante"),
        )
        .agg(
            F.countDistinct(tbls["fact_pedido"]["id_pedido_origen"]).alias("total_pedidos"),
            F.round(F.sum("subtotal"), 2).alias("ingresos"),
        )
    )

    # Rank de hora más activa por día y restaurante
    w_rank = Window.partitionBy("restaurante", "dia_semana").orderBy(F.desc("total_pedidos"))
    df = df.withColumn("rank_hora_en_dia", F.rank().over(w_rank))

    return df.orderBy("restaurante", "dia_semana", "hora")


def analisis_fin_semana_vs_semana(tbls: dict):
    """
    Comparativa agregada: fin de semana vs días de semana.
    Promedio de pedidos e ingresos por día tipo.
    """
    logger.info("Calculando comparativa fin de semana vs semana...")

    df = (
        tbls["fact_pedido"]
        .join(tbls["dim_tiempo"],      "id_tiempo")
        .join(tbls["dim_restaurante"],  tbls["fact_pedido"]["id_restaurante"] == tbls["dim_restaurante"]["id"])
        .withColumn(
            "tipo_dia",
            F.when(F.col("es_fin_semana"), F.lit("Fin de semana"))
             .otherwise(F.lit("Día de semana"))
        )
        .groupBy(
            "tipo_dia",
            tbls["dim_restaurante"]["nombre"].alias("restaurante"),
            tbls["dim_tiempo"]["hora"],
        )
        .agg(
            F.countDistinct(tbls["fact_pedido"]["id_pedido_origen"]).alias("total_pedidos"),
            F.round(F.avg("subtotal"), 2).alias("ticket_promedio"),
            F.round(F.sum("subtotal"), 2).alias("ingresos_totales"),
        )
    )

    return df.orderBy("restaurante", "tipo_dia", "hora")


def analisis_ocupacion_mesas_horaria(tbls: dict):
    """
    Tasa de ocupación de mesas por franja horaria.
    Cruza fact_reservacion con dim_tiempo.
    """
    logger.info("Calculando ocupación de mesas por hora...")

    df = (
        tbls["fact_reservacion"]
        .join(tbls["dim_tiempo"],       tbls["fact_reservacion"]["id_tiempo"] == tbls["dim_tiempo"]["id"])
        .join(tbls["dim_restaurante"],   tbls["fact_reservacion"]["id_restaurante"] == tbls["dim_restaurante"]["id"])
        .filter(F.col("estado") == "reservada")
        .groupBy(
            tbls["dim_tiempo"]["hora"],
            tbls["dim_tiempo"]["es_fin_semana"],
            tbls["dim_restaurante"]["nombre"].alias("restaurante"),
        )
        .agg(
            F.count("*").alias("total_reservaciones"),
            F.round(F.avg("cant_personas"), 2).alias("personas_promedio"),
            F.round(F.avg("tasa_ocupacion"), 2).alias("ocupacion_promedio_pct"),
            F.round(F.avg("duracion_minutos"), 2).alias("duracion_promedio_min"),
        )
    )

    return df.orderBy("restaurante", "hora")


def save_results(spark: SparkSession, dfs: dict):
    os.makedirs(OUTPUT_PATH, exist_ok=True)

    for nombre, df in dfs.items():
        tabla_hive = f"restaurant_dw.{nombre}"
        ruta_csv   = f"{OUTPUT_PATH}/{nombre}"

        logger.info(f"Guardando {tabla_hive} ...")
        df.write.mode("overwrite").saveAsTable(tabla_hive)
        df.coalesce(1).write.mode("overwrite").option("header", "true").csv(ruta_csv)
        logger.info(f"  → {df.count()} filas guardadas.")


def main():
    spark = create_spark_session()
    logger.info(f"Spark session iniciada. Master: {SPARK_MASTER}")

    try:
        tbls = load_base_tables(spark)

        dfs = {
            "resultado_demanda_por_hora":       analisis_demanda_por_hora(tbls),
            "resultado_pico_dia_semana":        analisis_pico_dia_semana(tbls),
            "resultado_fin_semana_vs_semana":   analisis_fin_semana_vs_semana(tbls),
            "resultado_ocupacion_mesas_horaria":analisis_ocupacion_mesas_horaria(tbls),
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