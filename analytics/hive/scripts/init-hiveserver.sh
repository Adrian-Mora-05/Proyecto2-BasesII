#!/bin/bash
# analytics/hive/scripts/init-hiveserver.sh

set -e

DRIVER_SRC="/opt/hive/data/warehouse/postgresql.jar"
DRIVER_DST="/tmp/postgresql.jar"

echo "=== Hive Server2 Init ==="

if [ ! -f "$DRIVER_DST" ]; then
    echo "Copiando driver PostgreSQL JDBC..."
    cp "$DRIVER_SRC" "$DRIVER_DST"
    echo "Driver copiado: $(ls -lh $DRIVER_DST)"
else
    echo "Driver ya existe: $(ls -lh $DRIVER_DST)"
fi

export HADOOP_CLASSPATH="$DRIVER_DST:$HADOOP_CLASSPATH"
export HIVE_AUX_JARS_PATH="$DRIVER_DST"

echo "=== Arrancando HiveServer2 ==="
exec /entrypoint.sh