#!/usr/bin/env bash
# Importa sample_mflix.movies al cluster (siempre por el mongos)
#
# Opcion 1 (default): desde el json exportado
#   ./scripts/03-importar-datos.sh [ruta/al/archivo.json]
# Opcion 2: directo desde Atlas con mongodump/mongorestore
#   ATLAS_URI="mongodb+srv://..." ./scripts/03-importar-datos.sh
# Para volver a importar aunque ya haya datos: FORZAR=1

cd "$(dirname "$0")/.."
JSON=${1:-../Docker-Compose/sample_mflix.movies.json}

total=$(docker exec mflix-mongos mongosh --quiet --eval 'db.getSiblingDB("sample_mflix").movies.countDocuments()')
if [ "$total" -gt 0 ] && [ "$FORZAR" != "1" ]; then
  echo "movies ya tiene $total documentos, no se importa nada (usar FORZAR=1 para reimportar)"
  exit 0
fi

if [ -n "$ATLAS_URI" ]; then
  echo "importando desde Atlas..."
  # la uri se pasa como variable de entorno para que no quede en ningun archivo
  docker run --rm --network mflix_mflix-net -e ATLAS_URI mongo:7.0 sh -c '
    mongodump --uri "$ATLAS_URI" --db sample_mflix --collection movies --archive |
    mongorestore --host mongos:27017 --archive --drop --nsInclude "sample_mflix.movies"'
else
  if [ ! -f "$JSON" ]; then
    echo "no encontre el archivo $JSON"
    exit 1
  fi
  echo "importando desde $JSON ..."
  docker cp "$JSON" mflix-mongos:/tmp/movies.json
  docker exec mflix-mongos mongoimport --host localhost:27017 \
    --db sample_mflix --collection movies --drop --jsonArray --file /tmp/movies.json
  docker exec mflix-mongos rm /tmp/movies.json
fi

docker exec mflix-mongos mongosh --quiet --eval '
  const n = db.getSiblingDB("sample_mflix").movies.countDocuments();
  print("documentos en sample_mflix.movies: " + n);'
