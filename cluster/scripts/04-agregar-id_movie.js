// Agrega el campo id_movie (1, 2, 3, ...) a cada pelicula
// Se tiene que correr ANTES de shardear porque id_movie va a ser la shard key
// Uso: mongosh --port 27117 scripts/04-agregar-id_movie.js

db = db.getSiblingDB("sample_mflix");

const faltan = db.movies.countDocuments({ id_movie: { $exists: false } });
if (faltan === 0) {
  print("todas las peliculas ya tienen id_movie");
  quit();
}

// ordenamos por _id para que siempre salga la misma numeracion
let contador = 1;
let lote = [];

db.movies.find({}, { _id: 1 }).sort({ _id: 1 }).forEach(doc => {
  lote.push({
    updateOne: {
      filter: { _id: doc._id },
      update: { $set: { id_movie: contador } }
    }
  });
  contador++;

  // mandamos los updates de 1000 en 1000 para que sea mas rapido
  if (lote.length === 1000) {
    db.movies.bulkWrite(lote, { ordered: false });
    lote = [];
  }
});
if (lote.length > 0) db.movies.bulkWrite(lote, { ordered: false });

// indice unico para que no se repita ningun id_movie
db.movies.createIndex({ id_movie: 1 }, { unique: true });

// revisiones
print("peliculas actualizadas: " + (contador - 1));
print("sin id_movie: " + db.movies.countDocuments({ id_movie: { $exists: false } }));
const r = db.movies.aggregate([
  { $group: { _id: null, min: { $min: "$id_movie" }, max: { $max: "$id_movie" }, distintos: { $addToSet: "$id_movie" } } },
  { $project: { _id: 0, min: 1, max: 1, distintos: { $size: "$distintos" } } }
]).toArray()[0];
print("id_movie va de " + r.min + " a " + r.max + " (" + r.distintos + " valores distintos)");
