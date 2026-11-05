#!/usr/bin/env bash
# Agrega los 3 shards al cluster por medio del mongos

echo -n "esperando a mongos "
until docker exec mflix-mongos mongosh --quiet --eval 'db.adminCommand({ping:1}).ok' >/dev/null 2>&1; do
  echo -n "."
  sleep 2
done
echo " listo"

docker exec mflix-mongos mongosh --quiet --eval '
  const yaEstan = db.adminCommand({ listShards: 1 }).shards.map(s => s._id);
  const shards = {
    shard1: "shard1/shard1a:27017,shard1b:27017,shard1c:27017",
    shard2: "shard2/shard2a:27017,shard2b:27017,shard2c:27017",
    shard3: "shard3/shard3a:27017,shard3b:27017,shard3c:27017"
  };
  for (const [nombre, url] of Object.entries(shards)) {
    if (yaEstan.includes(nombre)) {
      print(nombre + " ya estaba agregado");
    } else {
      sh.addShard(url);
      print(nombre + " agregado");
    }
  }
  print("\nShards en el cluster:");
  db.adminCommand({ listShards: 1 }).shards.forEach(s => print("  " + s._id + " -> " + s.host));
'
