#!/usr/bin/env bash
# Guarda sh.status() y getShardDistribution() en evidencias/<nombre>.txt
# Uso: ./scripts/evidencia.sh despues-del-crud

cd "$(dirname "$0")/.."
NOMBRE=${1:-estado}
ARCHIVO="evidencias/$NOMBRE.txt"
mkdir -p evidencias

# primero esperamos a que los shards borren los documentos huerfanos que dejan
# las migraciones, si no getShardDistribution cuenta documentos de mas
echo -n "esperando a que no haya documentos huerfanos "
for i in $(seq 1 60); do
  huerfanos=$(docker exec mflix-mongos mongosh --quiet --eval '
    let n = 0;
    db.getSiblingDB("admin").aggregate([{ $shardedDataDistribution: {} }, { $match: { ns: "sample_mflix.movies" } }])
      .forEach(x => x.shards.forEach(s => n += s.numOrphanedDocs));
    print(n)')
  [ "$huerfanos" = "0" ] && break
  echo -n "."
  sleep 10
done
echo " ($huerfanos huerfanos)"

docker exec mflix-mongos mongosh --quiet --eval '
  print("Fecha: " + new Date().toISOString());
  print("MongoDB " + db.version() + " - conectado al mongos");

  print("\n########## Replica sets ##########");
  for (const s of db.adminCommand({ listShards: 1 }).shards) print(s._id + " -> " + s.host);
  print("config -> " + db.adminCommand({ getShardMap: 1 }).map.config);

  print("\n########## sh.status() ##########");
  print(sh.status());

  const movies = db.getSiblingDB("sample_mflix").movies;
  print("\n########## db.movies.getShardDistribution() ##########");
  print(movies.getShardDistribution());

  print("\n########## documentos por shard ($shardedDataDistribution) ##########");
  db.getSiblingDB("admin").aggregate([{ $shardedDataDistribution: {} }, { $match: { ns: "sample_mflix.movies" } }])
    .forEach(x => x.shards.forEach(s => print(s.shardName + ": " + s.numOwnedDocuments + " docs, huerfanos " + s.numOrphanedDocs)));
  print("total (countDocuments): " + movies.countDocuments());
' > "$ARCHIVO"

echo "guardado en $ARCHIVO"
