# ============================================================
#  Spark Job: Crecimiento Mensual
#  Proyecto: Reserva Inteligente de Restaurantes — Etapa 3
#  Archivo: analytics/spark/jobs/crecimiento_mensual.py
#
#  Análisis:
#    - Crecimiento MoM de pedidos e ingresos por restaurante
#    - Crecimiento de clientes únicos (retención vs adquisición)
#    - Crecimiento acumulado YTD (year-to-date)
#    - Tasa de cancelación mensual
#
#  Ejecución manual:
#    spark-submit \
#      --master spark://spark-master:7077 \
#      --conf spark.sql.warehouse.dir=/opt/hive/data/warehouse \
#      crecimiento_mensual.py
#
#  Salida: tabla Hive restaurant_dw.resultado_crecimiento_mensual
# ============================================================

import os
import sys
import logging
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.window import Window

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("crecimiento_mensual")

HIVE_WAREHOUSE = os.environ.get("HIVE_WAREHOUSE_DIR", "/opt/hive/data/warehouse")
SPARK_MASTER   = os.environ.get("SPARK_MASTER_URL",   "spark://spark-master:7077")
OUTPUT_PATH    = os.environ.get("OUTPUT_PATH",         "/opt/spark-jobs/output")


def create_spark_session() -> SparkSession:
    return (
        SparkSession.builder
        .appName("crecimiento_mensual")
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
        "dim_tiempo":        spark.table("dim_tiempo"),
        "dim_restaurante":   spark.table("dim_restaurante"),
        "dim_estado_pedido": spark.table("dim_estado_pedido"),
        "dim_tipo_pedido":   spark.table("dim_tipo_pedido"),
    }


def analisis_crecimiento_mom(tbls: dict):
    """
    Crecimiento mes a mes (MoM) de pedidos, ingresos y clientes únicos
    por restaurante. Incluye valores absolutos y porcentaje de variación.
    """
    logger.info("Calculando crecimiento MoM...")

    # Agregado mensual base — solo pedidos completados
    df_base = (
        tbls["fact_pedido"]
        .join(tbls["dim_tiempo"],        "id_tiempo")
        .join(tbls["dim_restaurante"],    tbls["fact_pedido"]["id_restaurante"] == tbls["dim_restaurante"]["id"])
        .join(tbls["dim_estado_pedido"],  tbls["fact_pedido"]["id_estado_pedido"] == tbls["dim_estado_pedido"]["id"])
        .filter(F.col("dim_estado_pedido.nombre") == "completado")
        .groupBy(
            tbls["dim_tiempo"]["anio"],
            tbls["dim_tiempo"]["mes"],
            tbls["dim_tiempo"]["nombre_mes"],
            tbls["dim_restaurante"]["nombre"].alias("restaurante"),
        )
        .agg(
            F.countDistinct(tbls["fact_pedido"]["id_pedido_origen"]).alias("total_pedidos"),
            F.countDistinct(tbls["fact_pedido"]["id_usuario"]).alias("clientes_unicos"),
            F.round(F.sum("precio_total_pedido"), 2).alias("ingresos_totales"),
            F.round(F.avg("precio_total_pedido"), 2).alias("ticket_promedio"),
        )
    )

    # Ventana por restaurante ordenada cronológicamente
    w = Window.partitionBy("restaurante").orderBy("anio", "mes")

    df_mom = (
        df_base
        # Valores del mes anterior
        .withColumn("pedidos_mes_anterior",   F.lag("total_pedidos",    1).over(w))
        .withColumn("clientes_mes_anterior",  F.lag("clientes_unicos",  1).over(w))
        .withColumn("ingresos_mes_anterior",  F.lag("ingresos_totales", 1).over(w))

        # Variaciones absolutas
        .withColumn("delta_pedidos",
            F.col("total_pedidos") - F.col("pedidos_mes_anterior"))
        .withColumn("delta_clientes",
            F.col("clientes_unicos") - F.col("clientes_mes_anterior"))
        .withColumn("delta_ingresos",
            F.round(F.col("ingresos_totales") - F.col("ingresos_mes_anterior"), 2))

        # Tasas de crecimiento porcentual
        .withColumn("crecimiento_pedidos_pct",
            F.when(F.col("pedidos_mes_anterior") > 0,
                F.round(F.col("delta_pedidos") * 100.0
                        / F.col("pedidos_mes_anterior"), 2)
            ).otherwise(F.lit(None)))
        .withColumn("crecimiento_clientes_pct",
            F.when(F.col("clientes_mes_anterior") > 0,
                F.round(F.col("delta_clientes") * 100.0
                        / F.col("clientes_mes_anterior"), 2)
            ).otherwise(F.lit(None)))
        .withColumn("crecimiento_ingresos_pct",
            F.when(F.col("ingresos_mes_anterior") > 0,
                F.round(F.col("delta_ingresos") * 100.0
                        / F.col("ingresos_mes_anterior"), 2)
            ).otherwise(F.lit(None)))

        .drop("pedidos_mes_anterior", "clientes_mes_anterior", "ingresos_mes_anterior")
        .orderBy("restaurante", "anio", "mes")
    )

    return df_mom


def analisis_crecimiento_ytd(tbls: dict):
    """
    Crecimiento acumulado año a la fecha (YTD).
    Compara el acumulado de cada año vs el mismo período del año anterior.
    """
    logger.info("Calculando crecimiento YTD...")

    df_mensual = (
        tbls["fact_pedido"]
        .join(tbls["dim_tiempo"],        "id_tiempo")
        .join(tbls["dim_restaurante"],    tbls["fact_pedido"]["id_restaurante"] == tbls["dim_restaurante"]["id"])
        .join(tbls["dim_estado_pedido"],  tbls["fact_pedido"]["id_estado_pedido"] == tbls["dim_estado_pedido"]["id"])
        .filter(F.col("dim_estado_pedido.nombre") == "completado")
        .groupBy(
            tbls["dim_tiempo"]["anio"],
            tbls["dim_tiempo"]["mes"],
            tbls["dim_restaurante"]["nombre"].alias("restaurante"),
        )
        .agg(
            F.countDistinct(tbls["fact_pedido"]["id_pedido_origen"]).alias("pedidos_mes"),
            F.round(F.sum("precio_total_pedido"), 2).alias("ingresos_mes"),
        )
    )

    # Acumulado por año y restaurante (suma rolling dentro del año)
    w_ytd = Window.partitionBy("restaurante", "anio").orderBy("mes") \
                  .rowsBetween(Window.unboundedPreceding, Window.currentRow)

    df_ytd = (
        df_mensual
        .withColumn("pedidos_ytd",  F.sum("pedidos_mes").over(w_ytd))
        .withColumn("ingresos_ytd", F.round(F.sum("ingresos_mes").over(w_ytd), 2))
    )

    # Comparar con el mismo mes del año anterior
    w_anio = Window.partitionBy("restaurante", "mes").orderBy("anio")
    df_ytd = (
        df_ytd
        .withColumn("pedidos_ytd_anio_ant",  F.lag("pedidos_ytd",  1).over(w_anio))
        .withColumn("ingresos_ytd_anio_ant", F.lag("ingresos_ytd", 1).over(w_anio))
        .withColumn("crecimiento_pedidos_ytd_pct",
            F.when(F.col("pedidos_ytd_anio_ant") > 0,
                F.round((F.col("pedidos_ytd") - F.col("pedidos_ytd_anio_ant"))
                        * 100.0 / F.col("pedidos_ytd_anio_ant"), 2)
            ).otherwise(F.lit(None)))
        .withColumn("crecimiento_ingresos_ytd_pct",
            F.when(F.col("ingresos_ytd_anio_ant") > 0,
                F.round((F.col("ingresos_ytd") - F.col("ingresos_ytd_anio_ant"))
                        * 100.0 / F.col("ingresos_ytd_anio_ant"), 2)
            ).otherwise(F.lit(None)))
        .drop("pedidos_ytd_anio_ant", "ingresos_ytd_anio_ant")
        .orderBy("restaurante", "anio", "mes")
    )

    return df_ytd


def analisis_tasa_cancelacion_mensual(tbls: dict):
    """
    Tasa de cancelación de pedidos y reservaciones por mes.
    Cancelaciones altas pueden indicar problemas operativos.
    """
    logger.info("Calculando tasa de cancelación mensual...")

    # Pedidos
    df_pedidos = (
        tbls["fact_pedido"]
        .join(tbls["dim_tiempo"],        "id_tiempo")
        .join(tbls["dim_restaurante"],    tbls["fact_pedido"]["id_restaurante"] == tbls["dim_restaurante"]["id"])
        .join(tbls["dim_estado_pedido"],  tbls["fact_pedido"]["id_estado_pedido"] == tbls["dim_estado_pedido"]["id"])
        .groupBy(
            tbls["dim_tiempo"]["anio"],
            tbls["dim_tiempo"]["mes"],
            tbls["dim_tiempo"]["nombre_mes"],
            tbls["dim_restaurante"]["nombre"].alias("restaurante"),
            tbls["dim_estado_pedido"]["nombre"].alias("estado"),
        )
        .agg(
            F.countDistinct(tbls["fact_pedido"]["id_pedido_origen"]).alias("total_pedidos"),
        )
    )

    # Pivot para tener completados y cancelados como columnas
    df_pivot = (
        df_pedidos
        .groupBy("anio", "mes", "nombre_mes", "restaurante")
        .pivot("estado", ["completado", "cancelado"])
        .sum("total_pedidos")
        .withColumnRenamed("completado", "pedidos_completados")
        .withColumnRenamed("cancelado",  "pedidos_cancelados")
        .fillna(0, subset=["pedidos_completados", "pedidos_cancelados"])
    )

    df_pivot = df_pivot.withColumn(
        "total_pedidos",
        F.col("pedidos_completados") + F.col("pedidos_cancelados")
    ).withColumn(
        "tasa_cancelacion_pct",
        F.when(F.col("total_pedidos") > 0,
            F.round(F.col("pedidos_cancelados") * 100.0 / F.col("total_pedidos"), 2)
        ).otherwise(F.lit(0.0))
    ).orderBy("restaurante", "anio", "mes")

    return df_pivot


def analisis_crecimiento_por_tipo_pedido(tbls: dict):
    """
    Crecimiento mensual separado por tipo de pedido
    (comer aquí vs para llevar).
    Permite ver si el delivery está creciendo más que el presencial.
    """
    logger.info("Calculando crecimiento por tipo de pedido...")

    df = (
        tbls["fact_pedido"]
        .join(tbls["dim_tiempo"],        "id_tiempo")
        .join(tbls["dim_restaurante"],    tbls["fact_pedido"]["id_restaurante"] == tbls["dim_restaurante"]["id"])
        .join(tbls["dim_tipo_pedido"],    tbls["fact_pedido"]["id_tipo_pedido"] == tbls["dim_tipo_pedido"]["id"])
        .join(tbls["dim_estado_pedido"],  tbls["fact_pedido"]["id_estado_pedido"] == tbls["dim_estado_pedido"]["id"])
        .filter(F.col("dim_estado_pedido.nombre") == "completado")
        .groupBy(
            tbls["dim_tiempo"]["anio"],
            tbls["dim_tiempo"]["mes"],
            tbls["dim_tiempo"]["nombre_mes"],
            tbls["dim_restaurante"]["nombre"].alias("restaurante"),
            tbls["dim_tipo_pedido"]["nombre"].alias("tipo_pedido"),
        )
        .agg(
            F.countDistinct(tbls["fact_pedido"]["id_pedido_origen"]).alias("total_pedidos"),
            F.round(F.sum("precio_total_pedido"), 2).alias("ingresos"),
        )
    )

    w = Window.partitionBy("restaurante", "tipo_pedido").orderBy("anio", "mes")
    df = (
        df
        .withColumn("pedidos_mes_anterior", F.lag("total_pedidos", 1).over(w))
        .withColumn("crecimiento_pct",
            F.when(F.col("pedidos_mes_anterior") > 0,
                F.round((F.col("total_pedidos") - F.col("pedidos_mes_anterior"))
                        * 100.0 / F.col("pedidos_mes_anterior"), 2)
            ).otherwise(F.lit(None)))
        .drop("pedidos_mes_anterior")
        .orderBy("restaurante", "tipo_pedido", "anio", "mes")
    )

    return df


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
            "resultado_crecimiento_mensual":       analisis_crecimiento_mom(tbls),
            "resultado_crecimiento_ytd":           analisis_crecimiento_ytd(tbls),
            "resultado_tasa_cancelacion_mensual":  analisis_tasa_cancelacion_mensual(tbls),
            "resultado_crecimiento_tipo_pedido":   analisis_crecimiento_por_tipo_pedido(tbls),
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