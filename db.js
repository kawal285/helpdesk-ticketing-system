// db.js
// This file acts as our simple "database" - it saves data into a JSON file
// on your computer, and gives other files an easy way to read/write it.

const fs = require("fs");       // fs = "file system" - lets Node read/write files
const path = require("path");   // helps build file paths safely

const DB_FILE = path.join(__dirname, "data.json");

// If data.json doesn't exist yet, create it with empty starting data
function ensureFileExists() {
  if (!fs.existsSync(DB_FILE)) {
    const emptyData = {
      users: [],
      tickets: [],
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(emptyData, null, 2));
  }
}

// Reads the current data from the file
function readData() {
  ensureFileExists();
  const raw = fs.readFileSync(DB_FILE, "utf-8");
  return JSON.parse(raw);
}

// Saves new data into the file (overwrites old data with the new version)
function writeData(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

module.exports = { readData, writeData };