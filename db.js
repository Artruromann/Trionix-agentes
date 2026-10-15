import mongoose from "mongoose";

export async function conectarDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Falta la variable MONGODB_URI. Crea el archivo .env a partir de .env.example");
  }
  await mongoose.connect(uri);
  console.log("MongoDB conectado:", mongoose.connection.name);
}
