#!/usr/bin/env bash
# Corre las operaciones CRUD por el mongos y guarda la salida y la distribucion
cd "$(dirname "$0")"
docker cp scripts/06-crud.js mflix-mongos:/tmp/crud.js
docker exec mflix-mongos mongosh --quiet /tmp/crud.js | tee evidencias/salida-crud.txt
./scripts/evidencia.sh despues-del-crud
