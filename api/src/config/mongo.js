import { MongoClient } from 'mongodb';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://mongo1:27017,mongo2:27017,mongo3:27017/?replicaSet=rs0';
const MONGO_DB = process.env.MONGO_DB || 'restaurantdb';
  
let db;

export async function connectMongo() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  db = client.db(MONGO_DB);
  console.log('MongoDB conectado');
  return db;
}

export function getMongo() {
  if (!db) throw new Error('MongoDB no inicializado. Llame a connectMongo() primero.');
  return db;
}