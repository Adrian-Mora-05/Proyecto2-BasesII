#!/bin/bash
# analytics/hive/scripts/init-metastore.sh

set -e

DRIVER_SRC="/opt/hive/data/warehouse/postgresql.jar"
DRIVER_DST="/tmp/postgresql.jar"

echo "=== Hive Metastore Init ==="

if [ ! -f "$DRIVER_DST" ]; then
    echo "Copiando driver PostgreSQL JDBC..."
    cp "$DRIVER_SRC" "$DRIVER_DST"
    echo "Driver copiado: $(ls -lh $DRIVER_DST)"
else
    echo "Driver ya existe: $(ls -lh $DRIVER_DST)"
fi

echo "Asegurando permisos de escritura en el warehouse..."
chmod -R 777 /opt/hive/data/warehouse 2>/dev/null || echo "No se pudo aplicar chmod (puede que ya esté OK)"

export HADOOP_CLASSPATH="$DRIVER_DST:$HADOOP_CLASSPATH"
export HIVE_AUX_JARS_PATH="$DRIVER_DST"

echo "HADOOP_CLASSPATH=$HADOOP_CLASSPATH"
echo "=== Arrancando Hive Metastore ==="
exec /entrypoint.sh