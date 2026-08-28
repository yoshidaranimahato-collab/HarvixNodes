const fs = require("fs");
const readline = require("readline");
const bcrypt = require("bcryptjs");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

async function main() {
  const username = await ask("Admin username: ");
  const password = await ask("Admin password: ");

  if (!username || !password) {
    console.log("Username and password are required.");
    rl.close();
    return;
  }

  const file = "./data/harvix.json";

  let db = {
    users: [],
    servers: [],
    nodes: [],
    nextUserId: 1,
    nextServerId: 1,
    nextNodeId: 1
  };

  if (fs.existsSync(file)) {
    db = JSON.parse(fs.readFileSync(file, "utf8"));
  }

  if (!db.users) db.users = [];
  if (!db.nextUserId) db.nextUserId = 1;

  const hash = await bcrypt.hash(password, 12);

  const existing = db.users.find(
    user => user.username === username
  );

  if (existing) {
    existing.password_hash = hash;
    existing.role = "admin";
    console.log("Admin user updated successfully.");
  } else {
    db.users.push({
      id: db.nextUserId++,
      username,
      password_hash: hash,
      role: "admin",
      created_at: new Date().toISOString()
    });

    console.log("Admin user created successfully.");
  }

  fs.mkdirSync("./data", { recursive: true });

  fs.writeFileSync(
    file,
    JSON.stringify(db, null, 2)
  );

  rl.close();
}

main().catch(error => {
  console.error(error);
  rl.close();
  process.exit(1);
});
