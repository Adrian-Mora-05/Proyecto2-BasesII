# ============================================================
#  ETL — Extracción desde MongoDB
#  Proyecto: Reserva Inteligente de Restaurantes — Etapa 3
#  Archivo: analytics/hive/etl/etl_mongo.py
#
#  Responsabilidad: extraer datos del OLTP MongoDB y
#  devolverlos como listas de dicts normalizados, listos
#  para pasar a transform.py (capa común).
#
#  NOTA: En MongoDB no existen colecciones separadas para
#  restaurantes, usuarios ni platos. Todos esos datos se
#  derivan desde los documentos de pedidos que sí existen.
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
    url     = os.environ.get("MONGO_URL", "mongodb://mongos:27017/")
    db_name = os.environ.get("MONGO_DB",  "restaurantdb")
    client  = MongoClient(url)
    return client[db_name]


def _str_id(val) -> str:
    if isinstance(val, ObjectId):
        return str(val)
    return str(val) if val is not None else None


def _to_iso(val) -> str | None:
    if val is None:
        return None
    if isinstance(val, datetime):
        if val.tzinfo is None:
            val = val.replace(tzinfo=timezone.utc)
        return val.isoformat()
    if isinstance(val, str):
        return val
    return None


# ------------------------------------------------------------
#  Catálogos — derivados de campos string en pedidos
# ------------------------------------------------------------

def extract_tipos_pedido() -> list[dict]:
    db    = _get_db()
    tipos = db["pedidos"].distinct("tipo_pedido")
    return [
        {"id": i + 1, "nombre": t}
        for i, t in enumerate(sorted(t for t in tipos if t))
    ]


def extract_estados_pedido() -> list[dict]:
    db      = _get_db()
    estados = db["pedidos"].distinct("estado")
    return [
        {"id": i + 1, "nombre": e}
        for i, e in enumerate(sorted(e for e in estados if e))
    ]


# ------------------------------------------------------------
#  Dimensiones — derivadas desde los documentos de pedidos
#  porque no existen colecciones separadas en Mongo
# ------------------------------------------------------------

# Mapa fijo de restaurantes (coincide con el seed base 04_seed.sql)
_RESTAURANTES = {
    "1": {"nombre": "La Soda Tica",  "latitud":  9.9325, "longitud": -84.0796},
    "2": {"nombre": "Pizza Planet",  "latitud":  9.9187, "longitud": -84.1394},
}

# Mapa fijo de usuarios (coincide con el seed base)
_USUARIOS = {
    "2": {"nombre": "María Pérez",   "correo": "maria@example.com",  "rol": "cliente"},
    "3": {"nombre": "Juan Mora",     "correo": "juan@example.com",   "rol": "cliente"},
    "4": {"nombre": "Laura Jiménez", "correo": "laura@example.com",  "rol": "cliente"},
    "5": {"nombre": "Diego Rojas",   "correo": "diego@example.com",  "rol": "cliente"},
    "6": {"nombre": "Ana Vargas",    "correo": "ana@example.com",    "rol": "cliente"},
}

# Mapa fijo de platos (coincide con el seed base)
_PLATOS = {
    "1":  {"nombre": "Casado",              "descripcion": "Plato típico costarricense", "precio_unitario": 3500,  "categoria": "Típico",       "id_menu_origen": "1"},
    "2":  {"nombre": "Gallo Pinto",         "descripcion": "Desayuno típico",             "precio_unitario": 2500,  "categoria": "Desayuno",     "id_menu_origen": "1"},
    "3":  {"nombre": "Pancakes",            "descripcion": "Pancakes con miel",           "precio_unitario": 2500,  "categoria": "Desayuno",     "id_menu_origen": "1"},
    "4":  {"nombre": "Pizza Pepperoni",     "descripcion": "Pizza con pepperoni",         "precio_unitario": 8000,  "categoria": "Pizza",        "id_menu_origen": "2"},
    "5":  {"nombre": "Pizza Hawaiana",      "descripcion": "Pizza con piña y jamón",      "precio_unitario": 8500,  "categoria": "Pizza",        "id_menu_origen": "2"},
    "6":  {"nombre": "Ensalada César",      "descripcion": "Ensalada clásica",            "precio_unitario": 3000,  "categoria": "Ensalada",     "id_menu_origen": "1"},
    "7":  {"nombre": "Sopa de Mariscos",    "descripcion": "Sopa con mariscos frescos",   "precio_unitario": 4000,  "categoria": "Mariscos",     "id_menu_origen": "1"},
    "8":  {"nombre": "Pasta Alfredo",       "descripcion": "Pasta con salsa alfredo",     "precio_unitario": 4500,  "categoria": "Pasta",        "id_menu_origen": "1"},
    "9":  {"nombre": "Carne Asada",         "descripcion": "Carne asada a la parrilla",   "precio_unitario": 5000,  "categoria": "Carne",        "id_menu_origen": "1"},
    "10": {"nombre": "Hamburguesa Vegana",  "descripcion": "Hamburguesa sin carne",       "precio_unitario": 3500,  "categoria": "Vegano",       "id_menu_origen": "1"},
    "11": {"nombre": "Pizza Vegetariana",   "descripcion": "Pizza sin carne",             "precio_unitario": 7500,  "categoria": "Vegetariano",  "id_menu_origen": "2"},
    "12": {"nombre": "Postre de Chocolate", "descripcion": "Brownie de chocolate",        "precio_unitario": 2000,  "categoria": "Postre",       "id_menu_origen": "1"},
    "13": {"nombre": "Limonada Natural",    "descripcion": "Limonada fresca",             "precio_unitario": 1500,  "categoria": "Bebida",       "id_menu_origen": "1"},
}


def extract_restaurantes() -> list[dict]:
    """Devuelve restaurantes desde el mapa fijo."""
    result = [
        {
            "id_origen":  id_r,
            "nombre":     info["nombre"],
            "direccion":  None,
            "latitud":    info["latitud"],
            "longitud":   info["longitud"],
        }
        for id_r, info in _RESTAURANTES.items()
    ]
    logger.info(f"[Mongo] Restaurantes: {len(result)}")
    return result


def extract_usuarios() -> list[dict]:
    """Devuelve usuarios desde el mapa fijo."""
    result = [
        {
            "id_origen": id_u,
            "nombre":    info["nombre"],
            "correo":    info["correo"],
            "rol":       info["rol"],
            "latitud":   None,
            "longitud":  None,
        }
        for id_u, info in _USUARIOS.items()
    ]
    logger.info(f"[Mongo] Usuarios: {len(result)}")
    return result


def extract_platos() -> list[dict]:
    """Devuelve platos desde el mapa fijo."""
    result = [
        {
            "id_origen":       id_p,
            "nombre":          info["nombre"],
            "descripcion":     info["descripcion"],
            "precio_unitario": info["precio_unitario"],
            "categoria":       info["categoria"],
            "id_menu_origen":  info["id_menu_origen"],
        }
        for id_p, info in _PLATOS.items()
    ]
    logger.info(f"[Mongo] Platos: {len(result)}")
    return result


# ------------------------------------------------------------
#  Hechos
# ------------------------------------------------------------

def extract_pedidos(desde: datetime | None = None) -> list[dict]:
    """
    Desanida los platos embebidos en cada pedido para producir
    una fila por plato × pedido (granularidad de fact_pedido).
    """
    db     = _get_db()
    filtro = {}
    if desde:
        filtro["createdAt"] = {"$gte": desde}

    docs = db["pedidos"].find(filtro, {
        "_id": 1, "id_usuario": 1, "id_restaurante": 1,
        "tipo_pedido": 1, "estado": 1, "createdAt": 1,
        "precio_total": 1, "latitud_entrega": 1,
        "longitud_entrega": 1, "platos": 1,
    })

    result = []
    for doc in docs:
        platos      = doc.get("platos") or []
        precio_total = float(doc.get("precio_total") or 0)

        for plato in platos:
            cantidad    = int(plato.get("cantidad", 1))
            precio_unit = float(plato.get("precio", 0))
            subtotal    = float(plato.get("subtotal") or cantidad * precio_unit)

            result.append({
                "id_pedido_origen":      _str_id(doc["_id"]),
                "id_plato_origen":       _str_id(plato.get("id_plato")),
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
    db     = _get_db()
    filtro = {}
    if desde:
        filtro["createdAt"] = {"$gte": desde}

    docs = db["reservaciones"].find(filtro, {
        "_id": 1, "id_usuario": 1, "id_restaurante": 1,
        "id_mesa": 1, "fecha": 1, "createdAt": 1,
        "personas": 1, "duracion": 1, "estado": 1,
    })

    result = []
    for doc in docs:
        fecha = doc.get("fecha") or doc.get("createdAt")
        result.append({
            "id_reservacion_origen": _str_id(doc["_id"]),
            "id_usuario_origen":     _str_id(doc.get("id_usuario")),
            "id_restaurante_origen": _str_id(doc.get("id_restaurante")),
            "fecha_hora":            _to_iso(fecha),
            "cant_personas":         int(doc.get("personas", 1)),
            "duracion_minutos":      int(doc.get("duracion", 60)),
            "mesa_num":              None,
            "capacidad_mesa":        None,
            "estado":                doc.get("estado", "desconocido"),
        })

    logger.info(f"[Mongo] Reservaciones extraídas: {len(result)}")
    return result