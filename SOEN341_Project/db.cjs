const { MongoClient } = require('mongodb');

// Only load dotenv in development (not in Netlify Functions)
if (process.env.NODE_ENV === 'development') {
  require('dotenv').config();
}

const uri = process.env.MONGODB_URI;
let client;
let clientPromise;

if (!uri) {
  console.error('MONGODB_URI environment variable is not set');
  throw new Error('Please add your MongoDB URI to environment variables');
}

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

async function getDatabase() {
  const client = await clientPromise;
  return client.db('soen341_project');
}

async function getUsersCollection() {
  const db = await getDatabase();
  return db.collection('users');
}

module.exports = { getDatabase, getUsersCollection };
