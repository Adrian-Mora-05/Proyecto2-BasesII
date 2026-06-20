# ============================================================
#  ETL — Transformación y Carga a Hive
#  Proyecto: Reserva Inteligente de Restaurantes — Etapa 3
#  Archivo: analytics/hive/etl/transform.py
#
#  NOTA: Hive sin ACID no soporta DELETE ni UPDATE.
#  Usamos INSERT OVERWRITE TABLE para reemplazar datos.
# ============================================================

import os
import hashlib
import logging
from datetime import datetime

from pyhive import hive

logger = logging.getLogger(__name__)

HIVE_HOST = os.environ.get("HIVE_HOST", "hive-server")
HIVE_PORT = int(os.environ.get("HIVE_PORT", 10000))
HIVE_DB   = os.environ.get("HIVE_DB", "restaurant_dw")


# ------------------------------------------------------------
#  Conexión a Hive
# ------------------------------------------------------------

def _get_hive_conn():
    return hive.connect(
        host=HIVE_HOST,
        port=HIVE_PORT,
        database=HIVE_DB,
        auth="NONE",
    )


# ------------------------------------------------------------
#  Helpers
# ------------------------------------------------------------

def _zona_geografica(latitud, longitud) -> str:
    if latitud is None or longitud is None:
        return "Desconocida"
    zonas = [
        (9.90, 9.96, -84.10, -84.04, "San José Centro"),
        (9.88, 9.93, -84.16, -84.12, "Escazú"),
        (9.93, 9.98, -84.12, -84.06, "Santa Ana"),
        (9.85, 9.92, -83.95, -83.88, "Cartago Centro"),
        (9.98, 10.02, -84.12, -84.06, "Heredia Centro"),
        (10.00, 10.05, -84.23, -84.17, "Alajuela Centro"),
    ]
    for lat_min, lat_max, lon_min, lon_max, nombre in zonas:
        if lat_min <= latitud <= lat_max and lon_min <= longitud <= lon_max:
            return nombre
    return "Otra zona"


def _surrogate_key(*valores) -> int:
    raw = "|".join(str(v) for v in valores)
    return int(hashlib.md5(raw.encode()).hexdigest()[:12], 16)


def _parse_fecha_hora(fecha_hora_str) -> datetime | None:
    if not fecha_hora_str:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%S%z",
                "%Y-%m-%dT%H:%M:%S.%f",   "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(str(fecha_hora_str)[:26], fmt[:26])
        except ValueError:
            continue
    logger.warning(f"No se pudo parsear fecha: {fecha_hora_str}")
    return None


def _val(v) -> str:
    """Serializa un valor Python a SQL literal para Hive."""
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, str):
        escaped = v.replace("'", "''")
        return f"'{escaped}'"
    return str(v)


def _overwrite_table(cur, tabla: str, columnas: list[str], filas: list[tuple], batch_size: int = 50):
    """
    Reemplaza el contenido de una tabla Hive usando INSERT OVERWRITE.
    Hive 4 no acepta lista de columnas en INSERT OVERWRITE/INTO VALUES,
    así que las filas deben tener los valores en el orden exacto del schema.
    """
    if not filas:
        logger.info(f"{tabla}: sin filas para cargar.")
        return

    primer_lote = True

    for i in range(0, len(filas), batch_size):
        lote = filas[i:i + batch_size]
        valores = ", ".join(
            "(" + ", ".join(_val(v) for v in fila) + ")"
            for fila in lote
        )
        if primer_lote:
            sql = f"INSERT OVERWRITE TABLE {tabla} VALUES {valores}"
            primer_lote = False
        else:
            sql = f"INSERT INTO TABLE {tabla} VALUES {valores}"
        cur.execute(sql)

    logger.info(f"{tabla}: {len(filas)} filas cargadas.")


def _insert_into_partitioned(cur, tabla: str, columnas: list[str],
                              filas: list[tuple], batch_size: int = 50):
    """INSERT INTO para tablas particionadas (fact_pedido, fact_reservacion).
    Hive 4 no acepta lista de columnas en VALUES — los valores van en orden del schema."""
    if not filas:
        logger.info(f"{tabla}: sin filas para cargar.")
        return

    for i in range(0, len(filas), batch_size):
        lote = filas[i:i + batch_size]
        valores = ", ".join(
            "(" + ", ".join(_val(v) for v in fila) + ")"
            for fila in lote
        )
        cur.execute(f"INSERT INTO TABLE {tabla} VALUES {valores}")

    logger.info(f"{tabla}: {len(filas)} filas cargadas.")


# ------------------------------------------------------------
#  1. Catálogos
# ------------------------------------------------------------

def load_catalogos(tipos_pedido: list[dict], estados_pedido: list[dict]):
    conn = _get_hive_conn()
    cur  = conn.cursor()

    _overwrite_table(
        cur, "dim_tipo_pedido", ["id", "nombre"],
        [(r["id"], r["nombre"]) for r in tipos_pedido],
    )
    _overwrite_table(
        cur, "dim_estado_pedido", ["id", "nombre"],
        [(r["id"], r["nombre"]) for r in estados_pedido],
    )

    conn.close()
    logger.info("Catálogos cargados en Hive.")


# ------------------------------------------------------------
#  2. Dimensiones
# ------------------------------------------------------------

def load_dim_restaurantes(restaurantes: list[dict]) -> dict:
    mapa  = {}
    filas = []
    for r in restaurantes:
        sk = _surrogate_key("restaurante", r["id_origen"])
        mapa[str(r["id_origen"])] = sk
        filas.append((
            sk, str(r["id_origen"]), r["nombre"],
            r.get("direccion"), r.get("latitud"), r.get("longitud"),
            _zona_geografica(r.get("latitud"), r.get("longitud")),
            True, datetime.utcnow().isoformat(),
        ))

    conn = _get_hive_conn()
    cur  = conn.cursor()
    _overwrite_table(
        cur, "dim_restaurante",
        ["id", "id_origen", "nombre", "direccion", "latitud", "longitud",
         "zona_geografica", "activo", "cargado_en"],
        filas,
    )
    conn.close()
    logger.info(f"dim_restaurante: {len(filas)} filas cargadas.")
    return mapa


def load_dim_usuarios(usuarios: list[dict]) -> dict:
    mapa  = {}
    filas = []
    for u in usuarios:
        sk = _surrogate_key("usuario", u["id_origen"])
        mapa[str(u["id_origen"])] = sk
        filas.append((
            sk, str(u["id_origen"]), u["nombre"],
            u.get("correo"), u.get("rol", "cliente"),
            u.get("latitud"), u.get("longitud"),
            _zona_geografica(u.get("latitud"), u.get("longitud")),
            datetime.utcnow().isoformat(),
        ))

    conn = _get_hive_conn()
    cur  = conn.cursor()
    _overwrite_table(
        cur, "dim_usuario",
        ["id", "id_origen", "nombre", "correo", "rol",
         "latitud", "longitud", "zona_geografica", "cargado_en"],
        filas,
    )
    conn.close()
    logger.info(f"dim_usuario: {len(filas)} filas cargadas.")
    return mapa


def load_dim_platos(platos: list[dict]) -> dict:
    mapa  = {}
    filas = []
    for p in platos:
        sk = _surrogate_key("plato", p["id_origen"])
        mapa[str(p["id_origen"])] = sk
        filas.append((
            sk, str(p["id_origen"]), p["nombre"],
            p.get("descripcion") or "Producto sin descripción",
            float(p.get("precio_unitario", 0)),
            p.get("categoria") or "Sin categoría",
            str(p["id_menu_origen"]) if p.get("id_menu_origen") else None,
            True, datetime.utcnow().isoformat(),
        ))

    conn = _get_hive_conn()
    cur  = conn.cursor()
    _overwrite_table(
        cur, "dim_plato",
        ["id", "id_origen", "nombre", "descripcion", "precio_unitario",
         "categoria", "id_menu_origen", "activo", "cargado_en"],
        filas,
    )
    conn.close()
    logger.info(f"dim_plato: {len(filas)} filas cargadas.")
    return mapa


def load_dim_tiempo(fechas_horas: list[str]) -> dict:
    DIAS  = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
    MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
              "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

    registros = {}
    for fh_str in fechas_horas:
        dt = _parse_fecha_hora(fh_str)
        if not dt:
            continue
        clave = (dt.date().isoformat(), dt.hour)
        if clave not in registros:
            isodow = dt.isoweekday()
            hora   = dt.hour
            registros[clave] = (
                _surrogate_key("tiempo", clave[0], clave[1]),
                clave[0], dt.year,
                (dt.month - 1) // 3 + 1,
                dt.month,
                int(dt.strftime("%V")),
                dt.day, isodow,
                DIAS[isodow], MESES[dt.month],
                hora,
                isodow in (6, 7),
                (12 <= hora <= 14) or (18 <= hora <= 21),
            )

    conn = _get_hive_conn()
    cur  = conn.cursor()
    _overwrite_table(
        cur, "dim_tiempo",
        ["id", "fecha", "anio", "trimestre", "mes", "semana_anio",
         "dia_mes", "dia_semana", "nombre_dia", "nombre_mes",
         "hora", "es_fin_semana", "es_hora_pico"],
        list(registros.values()),
    )
    conn.close()

    mapa = {clave: vals[0] for clave, vals in registros.items()}
    logger.info(f"dim_tiempo: {len(mapa)} combinaciones fecha/hora cargadas.")
    return mapa


# ------------------------------------------------------------
#  3. Hechos
# ------------------------------------------------------------

def load_fact_pedidos(pedidos, mapa_tiempo, mapa_rest,
                      mapa_usuario, mapa_plato, mapa_tipo, mapa_estado):
    conn = _get_hive_conn()
    cur  = conn.cursor()
    cur.execute("SET hive.exec.dynamic.partition.mode=nonstrict")

    # TRUNCATE limpia todas las particiones antes de recargar.
    # Hace que cada corrida del DAG sea idempotente — triggerear
    # el mismo run dos veces no duplica filas.
    logger.info("Truncando fact_pedido antes de recargar...")
    cur.execute("TRUNCATE TABLE fact_pedido")

    filas    = []
    omitidas = 0

    for p in pedidos:
        dt = _parse_fecha_hora(p.get("fecha_hora"))
        if not dt:
            omitidas += 1
            continue

        clave_tiempo = (dt.date().isoformat(), dt.hour)
        id_tiempo  = mapa_tiempo.get(clave_tiempo)
        id_rest    = mapa_rest.get(str(p.get("id_restaurante_origen")))
        id_usuario = mapa_usuario.get(str(p.get("id_usuario_origen")))
        id_plato   = mapa_plato.get(str(p.get("id_plato_origen")))
        id_tipo    = mapa_tipo.get(p.get("tipo_pedido"))
        id_estado  = mapa_estado.get(p.get("estado_pedido"))

        if not all([id_tiempo, id_rest, id_usuario, id_plato, id_tipo, id_estado]):
            omitidas += 1
            continue

        sk = _surrogate_key("fact_pedido", p["id_pedido_origen"], p["id_plato_origen"])
        filas.append((
            sk, id_tiempo, id_rest, id_usuario, id_plato, id_tipo, id_estado,
            str(p["id_pedido_origen"]), str(p["id_plato_origen"]),
            int(p.get("cantidad", 1)),
            float(p.get("precio_unitario", 0)),
            float(p.get("subtotal", 0)),
            p.get("precio_total_pedido"),
            p.get("latitud_entrega"), p.get("longitud_entrega"),
            dt.year, dt.month,
        ))

    _insert_into_partitioned(
        cur, "fact_pedido",
        ["id", "id_tiempo", "id_restaurante", "id_usuario", "id_plato",
         "id_tipo_pedido", "id_estado_pedido", "id_pedido_origen", "id_plato_origen",
         "cantidad", "precio_unitario", "subtotal", "precio_total_pedido",
         "latitud_entrega", "longitud_entrega", "anio", "mes"],
        filas,
    )
    conn.close()
    logger.info(f"fact_pedido: {len(filas)} filas cargadas, {omitidas} omitidas.")


def load_fact_reservaciones(reservaciones, mapa_tiempo, mapa_rest, mapa_usuario):
    conn = _get_hive_conn()
    cur  = conn.cursor()
    cur.execute("SET hive.exec.dynamic.partition.mode=nonstrict")

    logger.info("Truncando fact_reservacion antes de recargar...")
    cur.execute("TRUNCATE TABLE fact_reservacion")

    filas    = []
    omitidas = 0

    for r in reservaciones:
        dt = _parse_fecha_hora(r.get("fecha_hora"))
        if not dt:
            omitidas += 1
            continue

        clave_tiempo = (dt.date().isoformat(), dt.hour)
        id_tiempo  = mapa_tiempo.get(clave_tiempo)
        id_rest    = mapa_rest.get(str(r.get("id_restaurante_origen")))
        id_usuario = mapa_usuario.get(str(r.get("id_usuario_origen")))

        if not all([id_tiempo, id_rest, id_usuario]):
            omitidas += 1
            continue

        capacidad = r.get("capacidad_mesa") or 0
        personas  = int(r.get("cant_personas", 0))
        tasa      = round(personas / capacidad * 100, 2) if capacidad else None
        sk        = _surrogate_key("fact_res", r["id_reservacion_origen"])

        filas.append((
            sk, id_tiempo, id_rest, id_usuario,
            str(r["id_reservacion_origen"]),
            personas, int(r.get("duracion_minutos", 60)),
            r.get("mesa_num"), capacidad or None, tasa,
            r.get("estado", "desconocido"),
            dt.year, dt.month,
        ))

    _insert_into_partitioned(
        cur, "fact_reservacion",
        ["id", "id_tiempo", "id_restaurante", "id_usuario", "id_reservacion_origen",
         "cant_personas", "duracion_minutos", "mesa_num", "capacidad_mesa",
         "tasa_ocupacion", "estado", "anio", "mes"],
        filas,
    )
    conn.close()
    logger.info(f"fact_reservacion: {len(filas)} filas cargadas, {omitidas} omitidas.")