const fs = require("fs");
const path = require("path");

const file =
  process.env.DATABASE_FILE ||
  "./data/harvix.json";

const initialDatabase = {
  users: [],
  servers: [],
  nodes: [],

  settings: {
    server_name: "HarvixPanel",
    server_icon: "⚡"
  },

  nextUserId: 1,
  nextServerId: 1,
  nextNodeId: 1
};

fs.mkdirSync(
  path.dirname(file),
  { recursive: true }
);

function loadDatabase() {

  if (!fs.existsSync(file)) {
    fs.writeFileSync(
      file,
      JSON.stringify(
        initialDatabase,
        null,
        2
      )
    );

    return structuredClone(
      initialDatabase
    );
  }

  try {

    return JSON.parse(
      fs.readFileSync(
        file,
        "utf8"
      )
    );

  } catch (error) {

    console.error(
      "Database read error:",
      error.message
    );

    return structuredClone(
      initialDatabase
    );
  }
}

let database = loadDatabase();

function save() {

  fs.writeFileSync(
    file,
    JSON.stringify(
      database,
      null,
      2
    )
  );
}

module.exports = {

  get db() {
    return database;
  },

  save
};
