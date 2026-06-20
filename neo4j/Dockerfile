# neo4j/Dockerfile
# Imagen para el script de migración que lee datos de
# PostgreSQL o MongoDB y los carga en Neo4J.
#
# Es un script Node.js simple que corre una vez y termina.
# No es un servidor — no expone puertos.

FROM node:20-alpine

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar package.json primero para aprovechar el caché de Docker
# Si package.json no cambia, npm install no se vuelve a correr
COPY package.json ./

# Instalar dependencias
RUN npm install --omit=dev

# Copiar el código del script
COPY migrate.js ./
COPY routing/ ./routing/
# Comando que se ejecuta cuando el contenedor arranca
# El script lee de PG o Mongo y carga en Neo4J, luego termina
CMD ["node", "migrate.js"]