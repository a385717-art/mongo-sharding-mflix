// Operaciones CRUD sobre sample_mflix.movies, todo por el mongos
// Uso: mongosh --port 27117 scripts/06-crud.js

db = db.getSiblingDB("sample_mflix");

function titulo(t) {
  print("\n==================== " + t + " ====================");
}

// dice a que shard(s) fue la consulta segun el explain
function shardsDeConsulta(filtro) {
  const plan = db.movies.find(filtro).explain().queryPlanner.winningPlan;
  return plan.stage + " -> " + plan.shards.map(s => s.shardName).join(", ");
}

// si ya se habia corrido antes, borramos las peliculas de prueba
db.movies.deleteMany({ prueba: true });

// el siguiente id_movie disponible
const ultimo = db.movies.find().sort({ id_movie: -1 }).limit(1).toArray()[0].id_movie;
let sig = ultimo + 1;
print("ultimo id_movie: " + ultimo);
print("total antes del CRUD: " + db.movies.countDocuments());


// ---------------- CREATE ----------------
titulo("CREATE");

// insertOne
let r = db.movies.insertOne({
  id_movie: sig,
  title: "El Ultimo Commit",
  year: 2026,
  genres: ["Drama", "Comedy"],
  runtime: 98,
  directors: ["Diego Ibarra"],
  countries: ["Mexico"],
  imdb: { rating: 7.8, votes: 120 },
  prueba: true
});
print("insertOne -> id_movie " + sig + ", _id " + r.insertedId);
sig++;

// insertMany
const nuevas = [
  { title: "Shard de Medianoche", genres: ["Thriller"], rating: 6.9 },
  { title: "Replica en Chihuahua", genres: ["Drama"], rating: 8.1 },
  { title: "El Router Perdido", genres: ["Adventure"], rating: 5.2 },
  { title: "Balanceo de Carga", genres: ["Action"], rating: 4.7 },
  { title: "Config Server", genres: ["Sci-Fi"], rating: 7.3 },
  { title: "Hashed", genres: ["Horror"], rating: 3.9 },
  { title: "Chunk 404", genres: ["Comedy"], rating: 6.1 },
  { title: "La Llave del Shard", genres: ["Mystery"], rating: 8.5 },
  { title: "Mongos y Compania", genres: ["Comedy", "Family"], rating: 4.4 },
  { title: "Primary y Secondary", genres: ["Romance"], rating: 7.0 }
].map(p => ({
  id_movie: sig++,
  title: p.title,
  year: 2026,
  genres: p.genres,
  runtime: 90,
  countries: ["Mexico"],
  imdb: { rating: p.rating, votes: 50 },
  prueba: true
}));
r = db.movies.insertMany(nuevas);
print("insertMany -> " + Object.keys(r.insertedIds).length + " peliculas");

// en que shard quedo cada pelicula nueva
print("\nshard de cada pelicula nueva:");
db.movies.find({ prueba: true }, { _id: 0, id_movie: 1, title: 1 }).sort({ id_movie: 1 }).forEach(p => {
  print("  " + p.id_movie + "  " + p.title.padEnd(22) + shardsDeConsulta({ id_movie: p.id_movie }));
});
print("\ntotal despues de insertar: " + db.movies.countDocuments());


// ---------------- READ ----------------
titulo("READ");

// por id_movie (usa la shard key, va a un solo shard)
print("find por id_movie = 100:");
printjson(db.movies.findOne({ id_movie: 100 }, { _id: 0, id_movie: 1, title: 1, year: 1, genres: 1 }));
print("consulta: " + shardsDeConsulta({ id_movie: 100 }));

// por titulo (no es shard key, el mongos pregunta a todos los shards)
print("\nfind por titulo = 'The Godfather':");
db.movies.find({ title: "The Godfather" }, { _id: 0, id_movie: 1, title: 1, year: 1, "imdb.rating": 1 })
  .forEach(p => printjson(p));
print("consulta: " + shardsDeConsulta({ title: "The Godfather" }));

// por año
print("\nfind por año = 1994 (primeras 5 por rating):");
db.movies.find({ year: 1994, "imdb.rating": { $type: "number" } }, { _id: 0, id_movie: 1, title: 1, "imdb.rating": 1 })
  .sort({ "imdb.rating": -1 }).limit(5).forEach(p => print("  " + p.id_movie + "  " + p.title + " (" + p.imdb.rating + ")"));
print("peliculas de 1994: " + db.movies.countDocuments({ year: 1994 }));

// aggregate: los 5 generos con mas peliculas y su rating promedio
print("\naggregate: top 5 generos");
db.movies.aggregate([
  { $unwind: "$genres" },
  { $group: { _id: "$genres", peliculas: { $sum: 1 }, rating: { $avg: "$imdb.rating" } } },
  { $sort: { peliculas: -1 } },
  { $limit: 5 }
]).forEach(g => print("  " + g._id.padEnd(10) + g.peliculas + " peliculas, rating prom " + g.rating.toFixed(2)));


// ---------------- UPDATE ----------------
titulo("UPDATE");

// updateOne
r = db.movies.updateOne({ id_movie: ultimo + 1 }, { $set: { "imdb.rating": 9.1, runtime: 105 } });
print("updateOne (id_movie " + (ultimo + 1) + "): matched " + r.matchedCount + ", modified " + r.modifiedCount);
printjson(db.movies.findOne({ id_movie: ultimo + 1 }, { _id: 0, id_movie: 1, title: 1, runtime: 1, imdb: 1 }));

// updateMany sobre las de prueba
r = db.movies.updateMany({ prueba: true }, { $set: { estado: "estreno" } });
print("updateMany (prueba: true): matched " + r.matchedCount + ", modified " + r.modifiedCount);

// updateMany sobre datos reales: marcar las peliculas anteriores a 1920
r = db.movies.updateMany({ year: { $lt: 1920 } }, { $set: { epoca: "cine mudo" } });
print("updateMany (year < 1920): matched " + r.matchedCount + ", modified " + r.modifiedCount);


// ---------------- DELETE ----------------
titulo("DELETE");

// deleteOne
// en mongo 7.0 un deleteOne en coleccion shardeada tiene que llevar la shard key
// (o el _id), si no da error. Por eso primero buscamos el id_movie por titulo
const borrar = db.movies.findOne({ title: "El Router Perdido", prueba: true }, { id_movie: 1 });
r = db.movies.deleteOne({ id_movie: borrar.id_movie });
print("deleteOne ('El Router Perdido', id_movie " + borrar.id_movie + "): deleted " + r.deletedCount);

// deleteMany: las de prueba con rating menor a 5
r = db.movies.deleteMany({ prueba: true, "imdb.rating": { $lt: 5 } });
print("deleteMany (prueba con rating < 5): deleted " + r.deletedCount);

print("\npeliculas de prueba que quedan:");
db.movies.find({ prueba: true }, { _id: 0, id_movie: 1, title: 1, "imdb.rating": 1 }).sort({ id_movie: 1 })
  .forEach(p => print("  " + p.id_movie + "  " + p.title + " (" + p.imdb.rating + ")"));
print("\ntotal al final: " + db.movies.countDocuments());


// ---------------- DISTRIBUCION ----------------
titulo("DISTRIBUCION DESPUES DEL CRUD");
print(db.movies.getShardDistribution());
