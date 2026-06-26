# Proyecto 2 — Sistema de Reserva Inteligente de Restaurantes con OLAP

**Curso:** Bases de Datos II  
**Institución:** Instituto Tecnológico de Costa Rica — Escuela de Ingeniería en Computación  
**Semestre:** I Semestre 2026  
**Profesor:** Kenneth Obando  
**Estudiantes:** Adrián Mora Rivera (2024800149) · Tamara Robles Camacho (2024099342)

---

## Tabla de contenido

- [Descripción general](#descripción-general)
- [Arquitectura](#arquitectura)
  - [Arquitectura lógica](#arquitectura-lógica)
  - [Arquitectura física](#arquitectura-física)
- [Microservicios](#microservicios)
- [Tecnologías utilizadas](#tecnologías-utilizadas)
- [Puertos expuestos](#puertos-expuestos)
- [Volúmenes persistentes](#volúmenes-persistentes)
- [Flujo de datos](#flujo-de-datos)
- [Análisis de grafos con Neo4J](#análisis-de-grafos-con-neo4j)
- [Asignación de rutas de entrega](#asignación-de-rutas-de-entrega)
- [Pipeline OLAP](#pipeline-olap)
- [Referencia de API](#referencia-de-api)
- [Comandos de operación](#comandos-de-operación)
- [Decisiones de diseño](#decisiones-de-diseño)
- [Anexos](#anexos)

---

## Descripción general

Este proyecto es continuación del Proyecto 1 (Sistema de Reserva Inteligente de Restaurantes). Sobre la arquitectura de microservicios existente se construyen nuevas capacidades de análisis de datos, análisis de grafos con Neo4J y asignación optimizada de rutas de entrega.

El diseño sigue principios **SOLID**, el patrón **DAO** para la abstracción de la capa de datos y el patrón **Strategy** para seleccionar dinámicamente el motor de base de datos mediante variables de entorno, sin modificar código fuente.

### Objetivos del Proyecto 1 (base)

- Arquitectura de microservicios con soporte para múltiples motores de base de datos (PostgreSQL / MongoDB)
- Búsqueda avanzada con ElasticSearch
- Caché distribuida con Redis
- Balanceo de carga con Nginx
- Autenticación con Keycloak (OAuth2/OIDC, JWT RS256)
- Pipeline CI/CD con GitHub Actions
- Escalabilidad con Kubernetes

### Objetivos adicionales del Proyecto 2

- Análisis OLAP con Apache Hive (esquema estrella)
- Procesamiento batch con Apache Spark
- Orquestación ETL con Apache Airflow
- Análisis de grafos con Neo4J (co-compras, usuarios influyentes, Dijkstra)
- Asignación optimizada de rutas de entrega
- Visualización con Apache Superset

---

## Arquitectura

### Arquitectura lógica

El sistema se compone de los siguientes módulos lógicos:

| Módulo | Descripción |
|---|---|
| **Gestión del dominio** | CRUD de usuarios, restaurantes, menús, pedidos y reservaciones |
| **Búsqueda y descubrimiento** | Búsqueda textual y por categoría sin afectar el módulo transaccional |
| **Control de acceso e identidad** | Autenticación, roles y emisión de tokens JWT |
| **Caché** | Almacenamiento temporal para optimizar tiempos de respuesta |
| **Análisis de relaciones y rutas** | Grafos de usuarios/pedidos/ubicaciones y rutas optimizadas |
| **Integración analítica (ETL)** | Extracción y carga hacia el Data Warehouse |
| **Procesamiento analítico** | Cálculos agregados e indicadores con Spark |
| **Visualización** | Dashboards interactivos con Superset |
| **Enrutamiento** | Punto único de entrada vía Nginx |

### Arquitectura física

El sistema se organiza en cinco capas de contenedores Docker:

**1. Capa externa**  
Nginx en el puerto 80 como único punto de entrada. Enruta `/api/` → API principal, `/search/` → búsqueda, `/grafos/` y `/rutas/` → rutas-service.

**2. Capa de aplicación**  
Tres microservicios independientes en Node.js: API CRUD (escalable con round-robin), search-service y rutas-service. Todos comparten Redis como caché distribuida.

**3. Capa de autenticación**  
Keycloak emite tokens JWT (RS256) y gestiona usuarios del realm `restaurant`. Usa su propia instancia de PostgreSQL aislada.

**4. Capa de datos**  
Motor intercambiable vía `DB_ENGINE`: PostgreSQL 16 o MongoDB 7 en configuración sharded (mongos + 3 config servers + shard con primario y dos secundarios). ElasticSearch indexa el catálogo de productos. Neo4J almacena el grafo de relaciones y ubicaciones de Cartago.

**5. Capa analítica (OLAP)**  
Airflow orquesta un pipeline ETL diario → Hive (esquema estrella, ORC + Snappy) → tres jobs de Spark → dashboards en Superset. Esta capa es agnóstica del motor OLTP activo.

---

## Microservicios

### API principal (puerto interno 3000)

- **Tecnología:** Node.js 20, Express 5
- **Imagen:** `ghcr.io/adrian-mora-05/tareacorta1-basesii:latest`
- **Escalabilidad:** horizontal con `--scale api=N`, Nginx distribuye con round-robin
- **BD:** PostgreSQL 16 o MongoDB 7 según `DB_ENGINE`
- **Autenticación:** JWT validado contra Keycloak en cada petición protegida
- **Caché:** Redis con patrón Cache-Aside

| Recurso | TTL | Invalidación |
|---|---|---|
| Restaurantes | 300 s | Al crear o modificar un restaurante |
| Menús | 180 s | Al crear, modificar o eliminar un menú |
| Resultados de búsqueda | 60 s | Al reindexar productos |

Estructura interna: `Controller → Service → DAOFactory → DAO`

### Microservicio de búsqueda — WS Search (puerto interno 4000)

- **Tecnología:** Node.js 20, Express, `@elastic/elasticsearch`
- **Motor de índice:** ElasticSearch 8.13, índice `products`
- Búsquedas con `multi_match` sobre `nombre`, `categoría` y `descripción` (ponderadas por relevancia)
- Completamente independiente de la API CRUD

### Microservicio de grafos y rutas — rutas-service (puerto interno 5000 / host 5050)

- **Tecnología:** Node.js 20, Express, `neo4j-driver 5.x`
- **Acceso vía Nginx:** `/grafos/**` y `/rutas/**`
- Consultas Cypher: co-compras, usuarios influyentes, Dijkstra
- Algoritmo de asignación de rutas: vecino más cercano
- Geolocalización simulada en 8 zonas reales de Cartago

### Nginx

- **Imagen:** `nginx:alpine`, puerto 80
- Algoritmo de balanceo: round-robin
- Oculta la topología interna al cliente externo

### Keycloak

- **Imagen:** `quay.io/keycloak/keycloak:24.0`, puerto 8080
- Realm: `restaurant` · Roles: `admin`, `cliente`
- Tokens JWT con RS256, endpoint JWKS para validación sin estado

### Redis

- **Imagen:** `redis:7-alpine`, puerto 6379
- Política de eviction: `allkeys-lru` · Límite: 256 MB
- Compartido por todas las instancias de la API para consistencia del caché

### MongoDB (sharded)

- **Imagen:** `mongo:7`
- Topología: 1 mongos + 3 config servers + 1 shard (rs0) con primario y 2 secundarios
- Shard key: `id_restaurante` (hashed) en colecciones `pedidos` y `reservaciones`
- `mongo-init` configura el replica set y sharding de forma idempotente con `MERGE`

### ElasticSearch

- **Imagen:** `docker.elastic.co/elasticsearch/elasticsearch:8.13.0`, puerto 9200
- Single-node, seguridad deshabilitada (entorno académico)

### Neo4J

- **Imagen:** `neo4j:5.18`
- Puerto HTTP: 7474 · Puerto Bolt: 7687
- Plugins: APOC + Graph Data Science (GDS)

---

## Tecnologías utilizadas

| Tecnología | Versión | Rol |
|---|---|---|
| Node.js | 20 LTS | Runtime de los microservicios |
| Express | 5.x | Framework HTTP |
| PostgreSQL | 16 | Base de datos relacional principal |
| MongoDB | 7 | Base de datos documental alternativa |
| ElasticSearch | 8.x | Motor de búsqueda textual |
| Redis | 7 | Caché distribuida |
| Keycloak | 24.0 | Servidor de identidad OAuth2/OIDC |
| Nginx | Alpine | Proxy inverso y balanceador de carga |
| Docker | 24+ | Contenedorización |
| Docker Compose | v2 | Orquestación local |
| GitHub Actions | — | Pipeline CI/CD |
| Jest | 29 | Pruebas unitarias e integración |
| Neo4J | 5.18 | Base de datos de grafos |
| neo4j-driver | 5.x | Driver Node.js para Neo4J |
| APOC | plugin | Utilidades Neo4J |
| Graph Data Science | plugin | Dijkstra y algoritmos de grafos |
| Apache Hive | 4.0.0 | Data Warehouse (esquema estrella) |
| Apache Spark | 3.5.6 | Procesamiento batch |
| Apache Airflow | 2.9.1 | Orquestación ETL |
| Apache Superset | 3.1.0 | Dashboards de visualización |

---

## Puertos expuestos

### Docker Compose

| Contenedor | Puerto interno | Puerto host | Descripción |
|---|---|---|---|
| nginx | 80 | 80 | Punto de entrada único |
| api | 3000 | — | Solo vía Nginx |
| search-service | 4000 | — | Solo vía Nginx |
| rutas-service | 5000 | 5050 | Grafos y rutas |
| keycloak | 8080 | 8080 | Consola y endpoint de tokens |
| db_api | 5432 | 5435 | PostgreSQL de la aplicación |
| db_keycloak | 5432 | 5433 | PostgreSQL de Keycloak |
| mongo1/2/3 | 27017 | 27017–27019 | MongoDB replica set |
| redis | 6379 | 6379 | Caché |
| elasticsearch | 9200 | 9200 | Motor de búsqueda |
| neo4j | 7474/7687 | 7474/7687 | Browser y Bolt |
| airflow-webserver | 8080 | 8090 | UI de Airflow |
| hive-server | 10000/10002 | 10000/10002 | JDBC y Web UI |
| spark-master | 8080/7077 | 8081/7077 | UI y cluster endpoint |
| superset | 8088 | 8089 | Dashboards |

### URLs de acceso (Docker Compose)

| Servicio | URL | Credenciales |
|---|---|---|
| API REST | http://localhost:3000 | JWT vía Keycloak |
| Nginx | http://localhost:80 | — |
| Keycloak | http://localhost:8080 | admin / admin |
| Neo4J Browser | http://localhost:7474 | neo4j / password123 |
| rutas-service | http://localhost:5050 | — |
| Airflow UI | http://localhost:8090 | admin / admin |
| Hive Web UI | http://localhost:10002 | — |
| Spark Master UI | http://localhost:8081 | — |
| Superset | http://localhost:8089 | admin / admin |

---

## Volúmenes persistentes

El sistema usa volúmenes Docker nombrados (no bind mounts) en dos categorías:

- **Operacionales:** datos de la aplicación en tiempo real (BD, índices, caché, auth)
- **Analíticos:** Data Warehouse, metadatos de Hive, logs de Airflow, dashboards de Superset

> El volumen `hive_warehouse_data` es compartido entre `hive-server`, `spark-master` y `spark-worker` porque Spark lee y escribe directamente los archivos ORC sin pasar por HiveServer2.

---

## Flujo de datos

### CRUD con caché Redis (Cache-Aside)

```
Cliente → Nginx :80 → API :3000
  → checkJwt (Keycloak JWKS)
  → Redis (HIT → respuesta inmediata | MISS → consulta BD → guarda en Redis TTL=300s)
  → Respuesta JSON al cliente
```

### Búsqueda con ElasticSearch

```
Cliente → Nginx :80 → search-service :4000
  → Query multi_match (nombre · categoría · descripción)
  → ElasticSearch :9200
  → Resultados ordenados por relevancia
```

### Grafos y rutas (Neo4J)

```
Cliente → Nginx :80 → rutas-service :5000
  → Lee pedidos pendientes (PostgreSQL o MongoDB según DB_ENGINE)
  → Consulta Neo4J :7687 (distancias con Dijkstra / GDS)
  → Vecino más cercano por repartidor
  → Ruta optimizada + distancia total como JSON
```

---

## Análisis de grafos con Neo4J

### Modelo del grafo

**Nodos:**

| Nodo | Propiedades |
|---|---|
| Usuario | id, nombre, correo, rol |
| Pedido | id, descripcion, id_restaurante |
| Plato | id, nombre, categoria, precio, descripcion |
| Restaurante | id, nombre, direccion |
| Ubicacion | id, nombre, lat, lng |

**Relaciones:**

| Relación | De → A | Propiedades |
|---|---|---|
| HIZO | Usuario → Pedido | — |
| CONTIENE | Pedido → Plato | cantidad |
| ES_DE | Pedido → Restaurante | — |
| RECOMIENDA | Usuario → Usuario | — |
| CONECTA | Ubicacion → Ubicacion | distancia_km, tiempo_min |

### Ubicaciones de Cartago

| Zona | Latitud | Longitud |
|---|---|---|
| Cartago Centro | 9.8647 | -83.9192 |
| Tres Ríos | 9.9003 | -83.9917 |
| La Unión | 9.9086 | -83.9614 |
| San Diego | 9.8891 | -83.9456 |
| Paraíso | 9.8358 | -83.8650 |
| El Tejar | 9.8514 | -83.9758 |
| San Rafael | 9.9200 | -83.9300 |
| Agua Caliente | 9.8750 | -83.9050 |

### Consultas Cypher implementadas

**Co-compras — 5 pares de platos más comprados juntos:**
```cypher
MATCH (p1:Plato)<-[:CONTIENE]-(ped:Pedido)-[:CONTIENE]->(p2:Plato)
WHERE id(p1) < id(p2)
RETURN p1.nombre, p2.nombre, COUNT(ped) AS vecesJuntos
ORDER BY vecesJuntos DESC
LIMIT 5
```

**Usuarios influyentes:**
```cypher
MATCH (u1:Usuario)-[:RECOMIENDA]->(u2:Usuario)
RETURN u1.nombre, COUNT(u2) AS totalRecomendados, COLLECT(u2.nombre) AS recomiendaA
ORDER BY totalRecomendados DESC
```

**Camino mínimo con Dijkstra (GDS):**
```cypher
MATCH (inicio:Ubicacion { id: $origen })
MATCH (fin:Ubicacion { id: $destino })
CALL gds.shortestPath.dijkstra.stream('rutasGraph', {
  sourceNode: inicio,
  targetNode: fin,
  relationshipWeightProperty: 'distancia_km'
})
YIELD nodeIds, costs
RETURN [id IN nodeIds | gds.util.asNode(id).id] AS paradas, costs[-1] AS kmTotales
```

### Migración de datos

```bash
docker compose \
  -f deploy/local/docker/docker-compose.neo4j.yml \
  --project-directory . \
  run neo4j-migrate
```

El script usa `MERGE` para garantizar idempotencia (puede correrse múltiples veces sin duplicar datos).

---

## Asignación de rutas de entrega

El módulo distribuye pedidos pendientes entre repartidores y calcula el orden óptimo de visita.

**Flujo:**
1. Leer pedidos pendientes de la BD activa
2. Simular geolocalización asignando una de las 8 zonas de Cartago a cada pedido
3. Distribuir pedidos entre repartidores con round-robin (carga equitativa)
4. Para cada repartidor, aplicar **algoritmo de vecino más cercano**
5. Consultar Neo4J para distancias reales (conexión directa o Dijkstra si no hay arista directa)
6. Retornar ruta optimizada y distancia total por repartidor

**Vecino más cercano:**
- Partir desde la ubicación base del repartidor
- Visitar siempre el punto no visitado más cercano
- Acumular la distancia total en km

> No garantiza la solución óptima global, pero produce resultados razonables en tiempo lineal — apropiado para respuesta en tiempo real.

---

## Pipeline OLAP

### Arquitectura ETL

```
OLTP (PostgreSQL / MongoDB)
  → Apache Airflow (DAG diario 02:00 AM)
  → Apache Hive (Data Warehouse, esquema estrella, ORC + Snappy)
  → Apache Spark (3 jobs de análisis)
  → Apache Superset (3 dashboards)
```

La capa analítica es **agnóstica del motor OLTP**: el mismo DAG, el mismo esquema y los mismos dashboards funcionan con PostgreSQL y MongoDB.

### DAG `restaurant_pipeline` — tareas en orden

| Tarea | Tipo | Descripción |
|---|---|---|
| branch_engine | BranchPythonOperator | Lee DB_ENGINE y bifurca la extracción |
| extract_postgres | PythonOperator | Extrae desde PostgreSQL |
| extract_mongo | PythonOperator | Extrae desde MongoDB (rama alternativa) |
| join | PythonOperator | Converge las ramas |
| unify | PythonOperator | Normaliza el schema de salida |
| load_dims | PythonOperator | Carga las 6 dimensiones con INSERT OVERWRITE |
| load_facts | PythonOperator | TRUNCATE + INSERT INTO en fact_pedido y fact_reservacion |
| spark_tendencias_consumo | PythonOperator | Ingresos por mes/categoría, variación MoM |
| spark_horarios_pico | PythonOperator | Demanda por hora y día de semana |
| spark_crecimiento_mensual | PythonOperator | MoM, YTD y tasa de cancelación |
| reindex_elasticsearch | PythonOperator | Reindexación del catálogo de productos |

El DAG es **idempotente**: cada ejecución limpia y recarga los datos completos.

### Data Warehouse — esquema estrella

**Tablas de hechos:**
- `fact_pedido` — una fila por ítem de pedido, particionada por año y mes
- `fact_reservacion` — una fila por reservación, particionada por año y mes

**Dimensiones:**
- `dim_tiempo` — fecha, hora, día de semana, mes, trimestre, indicadores de hora pico y fin de semana
- `dim_restaurante` — nombre, coordenadas y zona geográfica
- `dim_usuario` — nombre, correo, rol y zona
- `dim_plato` — nombre, categoría y precio unitario
- `dim_tipo_pedido` — para llevar / comer aquí
- `dim_estado_pedido` — completado / cancelado

> Las columnas `id_pedido_origen` e `id_plato_origen` son `STRING` para soportar tanto IDs enteros de PostgreSQL como ObjectIds de MongoDB sin truncamiento.

### Jobs de Spark

| Job | Tablas resultado generadas |
|---|---|
| `tendencias_consumo.py` | `resultado_tendencias_mes_categoria`, `resultado_top_platos_mes` |
| `horarios_pico.py` | `resultado_demanda_por_hora`, `resultado_pico_dia_semana`, `resultado_fin_semana_vs_semana`, `resultado_ocupacion_mesas_horaria` |
| `crecimiento_mensual.py` | `resultado_crecimiento_mensual`, `resultado_crecimiento_ytd`, `resultado_tasa_cancelacion_mensual`, `resultado_crecimiento_tipo_pedido` |

### Dashboards de Superset

| Dashboard | Fuente de datos | Charts |
|---|---|---|
| Ingresos por mes y categoría | resultado_tendencias_mes_categoria | Bar chart apilado, pie chart, big number de ingreso acumulado |
| Actividad de clientes por zona | v_actividad_zona | Bar chart por zona, big number clientes únicos, tabla |
| Pedidos completados vs cancelados | resultado_tasa_cancelacion_mensual | Bar chart apilado, pie chart, big number tasa cancelación |

---

## Referencia de API

Todos los endpoints son accesibles vía Nginx en el puerto 80.

### API principal — `/api/`

Requiere `Authorization: Bearer <token>` en todos los endpoints excepto registro y login.

| Grupo | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `POST /api/auth/login` |
| Usuarios | `GET /api/users/me`, `PUT /api/users/:id`, `DELETE /api/users/:id` |
| Restaurantes | `POST /api/restaurants`, `GET /api/restaurants` |
| Menús | `POST /api/menus`, `GET /api/menus/:id`, `PUT /api/menus/:id`, `DELETE /api/menus/:id` |
| Reservaciones | `POST /api/reservations`, `DELETE /api/reservations/:id` |
| Pedidos | `POST /api/orders`, `GET /api/orders/:id` |

### Microservicio de búsqueda — `/search/`

No requiere autenticación.

- `GET /search/products?q=texto` — búsqueda textual
- `GET /search/products/category/:cat` — filtro por categoría
- `POST /search/reindex` — reindexar catálogo en ElasticSearch

### Microservicio de grafos y rutas — `/grafos/` y `/rutas/`

No requiere autenticación.

- `GET /grafos/co-compras` — 5 pares de platos más comprados juntos
- `GET /grafos/usuarios-influyentes` — usuarios por cantidad de recomendaciones
- `GET /grafos/camino-minimo?origen=X&destino=Y` — camino mínimo entre zonas
- `POST /rutas/asignar` — asignar pedidos a repartidores con ruta optimizada

### Autenticación

```
Authorization: Bearer <access_token>
```

El token se obtiene con `POST /api/auth/login` y tiene duración de 300 segundos.

---

## Comandos de operación

> Los comandos asumen que el directorio de trabajo es la raíz del repositorio y que Docker Desktop tiene al menos 8 GB de RAM asignados.

### Stack principal con PostgreSQL

```bash
# Levantar
docker compose --project-directory . \
  -f deploy/local/docker/docker-compose.postgres.yml \
  up -d

# Detener
docker compose --project-directory . \
  -f deploy/local/docker/docker-compose.postgres.yml \
  down
```

### Stack principal con MongoDB

```bash
# Levantar
docker compose --project-directory . \
  -f deploy/local/docker/docker-compose.mongo.yml \
  up -d

# Verificar que mongo-init completó el sharding
docker logs mongo-init --tail 5
# Debe mostrar: === mongo-init completado ===

# Detener
docker compose --project-directory . \
  -f deploy/local/docker/docker-compose.mongo.yml \
  down
```

### Stack analítico OLAP

```bash
# Copiar driver JDBC de PostgreSQL al volumen de Hive (solo una vez)
docker run --rm \
  -v "${PWD}/analytics/hive/drivers/postgresql.jar:/source/postgresql.jar" \
  -v "proyecto2-basesii_hive_warehouse_data:/dest" \
  alpine sh -c "cp /source/postgresql.jar /dest/postgresql.jar && chmod 777 /dest"

# Levantar
docker compose --project-directory . \
  -f deploy/local/docker/docker-compose.analytics.yml \
  up -d

# Inicializar star schema de Hive (solo la primera vez)
docker compose --project-directory . \
  -f deploy/local/docker/docker-compose.analytics.yml \
  run --rm hive-init
```

### Stack Neo4J y rutas-service

```bash
# Levantar
docker compose --project-directory . \
  -f deploy/local/docker/docker-compose.neo4j.yml \
  up -d neo4j rutas-service

# Cargar ubicaciones de Cartago (solo la primera vez)
docker compose --project-directory . \
  -f deploy/local/docker/docker-compose.neo4j.yml \
  exec neo4j cypher-shell -u neo4j -p password123 \
  -f /var/lib/neo4j/import/ubicaciones.cypher

# Migrar datos del OLTP a Neo4J
docker compose --project-directory . \
  -f deploy/local/docker/docker-compose.neo4j.yml \
  run neo4j-migrate
```

### Cambiar entre motores de base de datos

```bash
# 1. Pausar el DAG
docker exec airflow-scheduler airflow dags pause restaurant_pipeline

# 2. Editar .env: cambiar DB_ENGINE=postgres <-> DB_ENGINE=mongodb

# 3. Bajar el stack actual y levantar el nuevo
docker compose --project-directory . -f deploy/local/docker/docker-compose.postgres.yml down
docker compose --project-directory . -f deploy/local/docker/docker-compose.mongo.yml up -d

# 4. Reiniciar el scheduler y despausar el DAG
docker rm -f airflow-scheduler
docker compose --project-directory . -f deploy/local/docker/docker-compose.analytics.yml up airflow-scheduler -d
docker exec airflow-scheduler airflow dags unpause restaurant_pipeline
docker exec airflow-scheduler airflow dags trigger restaurant_pipeline
```

### Gestión del DAG de Airflow

```bash
docker exec airflow-scheduler airflow dags pause restaurant_pipeline
docker exec airflow-scheduler airflow dags unpause restaurant_pipeline
docker exec airflow-scheduler airflow dags trigger restaurant_pipeline
docker exec airflow-scheduler airflow dags list-runs -d restaurant_pipeline --state success
```

### Generación de datos de prueba

```bash
# PostgreSQL
DB_ENGINE=postgres python db/seed/generate_test_data.py

# MongoDB
DB_ENGINE=mongodb MONGO_URL=mongodb://localhost:27017/ MONGO_DB=restaurantdb \
  python db/seed/generate_test_data.py

# Con reset de datos anteriores
RESET=true python db/seed/generate_test_data.py
```

### Kubernetes

```bash
# Primer despliegue
cd deploy/local/k8s
.\deploy.ps1 -Clean   # -Clean elimina el cluster anterior

# Despliegue incremental
.\deploy.ps1
.\apply-analytics.ps1
.\apply-neo4j.ps1

# Port-forwards para acceso desde host
minikube tunnel
kubectl port-forward svc/keycloak-service 9999:8080 -n restaurantes
kubectl port-forward svc/neo4j-service 7474:7474 -n restaurantes
kubectl port-forward svc/airflow-webserver 8090:8080 -n restaurantes
kubectl port-forward svc/superset 8089:8088 -n restaurantes

# Escalar servicios
kubectl scale deployment api --replicas=5 -n restaurantes
kubectl get pods -n restaurantes

# Limpiar todo
minikube delete
```

### CI/CD

El pipeline de GitHub Actions se ejecuta en cada push a cualquier rama:

| Job | Condición | Descripción |
|---|---|---|
| Pruebas unitarias | Siempre | Tests en `tests/unit/` con cobertura mínima del 90% |
| Pruebas de integración | Job 1 exitoso | Levanta PostgreSQL y Redis, ejecuta `tests/integration/` |
| Build y Push Docker | Solo rama `main` | Construye y publica la imagen en GitHub Container Registry |

---

## Decisiones de diseño

### Arquitectura

- **Patrón DAO con DAOFactory:** el único punto donde se evalúa `DB_ENGINE` es `DAOFactory.js`. Los servicios reciben el DAO ya instanciado sin saber el motor subyacente (principio DIP de SOLID).
- **search-service separado:** ElasticSearch consume más recursos que la API CRUD; separarlo permite escalar ambos de forma independiente.
- **rutas-service como microservicio único para grafos y rutas:** comparten fuente de datos (Neo4J) y lógica relacionada. No implementa el patrón DAO completo porque solo necesita una lectura simple de pedidos pendientes.
- **Archivos Compose separados para Neo4J y analytics:** se levantan bajo demanda, sin engordar el stack principal.

### Base de datos y persistencia

- **Replica Set MongoDB (1 primario + 2 secundarios):** alta disponibilidad con failover automático.
- **MERGE en Neo4J:** idempotencia garantizada en migraciones.
- **Geolocalización simulada:** 8 zonas reales de Cartago con coordenadas y distancias reales, sin necesidad de servicio externo de mapas.
- **IDs como STRING en Hive:** soporta IDs enteros de PostgreSQL y ObjectIds de MongoDB sin truncamiento.

### Rendimiento

- **Nginx como único punto de entrada:** escalado horizontal transparente con round-robin.
- **Cache-Aside con Redis:** invalidación por evento con `deletePattern`, compartido entre todas las instancias de la API.
- **Tablas `resultado_*` precalculadas por Spark:** los dashboards responden en menos de 2 segundos, evitando el overhead de inicialización de Tez (10–15 s) en consultas en tiempo real.

### Orquestación

- **DAG idempotente:** `INSERT OVERWRITE` en dimensiones y `TRUNCATE + INSERT INTO` en hechos. Triggerearlo múltiples veces produce el mismo resultado final sin duplicados.
- **Hive Metastore con PostgreSQL dedicado:** aislado de la BD de la aplicación y de Keycloak.

---

## Anexos

- **Anexo A — Video demo (Etapa 3):** https://youtu.be/6CSnCE1wCcg
- **Anexo B — Documentación completa de API:** `docs/Anexo Referencia API.pdf` en el repositorio
- **Anexo C — Video demo (Etapa 2):** https://youtu.be/vNMVTh52BFw
