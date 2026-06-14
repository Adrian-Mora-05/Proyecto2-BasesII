# ============================================================
#  ETL — Extracción desde PostgreSQL
#  Proyecto: Reserva Inteligente de Restaurantes — Etapa 3
#  Archivo: analytics/hive/etl/etl_postgres.py
#
#  Responsabilidad: extraer datos del OLTP PostgreSQL y
#  devolverlos como listas de dicts normalizados, listos
#  para pasar a transform.py (capa común).
#
#  NO contiene lógica de negocio ni carga a Hive.
#  Es invocado por el DAG de Airflow cuando DB_ENGINE=postgres.
# ============================================================

import os
import logging
from datetime import datetime
from contextlib import contextmanager

import psycopg2
import psycopg2.extras

logger = logging.getLogger(__name__)


# ------------------------------------------------------------
#  Conexión
# ------------------------------------------------------------

def _get_conn():
    """Crea y devuelve una conexión a PostgreSQL usando variables de entorno."""
    return psycopg2.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ.get("DB_PORT", 5432)),
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        database=os.environ["DB_NAME"],
        options="-c search_path=restaurant",
    )


@contextmanager
def _cursor():
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ------------------------------------------------------------
#  Extracción de catálogos (dimensiones pequeñas)
# ------------------------------------------------------------

def extract_tipos_pedido() -> list[dict]:
    """
    Devuelve lista de tipos de pedido.
    Ejemplo: [{'id': 1, 'nombre': 'comer aquí'}, ...]
    """
    with _cursor() as cur:
        cur.execute("SELECT id, nombre FROM tipo_pedido;")
        return [dict(r) for r in cur.fetchall()]


def extract_estados_pedido() -> list[dict]:
    with _cursor() as cur:
        cur.execute("SELECT id, nombre FROM estado_pedido;")
        return [dict(r) for r in cur.fetchall()]


# ------------------------------------------------------------
#  Extracción de dimensiones principales
# ------------------------------------------------------------

def extract_restaurantes() -> list[dict]:
    """
    Devuelve restaurantes con coordenadas.
    Schema de salida:
      id_origen, nombre, direccion, latitud, longitud
    """
    with _cursor() as cur:
        cur.execute("""
            SELECT
                id          AS id_origen,
                nombre,
                direccion,
                CAST(latitud  AS FLOAT) AS latitud,
                CAST(longitud AS FLOAT) AS longitud
            FROM restaurante;
        """)
        return [dict(r) for r in cur.fetchall()]


def extract_usuarios() -> list[dict]:
    """
    Schema de salida:
      id_origen, nombre, correo, rol
    """
    with _cursor() as cur:
        cur.execute("""
            SELECT
                u.id            AS id_origen,
                u.nombre,
                u.correo,
                ru.nombre       AS rol
            FROM usuario u
            JOIN rol_usuario ru ON u.id_rol_usuario = ru.id;
        """)
        return [dict(r) for r in cur.fetchall()]


def extract_platos() -> list[dict]:
    """
    Schema de salida:
      id_origen, nombre, descripcion, precio_unitario, categoria, id_menu_origen
    Aplica fallbacks: descripcion y categoria nunca son NULL.
    """
    with _cursor() as cur:
        cur.execute("""
            SELECT
                p.id                                            AS id_origen,
                p.nombre,
                COALESCE(p.descripcion, 'Producto sin descripción') AS descripcion,
                CAST(p.precio AS FLOAT)                         AS precio_unitario,
                COALESCE(c.nombre, 'Sin categoría')             AS categoria,
                p.id_menu                                       AS id_menu_origen
            FROM plato p
            LEFT JOIN categoria_plato c ON p.id_categoria = c.id;
        """)
        return [dict(r) for r in cur.fetchall()]


# ------------------------------------------------------------
#  Extracción de hechos
# ------------------------------------------------------------

def extract_pedidos(desde: datetime | None = None) -> list[dict]:
    """
    Extrae pedidos con sus líneas de detalle (plato x pedido).
    Una fila por plato dentro del pedido — igual que fact_pedido.

    Args:
        desde: si se pasa, extrae solo pedidos con fecha_hora >= desde
               (carga incremental desde Airflow).

    Schema de salida:
      id_pedido_origen, id_plato_origen, id_usuario_origen,
      id_restaurante_origen, tipo_pedido, estado_pedido,
      fecha_hora (datetime), cantidad, precio_unitario,
      subtotal, precio_total_pedido,
      latitud_entrega, longitud_entrega
    """
    filtro = "AND p.fecha_hora >= %(desde)s" if desde else ""

    sql = f"""
        SELECT
            p.id                                            AS id_pedido_origen,
            pp.id_plato                                     AS id_plato_origen,
            p.id_usuario                                    AS id_usuario_origen,
            p.id_restaurante                                AS id_restaurante_origen,
            tp.nombre                                       AS tipo_pedido,
            ep.nombre                                       AS estado_pedido,
            p.fecha_hora,
            pp.cantidad,
            CAST(pl.precio AS FLOAT)                        AS precio_unitario,
            CAST(
                COALESCE(pp.subtotal, pp.cantidad * pl.precio)
            AS FLOAT)                                       AS subtotal,
            CAST(p.precio_total AS FLOAT)                   AS precio_total_pedido,
            CAST(p.latitud_entrega  AS FLOAT)               AS latitud_entrega,
            CAST(p.longitud_entrega AS FLOAT)               AS longitud_entrega
        FROM pedido p
        JOIN plato_x_pedido     pp  ON pp.id_pedido     = p.id
        JOIN plato              pl  ON pl.id            = pp.id_plato
        JOIN tipo_pedido        tp  ON tp.id            = p.id_tipo_pedido
        JOIN estado_pedido      ep  ON ep.id            = p.id_estado_pedido
        WHERE p.fecha_hora IS NOT NULL
        {filtro}
        ORDER BY p.fecha_hora;
    """

    with _cursor() as cur:
        cur.execute(sql, {"desde": desde} if desde else None)
        rows = cur.fetchall()

    result = []
    for r in rows:
        row = dict(r)
        # Convertir datetime a string ISO para serialización uniforme
        if isinstance(row.get("fecha_hora"), datetime):
            row["fecha_hora"] = row["fecha_hora"].isoformat()
        result.append(row)

    logger.info(f"[Postgres] Pedidos extraídos: {len(result)}")
    return result


def extract_reservaciones(desde: datetime | None = None) -> list[dict]:
    """
    Schema de salida:
      id_reservacion_origen, id_usuario_origen, id_restaurante_origen,
      fecha_hora (str ISO), cant_personas, duracion_minutos,
      mesa_num, capacidad_mesa, estado
    """
    filtro = "AND r.fecha_hora >= %(desde)s" if desde else ""

    sql = f"""
        SELECT
            r.id                AS id_reservacion_origen,
            r.id_usuario        AS id_usuario_origen,
            r.id_restaurante    AS id_restaurante_origen,
            r.fecha_hora,
            r.cant_personas,
            r.duracion          AS duracion_minutos,
            m.num_mesa          AS mesa_num,
            m.capacidad         AS capacidad_mesa,
            er.nombre           AS estado
        FROM reservacion r
        JOIN mesa               m   ON m.id  = r.id_mesa
        JOIN estado_reservacion er  ON er.id = r.id_estado_reservacion
        WHERE r.fecha_hora IS NOT NULL
        {filtro}
        ORDER BY r.fecha_hora;
    """

    with _cursor() as cur:
        cur.execute(sql, {"desde": desde} if desde else None)
        rows = cur.fetchall()

    result = []
    for r in rows:
        row = dict(r)
        if isinstance(row.get("fecha_hora"), datetime):
            row["fecha_hora"] = row["fecha_hora"].isoformat()
        result.append(row)

    logger.info(f"[Postgres] Reservaciones extraídas: {len(result)}")
    return result