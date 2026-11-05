#!/usr/bin/env bash
# Levanta todo el cluster desde cero (o lo vuelve a prender si ya existia)
# Uso: ./levantar.sh
set -e
cd "$(dirname "$0")"

# corre un .js de mongosh dentro del mongos
correr_js() {
  docker cp "$1" mflix-mongos:/tmp/script.js
  docker exec mflix-mongos mongosh --quiet /tmp/script.js
}

echo "== 1. contenedores =="
docker compose up -d

echo "== 2. replica sets =="
./scripts/01-iniciar-replicas.sh

echo "== 3. shards =="
./scripts/02-agregar-shards.sh

echo "== 4. importar datos =="
./scripts/03-importar-datos.sh

echo "== 5. id_movie =="
correr_js scripts/04-agregar-id_movie.js

echo "== 6. shardCollection =="
correr_js scripts/05-shardear.js
# la foto de como quedo justo despues de shardear (solo la primera vez)
[ -f evidencias/despues-de-shardear.txt ] || ./scripts/evidencia.sh despues-de-shardear

echo
echo "Cluster listo. Conectarse con: mongosh --port 27117"
echo "Para el CRUD: ./crud.sh"
