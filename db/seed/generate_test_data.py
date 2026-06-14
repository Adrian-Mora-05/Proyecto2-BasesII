#!/usr/bin/env python3
# ============================================================
#  Script de datos de prueba — Etapa 3
#  Proyecto: Reserva Inteligente de Restaurantes
#  Archivo: db/seed/generate_test_data.py
#
#  Genera datos realistas distribuidos en 6 meses con:
#    - Picos horarios: 12-14h y 18-21h
#    - Mayor volumen fines de semana
#    - Crecimiento gradual mes a mes (~10% mensual)
#    - Variación por restaurante y categoría
#    - Geolocalización coherente con el seed base
#
#  Uso:
#    # Para Postgres (default):
#    python generate_test_data.py
#
#    # Para Mongo:
#    DB_ENGINE=mongo python generate_test_data.py
#
#    # Limpiar datos anteriores antes de insertar:
#    RESET=true python generate_test_data.py
#
#  Variables de entorno requeridas (o usa los defaults):
#    DB_ENGINE, DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
#    MONGO_URL, MONGO_DB
# ============================================================

import os
import sys
import random
import logging
from datetime import datetime, timedelta
from typing import Optional

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("seed")

# ── Configuración ────────────────────────────────────────────
DB_ENGINE = os.environ.get("DB_ENGINE", "postgres").strip().lower()
RESET     = os.environ.get("RESET", "false").strip().lower() == "true"

# Período: 6 meses hacia atrás desde hoy
HOY        = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
FECHA_FIN  = HOY
FECHA_INI  = HOY - timedelta(days=180)

# Semilla aleatoria fija para reproducibilidad
random.seed(42)

# ── Datos base (deben coincidir con 04_seed.sql) ─────────────

RESTAURANTES = [
    {"id": 1, "nombre": "La Soda Tica",  "lat": 9.9325,  "lon": -84.0796},
    {"id": 2, "nombre": "Pizza Planet",  "lat": 9.9187,  "lon": -84.1394},
]

# id_menu: 1 = La Soda Tica, 2 = Pizza Planet
PLATOS = [
    {"id": 1,  "id_restaurante": 1, "nombre": "Casado",             "precio": 3500,  "categoria": "Típico"},
    {"id": 2,  "id_restaurante": 1, "nombre": "Gallo Pinto",        "precio": 2500,  "categoria": "Desayuno"},
    {"id": 3,  "id_restaurante": 1, "nombre": "Pancakes",           "precio": 2500,  "categoria": "Desayuno"},
    {"id": 4,  "id_restaurante": 2, "nombre": "Pizza Pepperoni",    "precio": 8000,  "categoria": "Pizza"},
    {"id": 5,  "id_restaurante": 2, "nombre": "Pizza Hawaiana",     "precio": 8500,  "categoria": "Pizza"},
    {"id": 6,  "id_restaurante": 1, "nombre": "Ensalada César",     "precio": 3000,  "categoria": "Ensalada"},
    {"id": 7,  "id_restaurante": 1, "nombre": "Sopa de Mariscos",   "precio": 4000,  "categoria": "Mariscos"},
    {"id": 8,  "id_restaurante": 1, "nombre": "Pasta Alfredo",      "precio": 4500,  "categoria": "Pasta"},
    {"id": 9,  "id_restaurante": 1, "nombre": "Carne Asada",        "precio": 5000,  "categoria": "Carne"},
    {"id": 10, "id_restaurante": 1, "nombre": "Hamburguesa Vegana", "precio": 3500,  "categoria": "Vegano"},
    {"id": 11, "id_restaurante": 2, "nombre": "Pizza Vegetariana",  "precio": 7500,  "categoria": "Vegetariano"},
    {"id": 12, "id_restaurante": 1, "nombre": "Postre de Chocolate","precio": 2000,  "categoria": "Postre"},
    {"id": 13, "id_restaurante": 1, "nombre": "Limonada Natural",   "precio": 1500,  "categoria": "Bebida"},
]

USUARIOS = [
    {"id": 2, "nombre": "María Pérez",   "lat": 9.9310, "lon": -84.0780},
    {"id": 3, "nombre": "Juan Mora",     "lat": 9.9200, "lon": -84.1400},
    {"id": 4, "nombre": "Laura Jiménez", "lat": 9.9330, "lon": -84.0810},
    {"id": 5, "nombre": "Diego Rojas",   "lat": 9.9190, "lon": -84.1380},
    {"id": 6, "nombre": "Ana Vargas",    "lat": 9.9315, "lon": -84.0795},
]

MESAS = [
    {"id": 1, "id_restaurante": 1, "num_mesa": 1, "capacidad": 4},
    {"id": 2, "id_restaurante": 1, "num_mesa": 2, "capacidad": 2},
    {"id": 3, "id_restaurante": 2, "num_mesa": 1, "capacidad": 6},
]

TIPOS_PEDIDO  = {1: "comer aquí", 2: "para llevar"}
ESTADOS_PEDIDO = {1: "completado", 2: "cancelado"}

# Platos por restaurante para facilitar la selección
PLATOS_POR_REST = {
    1: [p for p in PLATOS if p["id_restaurante"] == 1],
    2: [p for p in PLATOS if p["id_restaurante"] == 2],
}


# ============================================================
#  Lógica de generación de datos
# ============================================================

def hora_aleatoria_con_pico() -> int:
    """
    Genera una hora del día con distribución que respeta los picos:
      - 7-9h: desayuno (15%)
      - 12-14h: almuerzo pico (30%)
      - 18-21h: cena pico (35%)
      - Resto: horas valle (20%)
    """
    rand = random.random()
    if rand < 0.15:
        return random.randint(7, 9)
    elif rand < 0.45:
        return random.randint(12, 14)
    elif rand < 0.80:
        return random.randint(18, 21)
    else:
        return random.choice([10, 11, 15, 16, 17, 22])


def factor_dia_semana(fecha: datetime) -> float:
    """
    Multiplicador de demanda según día de la semana.
    Viernes y sábado tienen ~40% más pedidos.
    """
    dow = fecha.weekday()  # 0=lunes, 6=domingo
    factores = {0: 0.7, 1: 0.7, 2: 0.8, 3: 0.9, 4: 1.2, 5: 1.4, 6: 1.0}
    return factores.get(dow, 1.0)


def factor_crecimiento_mes(fecha: datetime) -> float:
    """
    Simula crecimiento del ~10% mensual desde FECHA_INI.
    Mes 0 = 1.0, mes 6 = ~1.6
    """
    meses_desde_inicio = (
        (fecha.year - FECHA_INI.year) * 12
        + (fecha.month - FECHA_INI.month)
    )
    return 1.0 + (meses_desde_inicio * 0.10)


def generar_fecha_hora(fecha_base: datetime) -> datetime:
    hora   = hora_aleatoria_con_pico()
    minuto = random.randint(0, 59)
    return fecha_base.replace(hour=hora, minute=minuto, second=0, microsecond=0)


def elegir_platos_para_pedido(id_restaurante: int) -> list[dict]:
    """
    Selecciona 1-3 platos para un pedido con cantidades.
    Los platos más baratos (desayuno, bebidas) se piden más.
    """
    pool = PLATOS_POR_REST[id_restaurante]

    # Peso inverso al precio: platos baratos se piden más
    pesos = [1.0 / p["precio"] * 10000 for p in pool]
    total_peso = sum(pesos)
    probs = [w / total_peso for w in pesos]

    n_platos = random.choices([1, 2, 3], weights=[0.4, 0.4, 0.2])[0]
    seleccionados = random.choices(pool, weights=probs, k=n_platos)

    # Eliminar duplicados manteniendo orden
    vistos = set()
    unicos = []
    for p in seleccionados:
        if p["id"] not in vistos:
            vistos.add(p["id"])
            unicos.append(p)

    return [
        {**p, "cantidad": random.choices([1, 2], weights=[0.8, 0.2])[0]}
        for p in unicos
    ]


def es_cancelado(fecha: datetime) -> bool:
    """
    Tasa de cancelación base 8%, sube a 15% en horas no pico
    y baja a 5% los fines de semana.
    """
    hora = fecha.hour
    dow  = fecha.weekday()
    if dow in (5, 6):
        return random.random() < 0.05
    if 12 <= hora <= 14 or 18 <= hora <= 21:
        return random.random() < 0.08
    return random.random() < 0.15


def calcular_pedidos_del_dia(fecha: datetime) -> int:
    """
    Número de pedidos a generar para un día dado,
    aplicando factor de día y de crecimiento mensual.
    """
    base   = 8   # pedidos base por día
    factor = factor_dia_semana(fecha) * factor_crecimiento_mes(fecha)
    return max(1, round(base * factor + random.randint(-2, 2)))


# ============================================================
#  Generación de registros
# ============================================================

def generar_todos_los_pedidos() -> list[dict]:
    """
    Genera todos los pedidos para el período completo.
    Devuelve lista de dicts con toda la info necesaria
    para insertar en Postgres o Mongo.
    """
    pedidos = []
    fecha_actual = FECHA_INI

    pedido_id = 100   # empieza en 100 para no chocar con el seed

    while fecha_actual <= FECHA_FIN:
        n_pedidos = calcular_pedidos_del_dia(fecha_actual)

        for _ in range(n_pedidos):
            rest    = random.choice(RESTAURANTES)
            usuario = random.choice(USUARIOS)
            platos  = elegir_platos_para_pedido(rest["id"])
            fecha   = generar_fecha_hora(fecha_actual)
            estado  = 2 if es_cancelado(fecha) else 1

            # Tipo: delivery más probable en horas pico y fines de semana
            tipo = random.choices([1, 2], weights=[0.6, 0.4])[0]

            # Geoloc de entrega: coordenadas del usuario con pequeño offset
            lat_entrega = usuario["lat"] + random.uniform(-0.005, 0.005)
            lon_entrega = usuario["lon"] + random.uniform(-0.005, 0.005)

            subtotales = [p["precio"] * p["cantidad"] for p in platos]
            precio_total = sum(subtotales)

            pedido = {
                "id":               pedido_id,
                "id_usuario":       usuario["id"],
                "id_restaurante":   rest["id"],
                "fecha_hora":       fecha,
                "id_tipo_pedido":   tipo,
                "id_estado_pedido": estado,
                "precio_total":     precio_total,
                "latitud_entrega":  round(lat_entrega, 7),
                "longitud_entrega": round(lon_entrega, 7),
                "descripcion":      None,
                "platos": [
                    {
                        "id_plato": p["id"],
                        "nombre":   p["nombre"],
                        "categoria":p["categoria"],
                        "cantidad": p["cantidad"],
                        "precio":   p["precio"],
                        "subtotal": p["precio"] * p["cantidad"],
                    }
                    for p in platos
                ],
            }
            pedidos.append(pedido)
            pedido_id += 1

        fecha_actual += timedelta(days=1)

    logger.info(f"Total pedidos generados: {len(pedidos)}")
    return pedidos


def generar_reservaciones() -> list[dict]:
    """
    Genera reservaciones distribuidas en el mismo período.
    ~40% de los días de semana tienen reservaciones.
    """
    reservaciones = []
    res_id = 100
    fecha_actual = FECHA_INI

    while fecha_actual <= FECHA_FIN:
        # Más reservaciones viernes y sábado
        prob = 0.7 if fecha_actual.weekday() in (4, 5) else 0.4

        if random.random() < prob:
            n = random.randint(1, 3)
            for _ in range(n):
                rest    = random.choice(RESTAURANTES)
                usuario = random.choice(USUARIOS)
                mesa    = random.choice([m for m in MESAS if m["id_restaurante"] == rest["id"]])
                hora    = hora_aleatoria_con_pico()
                fecha   = fecha_actual.replace(hour=hora, minute=random.randint(0, 45))
                estado  = 2 if random.random() < 0.12 else 1   # 12% cancelación

                reservaciones.append({
                    "id":                   res_id,
                    "id_usuario":           usuario["id"],
                    "id_restaurante":       rest["id"],
                    "id_mesa":              mesa["id"],
                    "mesa_num":             mesa["num_mesa"],
                    "capacidad_mesa":       mesa["capacidad"],
                    "fecha_hora":           fecha,
                    "duracion":             random.choice([45, 60, 90, 120]),
                    "cant_personas":        random.randint(1, mesa["capacidad"]),
                    "id_estado_reservacion":estado,
                })
                res_id += 1

        fecha_actual += timedelta(days=1)

    logger.info(f"Total reservaciones generadas: {len(reservaciones)}")
    return reservaciones


# ============================================================
#  Inserción en PostgreSQL
# ============================================================

def insertar_postgres(pedidos: list[dict], reservaciones: list[dict]):
    import psycopg2
    import psycopg2.extras

    conn = psycopg2.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        port=int(os.environ.get("DB_PORT", 5432)),
        user=os.environ.get("DB_USER", "postgres"),
        password=os.environ.get("DB_PASSWORD", "postgres"),
        database=os.environ.get("DB_NAME", "restaurantdb"),
        options="-c search_path=restaurant",
    )
    cur = conn.cursor()

    if RESET:
        logger.info("RESET=true — limpiando pedidos y reservaciones de prueba...")
        cur.execute("DELETE FROM plato_x_pedido WHERE id_pedido >= 100")
        cur.execute("DELETE FROM pedido WHERE id >= 100")
        cur.execute("DELETE FROM reservacion WHERE id >= 100")
        conn.commit()

    logger.info("Insertando pedidos en Postgres...")
    batch_pedidos   = []
    batch_detalles  = []

    for p in pedidos:
        batch_pedidos.append((
            p["id"],
            p["id_usuario"],
            p["id_restaurante"],
            p["descripcion"],
            p["precio_total"],
            p["fecha_hora"],
            p["latitud_entrega"],
            p["longitud_entrega"],
            p["id_estado_pedido"],
            p["id_tipo_pedido"],
        ))
        for pl in p["platos"]:
            batch_detalles.append((
                p["id"],
                pl["id_plato"],
                pl["cantidad"],
                pl["subtotal"],
            ))

    # Insertar pedidos en lotes
    psycopg2.extras.execute_values(
        cur,
        """
        INSERT INTO pedido
          (id, id_usuario, id_restaurante, descripcion, precio_total,
           fecha_hora, latitud_entrega, longitud_entrega,
           id_estado_pedido, id_tipo_pedido)
        VALUES %s
        ON CONFLICT (id) DO NOTHING
        """,
        batch_pedidos,
        page_size=200,
    )

    psycopg2.extras.execute_values(
        cur,
        """
        INSERT INTO plato_x_pedido (id_pedido, id_plato, cantidad, subtotal)
        VALUES %s
        ON CONFLICT DO NOTHING
        """,
        batch_detalles,
        page_size=500,
    )

    logger.info("Insertando reservaciones en Postgres...")
    batch_res = []
    for r in reservaciones:
        batch_res.append((
            r["id"],
            r["id_usuario"],
            r["id_restaurante"],
            r["id_mesa"],
            r["fecha_hora"],
            r["duracion"],
            r["cant_personas"],
            r["id_estado_reservacion"],
        ))

    psycopg2.extras.execute_values(
        cur,
        """
        INSERT INTO reservacion
          (id, id_usuario, id_restaurante, id_mesa,
           fecha_hora, duracion, cant_personas, id_estado_reservacion)
        VALUES %s
        ON CONFLICT (id) DO NOTHING
        """,
        batch_res,
        page_size=200,
    )

    conn.commit()
    cur.close()
    conn.close()
    logger.info(
        f"✅ Postgres: {len(pedidos)} pedidos, "
        f"{len(batch_detalles)} detalles, "
        f"{len(reservaciones)} reservaciones insertados."
    )


# ============================================================
#  Inserción en MongoDB
# ============================================================

def insertar_mongo(pedidos: list[dict], reservaciones: list[dict]):
    from pymongo import MongoClient, UpdateOne

    url    = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name= os.environ.get("MONGO_DB",  "restaurantdb")
    client = MongoClient(url)
    db     = client[db_name]

    if RESET:
        logger.info("RESET=true — limpiando colecciones de prueba...")
        db["pedidos"].delete_many({"_seed_id": {"$gte": 100}})
        db["reservaciones"].delete_many({"_seed_id": {"$gte": 100}})

    logger.info("Insertando pedidos en Mongo...")
    ops_pedidos = []
    for p in pedidos:
        doc = {
            "_seed_id":       p["id"],
            "id_usuario":     str(p["id_usuario"]),
            "id_restaurante": str(p["id_restaurante"]),
            "descripcion":    p["descripcion"],
            "tipo_pedido":    TIPOS_PEDIDO[p["id_tipo_pedido"]],
            "estado":         ESTADOS_PEDIDO[p["id_estado_pedido"]],
            "precio_total":   p["precio_total"],
            "createdAt":      p["fecha_hora"],
            "latitud_entrega":  p["latitud_entrega"],
            "longitud_entrega": p["longitud_entrega"],
            "platos": [
                {
                    "id_plato":  str(pl["id_plato"]),
                    "nombre":    pl["nombre"],
                    "categoria": pl["categoria"],
                    "cantidad":  pl["cantidad"],
                    "precio":    pl["precio"],
                    "subtotal":  pl["subtotal"],
                }
                for pl in p["platos"]
            ],
        }
        ops_pedidos.append(
            UpdateOne({"_seed_id": p["id"]}, {"$setOnInsert": doc}, upsert=True)
        )

    if ops_pedidos:
        res = db["pedidos"].bulk_write(ops_pedidos, ordered=False)
        logger.info(f"Mongo pedidos: {res.upserted_count} insertados.")

    logger.info("Insertando reservaciones en Mongo...")
    ops_res = []
    for r in reservaciones:
        doc = {
            "_seed_id":       r["id"],
            "id_usuario":     str(r["id_usuario"]),
            "id_restaurante": str(r["id_restaurante"]),
            "id_mesa":        str(r["id_mesa"]),
            "fecha":          r["fecha_hora"],
            "createdAt":      r["fecha_hora"],
            "personas":       r["cant_personas"],
            "duracion":       r["duracion"],
            "estado":         "reservada" if r["id_estado_reservacion"] == 1 else "cancelada",
        }
        ops_res.append(
            UpdateOne({"_seed_id": r["id"]}, {"$setOnInsert": doc}, upsert=True)
        )

    if ops_res:
        res = db["reservaciones"].bulk_write(ops_res, ordered=False)
        logger.info(f"Mongo reservaciones: {res.upserted_count} insertadas.")

    client.close()
    logger.info(
        f"✅ Mongo: {len(pedidos)} pedidos, "
        f"{len(reservaciones)} reservaciones procesados."
    )


# ============================================================
#  Resumen de lo que se va a generar
# ============================================================

def imprimir_resumen(pedidos: list[dict], reservaciones: list[dict]):
    from collections import Counter

    estados = Counter(
        ESTADOS_PEDIDO[p["id_estado_pedido"]] for p in pedidos
    )
    tipos = Counter(
        TIPOS_PEDIDO[p["id_tipo_pedido"]] for p in pedidos
    )
    por_rest = Counter(
        next(r["nombre"] for r in RESTAURANTES if r["id"] == p["id_restaurante"])
        for p in pedidos
    )
    horas = Counter(p["fecha_hora"].hour for p in pedidos)
    pico  = sum(v for h, v in horas.items() if 12 <= h <= 14 or 18 <= h <= 21)

    print("\n" + "="*55)
    print("  RESUMEN DE DATOS GENERADOS")
    print("="*55)
    print(f"  Período:          {FECHA_INI.date()} → {FECHA_FIN.date()}")
    print(f"  Pedidos totales:  {len(pedidos)}")
    print(f"  Reservaciones:    {len(reservaciones)}")
    print(f"  Motor destino:    {DB_ENGINE.upper()}")
    print(f"  RESET:            {RESET}")
    print()
    print("  Pedidos por estado:")
    for k, v in estados.items():
        print(f"    {k:<15} {v:>5}  ({v*100//len(pedidos)}%)")
    print()
    print("  Pedidos por tipo:")
    for k, v in tipos.items():
        print(f"    {k:<15} {v:>5}  ({v*100//len(pedidos)}%)")
    print()
    print("  Pedidos por restaurante:")
    for k, v in por_rest.items():
        print(f"    {k:<20} {v:>5}")
    print()
    print(f"  Pedidos en horas pico: {pico} ({pico*100//len(pedidos)}%)")
    print("="*55 + "\n")


# ============================================================
#  Main
# ============================================================

def main():
    logger.info(f"Generando datos de prueba para {DB_ENGINE.upper()}...")
    logger.info(f"Período: {FECHA_INI.date()} → {FECHA_FIN.date()}")

    pedidos       = generar_todos_los_pedidos()
    reservaciones = generar_reservaciones()

    imprimir_resumen(pedidos, reservaciones)

    if DB_ENGINE == "mongo":
        insertar_mongo(pedidos, reservaciones)
    else:
        insertar_postgres(pedidos, reservaciones)

    logger.info("✅ Datos de prueba generados e insertados correctamente.")


if __name__ == "__main__":
    main()