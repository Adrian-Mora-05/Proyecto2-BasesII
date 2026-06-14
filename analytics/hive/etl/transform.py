# ============================================================
#  ETL — Transformación y Carga a Hive
#  Proyecto: Reserva Inteligente de Restaurantes — Etapa 3
#  Archivo: analytics/hive/etl/transform.py
#
#  Responsabilidad:
#    1. Recibir los dicts normalizados de etl_postgres.py
#       o etl_mongo.py (mismo schema, distinto origen).
#    2. Aplicar transformaciones comunes: zona geográfica,
#       surrogate keys, dim_tiempo, validaciones.
#    3. Cargar las dimensiones y hechos en Hive via PyHive
#       o directamente con INSERT … VALUES en lotes.
#
#  El DAG de Airflow importa este módulo y llama en orden:
#    load_catalogos() → load_dimensiones() → load_hechos()
# ============================================================

import os
import hashlib
import logging
from datetime import datetime, date

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

def _zona_geografica(latitud: float | None, longitud: float | None) -> str:
    """
    Regla simple de zona basada en coordenadas.
    Ampliar con tabla de polígonos si el proyecto crece.
    Costa Rica — zonas principales:
    """
    if latitud is None or longitud is None:
        return "Desconocida"

    zonas = [
        # (lat_min, lat_max, lon_min, lon_max, nombre)
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
    """
    Genera un surrogate key entero estable a partir de los valores dados.
    Útil para dimensiones cuyos ids de origen son strings (Mongo ObjectIds).
    """
    raw = "|".join(str(v) for v in valores)
    return int(hashlib.md5(raw.encode()).hexdigest()[:12], 16)


def _parse_fecha_hora(fecha_hora_str: str | None) -> datetime | None:
    if not fecha_hora_str:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%S%z",
                "%Y-%m-%dT%H:%M:%S.%f",  "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(fecha_hora_str[:26], fmt[:len(fecha_hora_str[:26])])
        except ValueError:
            continue
    logger.warning(f"No se pudo parsear fecha: {fecha_hora_str}")
    return None


def _ejecutar_lote(cursor, sql_template: str, filas: list[tuple], batch_size: int = 500):
    """Inserta filas en Hive en lotes para no exceder límites de query."""
    for i in range(0, len(filas), batch_size):
        lote = filas[i:i + batch_size]
        valores = ", ".join(
            "(" + ", ".join(
                "NULL" if v is None else
                f"'{str(v).replace(chr(39), chr(39)*2)}'" if isinstance(v, str) else
                "true" if v is True else
                "false" if v is False else
                str(v)
                for v in fila
            ) + ")"
            for fila in lote
        )
        cursor.execute(sql_template + valores)
    logger.info(f"Insertadas {len(filas)} filas.")


# ------------------------------------------------------------
#  1. Catálogos
# ------------------------------------------------------------

def load_catalogos(tipos_pedido: list[dict], estados_pedido: list[dict]):
    """Carga dim_tipo_pedido y dim_estado_pedido."""
    conn = _get_hive_conn()
    cur  = conn.cursor()

    cur.execute("DELETE FROM dim_tipo_pedido")
    _ejecutar_lote(
        cur,
        "INSERT INTO dim_tipo_pedido (id, nombre) VALUES ",
        [(r["id"], r["nombre"]) for r in tipos_pedido],
    )

    cur.execute("DELETE FROM dim_estado_pedido")
    _ejecutar_lote(
        cur,
        "INSERT INTO dim_estado_pedido (id, nombre) VALUES ",
        [(r["id"], r["nombre"]) for r in estados_pedido],
    )

    conn.close()
    logger.info("Catálogos cargados en Hive.")


# ------------------------------------------------------------
#  2. Dimensiones
# ------------------------------------------------------------

def load_dim_restaurantes(restaurantes: list[dict]) -> dict:
    """
    Transforma y carga dim_restaurante.
    Devuelve un dict {id_origen → surrogate_key} para usar en hechos.
    """
    conn = _get_hive_conn()
    cur  = conn.cursor()
    cur.execute("DELETE FROM dim_restaurante")

    mapa = {}
    filas = []
    for r in restaurantes:
        sk = _surrogate_key("restaurante", r["id_origen"])
        mapa[str(r["id_origen"])] = sk
        filas.append((
            sk,
            str(r["id_origen"]),
            r["nombre"],
            r.get("direccion"),
            r.get("latitud"),
            r.get("longitud"),
            _zona_geografica(r.get("latitud"), r.get("longitud")),
            True,
            datetime.utcnow().isoformat(),
        ))

    _ejecutar_lote(
        cur,
        "INSERT INTO dim_restaurante "
        "(id, id_origen, nombre, direccion, latitud, longitud, zona_geografica, activo, cargado_en) VALUES ",
        filas,
    )
    conn.close()
    logger.info(f"dim_restaurante: {len(filas)} filas cargadas.")
    return mapa


def load_dim_usuarios(usuarios: list[dict]) -> dict:
    conn = _get_hive_conn()
    cur  = conn.cursor()
    cur.execute("DELETE FROM dim_usuario")

    mapa = {}
    filas = []
    for u in usuarios:
        sk = _surrogate_key("usuario", u["id_origen"])
        mapa[str(u["id_origen"])] = sk
        filas.append((
            sk,
            str(u["id_origen"]),
            u["nombre"],
            u.get("correo"),
            u.get("rol", "cliente"),
            u.get("latitud"),
            u.get("longitud"),
            _zona_geografica(u.get("latitud"), u.get("longitud")),
            datetime.utcnow().isoformat(),
        ))

    _ejecutar_lote(
        cur,
        "INSERT INTO dim_usuario "
        "(id, id_origen, nombre, correo, rol, latitud, longitud, zona_geografica, cargado_en) VALUES ",
        filas,
    )
    conn.close()
    logger.info(f"dim_usuario: {len(filas)} filas cargadas.")
    return mapa


def load_dim_platos(platos: list[dict]) -> dict:
    conn = _get_hive_conn()
    cur  = conn.cursor()
    cur.execute("DELETE FROM dim_plato")

    mapa = {}
    filas = []
    for p in platos:
        sk = _surrogate_key("plato", p["id_origen"])
        mapa[str(p["id_origen"])] = sk
        filas.append((
            sk,
            str(p["id_origen"]),
            p["nombre"],
            p.get("descripcion") or "Producto sin descripción",
            float(p.get("precio_unitario", 0)),
            p.get("categoria") or "Sin categoría",
            str(p["id_menu_origen"]) if p.get("id_menu_origen") else None,
            True,
            datetime.utcnow().isoformat(),
        ))

    _ejecutar_lote(
        cur,
        "INSERT INTO dim_plato "
        "(id, id_origen, nombre, descripcion, precio_unitario, categoria, id_menu_origen, activo, cargado_en) VALUES ",
        filas,
    )
    conn.close()
    logger.info(f"dim_plato: {len(filas)} filas cargadas.")
    return mapa


def load_dim_tiempo(fechas_horas: list[str]) -> dict:
    """
    Genera y carga dim_tiempo a partir de una lista de strings ISO.
    Devuelve {(fecha_str, hora_int) → surrogate_key}.
    """
    DIAS   = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
    MESES  = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
               "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

    registros = {}
    for fh_str in fechas_horas:
        dt = _parse_fecha_hora(fh_str)
        if not dt:
            continue
        clave = (dt.date().isoformat(), dt.hour)
        if clave not in registros:
            isodow = dt.isoweekday()   # 1=lunes … 7=domingo
            hora   = dt.hour
            registros[clave] = (
                _surrogate_key("tiempo", clave[0], clave[1]),
                clave[0],                           # fecha
                dt.year,                            # anio
                (dt.month - 1) // 3 + 1,           # trimestre
                dt.month,                           # mes
                int(dt.strftime("%V")),             # semana_anio ISO
                dt.day,                             # dia_mes
                isodow,                             # dia_semana
                DIAS[isodow],                       # nombre_dia
                MESES[dt.month],                    # nombre_mes
                hora,                               # hora
                isodow in (6, 7),                   # es_fin_semana
                (12 <= hora <= 14) or (18 <= hora <= 21),  # es_hora_pico
            )

    conn = _get_hive_conn()
    cur  = conn.cursor()

    _ejecutar_lote(
        cur,
        "INSERT INTO dim_tiempo "
        "(id, fecha, anio, trimestre, mes, semana_anio, dia_mes, dia_semana, "
        "nombre_dia, nombre_mes, hora, es_fin_semana, es_hora_pico) VALUES ",
        list(registros.values()),
    )
    conn.close()

    mapa = {clave: vals[0] for clave, vals in registros.items()}
    logger.info(f"dim_tiempo: {len(mapa)} combinaciones fecha/hora cargadas.")
    return mapa


# ------------------------------------------------------------
#  3. Hechos
# ------------------------------------------------------------

def load_fact_pedidos(
    pedidos:        list[dict],
    mapa_tiempo:    dict,
    mapa_rest:      dict,
    mapa_usuario:   dict,
    mapa_plato:     dict,
    mapa_tipo:      dict,   # {nombre → id}  de dim_tipo_pedido
    mapa_estado:    dict,   # {nombre → id}  de dim_estado_pedido
):
    """Transforma y carga fact_pedido particionado por anio/mes."""
    conn = _get_hive_conn()
    cur  = conn.cursor()
    cur.execute("SET hive.exec.dynamic.partition.mode=nonstrict")

    filas = []
    omitidas = 0

    for p in pedidos:
        dt = _parse_fecha_hora(p.get("fecha_hora"))
        if not dt:
            omitidas += 1
            continue

        clave_tiempo = (dt.date().isoformat(), dt.hour)
        id_tiempo    = mapa_tiempo.get(clave_tiempo)
        id_rest      = mapa_rest.get(str(p.get("id_restaurante_origen")))
        id_usuario   = mapa_usuario.get(str(p.get("id_usuario_origen")))
        id_plato     = mapa_plato.get(str(p.get("id_plato_origen")))
        id_tipo      = mapa_tipo.get(p.get("tipo_pedido"))
        id_estado    = mapa_estado.get(p.get("estado_pedido"))

        if not all([id_tiempo, id_rest, id_usuario, id_plato, id_tipo, id_estado]):
            omitidas += 1
            logger.debug(f"Fila omitida por FK faltante: pedido {p.get('id_pedido_origen')}")
            continue

        sk = _surrogate_key("fact_pedido", p["id_pedido_origen"], p["id_plato_origen"])

        filas.append((
            sk,
            id_tiempo,
            id_rest,
            id_usuario,
            id_plato,
            id_tipo,
            id_estado,
            str(p["id_pedido_origen"]),
            str(p["id_plato_origen"]),
            int(p.get("cantidad", 1)),
            float(p.get("precio_unitario", 0)),
            float(p.get("subtotal", 0)),
            p.get("precio_total_pedido"),
            p.get("latitud_entrega"),
            p.get("longitud_entrega"),
            dt.year,    # partición anio
            dt.month,   # partición mes
        ))

    _ejecutar_lote(
        cur,
        "INSERT INTO fact_pedido PARTITION (anio, mes) "
        "(id, id_tiempo, id_restaurante, id_usuario, id_plato, "
        "id_tipo_pedido, id_estado_pedido, id_pedido_origen, id_plato_origen, "
        "cantidad, precio_unitario, subtotal, precio_total_pedido, "
        "latitud_entrega, longitud_entrega, anio, mes) VALUES ",
        filas,
    )
    conn.close()
    logger.info(f"fact_pedido: {len(filas)} filas cargadas, {omitidas} omitidas.")


def load_fact_reservaciones(
    reservaciones:  list[dict],
    mapa_tiempo:    dict,
    mapa_rest:      dict,
    mapa_usuario:   dict,
):
    conn = _get_hive_conn()
    cur  = conn.cursor()
    cur.execute("SET hive.exec.dynamic.partition.mode=nonstrict")

    filas = []
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

        sk = _surrogate_key("fact_res", r["id_reservacion_origen"])

        filas.append((
            sk,
            id_tiempo,
            id_rest,
            id_usuario,
            str(r["id_reservacion_origen"]),
            personas,
            int(r.get("duracion_minutos", 60)),
            r.get("mesa_num"),
            capacidad or None,
            tasa,
            r.get("estado", "desconocido"),
            dt.year,
            dt.month,
        ))

    _ejecutar_lote(
        cur,
        "INSERT INTO fact_reservacion PARTITION (anio, mes) "
        "(id, id_tiempo, id_restaurante, id_usuario, id_reservacion_origen, "
        "cant_personas, duracion_minutos, mesa_num, capacidad_mesa, "
        "tasa_ocupacion, estado, anio, mes) VALUES ",
        filas,
    )
    conn.close()
    logger.info(f"fact_reservacion: {len(filas)} filas cargadas, {omitidas} omitidas.")