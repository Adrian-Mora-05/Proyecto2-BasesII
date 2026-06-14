# ============================================================
#  ETL — Extracción desde MongoDB
#  Proyecto: Reserva Inteligente de Restaurantes — Etapa 3
#  Archivo: analytics/hive/etl/etl_mongo.py
#
#  Responsabilidad: extraer datos del OLTP MongoDB y
#  devolverlos como listas de dicts normalizados, listos
#  para pasar a transform.py (capa común).
#
#  El schema de salida de cada función es IDÉNTICO al de
#  etl_postgres.py — transform.py no distingue el origen.
#
#  Es invocado por el DAG de Airflow cuando DB_ENGINE=mongo.
# ============================================================

import os
import logging
from datetime import datetime, timezone

from pymongo import MongoClient
from bson import ObjectId

logger = logging.getLogger(__name__)


# ------------------------------------------------------------
#  Conexión
# ------------------------------------------------------------

def _get_db():
    """Devuelve la base de datos MongoDB usando variables de entorno."""
    url = os.environ.get("MONGO_URL", "mongodb://mongos-service:27017")
    db_name = os.environ.get("MONGO_DB", "restaurantdb")
    client = MongoClient(url)
    return client[db_name]


def _str_id(val) -> str:
    """Normaliza ObjectId o string a string."""
    if isinstance(val, ObjectId):
        return str(val)
    return str(val) if val is not None else None


def _to_iso(val) -> str | None:
    """Convierte datetime o string a ISO 8601. Devuelve None si no aplica."""
    if val is None:
        return None
    if isinstance(val, datetime):
        if val.tzinfo is None:
            val = val.replace(tzinfo=timezone.utc)
        return val.isoformat()
    if isinstance(val, str):
        return val  # ya viene como ISO desde Mongo en algunos casos
    return None


# ------------------------------------------------------------
#  Catálogos (en Mongo son strings embebidos, no tablas)
#  Devolvemos listas sintéticas con la misma forma que Postgres.
# ------------------------------------------------------------

def extract_tipos_pedido() -> list[dict]:
    """
    En Mongo el tipo de pedido es un campo string en el documento
    de pedido. Derivamos los valores únicos y asignamos IDs sintéticos.
    """
    db = _get_db()
    tipos = db["pedidos"].distinct("tipo_pedido")
    return [
        {"id": i + 1, "nombre": t}
        for i, t in enumerate(sorted(t for t in tipos if t))
    ]


def extract_estados_pedido() -> list[dict]:
    db = _get_db()
    estados = db["pedidos"].distinct("estado")
    return [
        {"id": i + 1, "nombre": e}
        for i, e in enumerate(sorted(e for e in estados if e))
    ]


# ------------------------------------------------------------
#  Dimensiones principales
# ------------------------------------------------------------

def extract_restaurantes() -> list[dict]:
    """
    Schema de salida:
      id_origen, nombre, direccion, latitud, longitud
    """
    db = _get_db()
    docs = db["restaurantes"].find({}, {
        "_id": 1, "nombre": 1, "direccion": 1,
        "latitud": 1, "longitud": 1
    })

    result = []
    for doc in docs:
        result.append({
            "id_origen":  _str_id(doc["_id"]),
            "nombre":     doc.get("nombre", "Sin nombre"),
            "direccion":  doc.get("direccion"),
            "latitud":    float(doc["latitud"])  if doc.get("latitud")  is not None else None,
            "longitud":   float(doc["longitud"]) if doc.get("longitud") is not None else None,
        })

    logger.info(f"[Mongo] Restaurantes extraídos: {len(result)}")
    return result


def extract_usuarios() -> list[dict]:
    """
    Schema de salida:
      id_origen, nombre, correo, rol
    """
    db = _get_db()
    docs = db["usuarios"].find({}, {
        "_id": 1, "nombre": 1, "correo": 1, "rol": 1
    })

    result = []
    for doc in docs:
        result.append({
            "id_origen": _str_id(doc["_id"]),
            "nombre":    doc.get("nombre", "Sin nombre"),
            "correo":    doc.get("correo"),
            "rol":       doc.get("rol", "cliente"),
        })

    logger.info(f"[Mongo] Usuarios extraídos: {len(result)}")
    return result


def extract_platos() -> list[dict]:
    """
    En Mongo los platos pueden estar en la colección 'platos'
    o embebidos en 'menus'. Buscamos en ambos lados.

    Schema de salida:
      id_origen, nombre, descripcion, precio_unitario, categoria, id_menu_origen
    """
    db = _get_db()
    result = []

    # Caso 1: colección platos independiente
    if "platos" in db.list_collection_names():
        docs = db["platos"].find({}, {
            "_id": 1, "nombre": 1, "descripcion": 1,
            "precio": 1, "categoria": 1, "id_menu": 1
        })
        for doc in docs:
            result.append({
                "id_origen":      _str_id(doc["_id"]),
                "nombre":         doc.get("nombre", "Sin nombre"),
                "descripcion":    doc.get("descripcion") or "Producto sin descripción",
                "precio_unitario": float(doc.get("precio", 0)),
                "categoria":      doc.get("categoria") or "Sin categoría",
                "id_menu_origen": _str_id(doc.get("id_menu")),
            })

    # Caso 2: platos embebidos dentro de documentos de menú
    if not result:
        menus = db["menus"].find({}, {"_id": 1, "platos": 1})
        for menu in menus:
            for plato in menu.get("platos", []):
                result.append({
                    "id_origen":       _str_id(plato.get("_id") or plato.get("id")),
                    "nombre":          plato.get("nombre", "Sin nombre"),
                    "descripcion":     plato.get("descripcion") or "Producto sin descripción",
                    "precio_unitario": float(plato.get("precio", 0)),
                    "categoria":       plato.get("categoria") or "Sin categoría",
                    "id_menu_origen":  _str_id(menu["_id"]),
                })

    logger.info(f"[Mongo] Platos extraídos: {len(result)}")
    return result


# ------------------------------------------------------------
#  Hechos
# ------------------------------------------------------------

def extract_pedidos(desde: datetime | None = None) -> list[dict]:
    """
    En Mongo los platos del pedido están embebidos como array.
    Desanidamos para producir una fila por plato × pedido,
    igual que la granularidad de fact_pedido en Hive.

    Schema de salida (idéntico a etl_postgres.py):
      id_pedido_origen, id_plato_origen, id_usuario_origen,
      id_restaurante_origen, tipo_pedido, estado_pedido,
      fecha_hora (str ISO), cantidad, precio_unitario,
      subtotal, precio_total_pedido,
      latitud_entrega, longitud_entrega
    """
    db = _get_db()

    filtro = {}
    if desde:
        filtro["createdAt"] = {"$gte": desde}

    docs = db["pedidos"].find(filtro, {
        "_id": 1,
        "id_usuario": 1,
        "id_restaurante": 1,
        "tipo_pedido": 1,
        "estado": 1,
        "createdAt": 1,
        "precio_total": 1,
        "latitud_entrega": 1,
        "longitud_entrega": 1,
        "platos": 1,
    })

    result = []
    for doc in docs:
        platos = doc.get("platos") or []

        # Calcular precio_total si no viene guardado
        precio_total = float(doc.get("precio_total") or 0)

        for plato in platos:
            cantidad       = int(plato.get("cantidad", 1))
            precio_unit    = float(plato.get("precio", 0))
            subtotal       = float(plato.get("subtotal") or cantidad * precio_unit)

            result.append({
                "id_pedido_origen":      _str_id(doc["_id"]),
                "id_plato_origen":       _str_id(plato.get("_id") or plato.get("id_plato")),
                "id_usuario_origen":     _str_id(doc.get("id_usuario")),
                "id_restaurante_origen": _str_id(doc.get("id_restaurante")),
                "tipo_pedido":           doc.get("tipo_pedido", "desconocido"),
                "estado_pedido":         doc.get("estado", "desconocido"),
                "fecha_hora":            _to_iso(doc.get("createdAt")),
                "cantidad":              cantidad,
                "precio_unitario":       precio_unit,
                "subtotal":              subtotal,
                "precio_total_pedido":   precio_total,
                "latitud_entrega":       float(doc["latitud_entrega"])  if doc.get("latitud_entrega")  is not None else None,
                "longitud_entrega":      float(doc["longitud_entrega"]) if doc.get("longitud_entrega") is not None else None,
            })

    logger.info(f"[Mongo] Filas de pedidos extraídas: {len(result)}")
    return result


def extract_reservaciones(desde: datetime | None = None) -> list[dict]:
    """
    Schema de salida (idéntico a etl_postgres.py):
      id_reservacion_origen, id_usuario_origen, id_restaurante_origen,
      fecha_hora (str ISO), cant_personas, duracion_minutos,
      mesa_num, capacidad_mesa, estado
    """
    db = _get_db()

    filtro = {}
    if desde:
        filtro["createdAt"] = {"$gte": desde}

    docs = db["reservaciones"].find(filtro, {
        "_id": 1,
        "id_usuario": 1,
        "id_restaurante": 1,
        "id_mesa": 1,
        "fecha": 1,
        "createdAt": 1,
        "personas": 1,
        "duracion": 1,
        "estado": 1,
    })

    # Para capacidad de mesa hacemos lookup en colección mesas
    mesas_col = db["mesas"]

    result = []
    for doc in docs:
        # Buscar datos de la mesa
        mesa_doc = None
        if doc.get("id_mesa"):
            try:
                mesa_doc = mesas_col.find_one(
                    {"_id": ObjectId(str(doc["id_mesa"]))},
                    {"num_mesa": 1, "capacidad": 1}
                )
            except Exception:
                mesa_doc = mesas_col.find_one(
                    {"_id": doc["id_mesa"]},
                    {"num_mesa": 1, "capacidad": 1}
                )

        fecha = doc.get("fecha") or doc.get("createdAt")

        result.append({
            "id_reservacion_origen": _str_id(doc["_id"]),
            "id_usuario_origen":     _str_id(doc.get("id_usuario")),
            "id_restaurante_origen": _str_id(doc.get("id_restaurante")),
            "fecha_hora":            _to_iso(fecha),
            "cant_personas":         int(doc.get("personas", 1)),
            "duracion_minutos":      int(doc.get("duracion", 60)),
            "mesa_num":              int(mesa_doc["num_mesa"])  if mesa_doc else None,
            "capacidad_mesa":        int(mesa_doc["capacidad"]) if mesa_doc else None,
            "estado":                doc.get("estado", "desconocido"),
        })

    logger.info(f"[Mongo] Reservaciones extraídas: {len(result)}")
    return result