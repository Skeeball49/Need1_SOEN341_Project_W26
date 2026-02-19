import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const usersFilePath = path.join(__dirname, 'users.json');

function readUsers() {
  try {
    if (!fs.existsSync(usersFilePath)) {
      fs.writeFileSync(usersFilePath, JSON.stringify([], null, 2));
      return [];
    }
    const data = fs.readFileSync(usersFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading users:', error);
    return [];
  }
}

function writeUsers(users) {
  try {
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing users:', error);
    return false;
  }
}

export function findUser(email) {
  const users = readUsers();
  return users.find(user => user.email === email);
}

export function createUser(userData) {
  const users = readUsers();
  users.push(userData);
  return writeUsers(users);
}

export function updateUser(email, updates) {
  const users = readUsers();
  const index = users.findIndex(user => user.email === email);
  if (index === -1) return null;

  users[index] = { ...users[index], ...updates };
  writeUsers(users);
  return users[index];
}
