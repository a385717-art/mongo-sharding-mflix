// Habilita sharding en sample_mflix y shardea movies con id_movie hashed
// Uso: mongosh --port 27117 scripts/05-shardear.js

const ns = "sample_mflix.movies";
db = db.getSiblingDB("sample_mflix");

sh.enableSharding("sample_mflix");

// como la coleccion ya tiene datos hay que crear el indice antes
db.movies.createIndex({ id_movie: "hashed" });

const yaSharded = db.getSiblingDB("config").collections.findOne({ _id: ns });
if (yaSharded) {
  print(ns + " ya estaba shardeada con key " + JSON.stringify(yaSharded.key));
} else {
  printjson(sh.shardCollection(ns, { id_movie: "hashed" }));
}

// La coleccion pesa como 33 MB y el chunk default es de 128 MB, entonces todo se
// queda en un solo shard. Bajamos el chunk a 1 MB para que el balancer reparta.
db.adminCommand({ configureCollectionBalancing: ns, chunkSize: 1 });
sh.startBalancer();

// esperar a que el balancer termine de repartir
print("esperando al balancer...");
let intentos = 0;
while (!sh.balancerCollectionStatus(ns).balancerCompliant && intentos < 120) {
  sleep(5000);
  intentos++;
}
print("balancerCompliant: " + sh.balancerCollectionStatus(ns).balancerCompliant);

// chunks por shard
db.getSiblingDB("config").chunks.aggregate([
  { $lookup: { from: "collections", localField: "uuid", foreignField: "uuid", as: "c" } },
  { $match: { "c._id": ns } },
  { $group: { _id: "$shard", chunks: { $sum: 1 } } },
  { $sort: { _id: 1 } }
]).forEach(x => print("  " + x._id + ": " + x.chunks + " chunks"));
