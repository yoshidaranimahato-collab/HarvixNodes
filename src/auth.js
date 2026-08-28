const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { db, save } = require("./database");

const secret =
  process.env.JWT_SECRET ||
  "change-this-secret";

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role
    },
    secret,
    {
      expiresIn: "7d"
    }
  );
}

async function register(username, password) {

  username = String(username || "").trim();
  password = String(password || "");

  if (!/^[A-Za-z0-9_-]{3,24}$/.test(username)) {
    throw new Error(
      "Username must be 3-24 characters and use only letters, numbers, _ or -."
    );
  }

  if (password.length < 6) {
    throw new Error(
      "Password must be at least 6 characters."
    );
  }

  const exists = db.users.some(
    user =>
      user.username.toLowerCase() ===
      username.toLowerCase()
  );

  if (exists) {
    throw new Error(
      "Username already exists."
    );
  }

  /*
   * The very first registered account
   * automatically becomes administrator.
   */
  const role =
    db.users.length === 0
      ? "admin"
      : "user";

  const passwordHash =
    await bcrypt.hash(password, 10);

  const user = {
    id: db.nextUserId++,

    username,

    passwordHash,

    role,

    created_at:
      new Date().toISOString()
  };

  db.users.push(user);

  save();

  return {
    id: user.id,
    username: user.username,
    role: user.role
  };
}

async function login(username, password) {

  username = String(username || "").trim();
  password = String(password || "");

  const user = db.users.find(
    user =>
      user.username.toLowerCase() ===
      username.toLowerCase()
  );

  if (!user) {
    throw new Error(
      "Invalid username or password."
    );
  }

  const valid =
    await bcrypt.compare(
      password,
      user.passwordHash
    );

  if (!valid) {
    throw new Error(
      "Invalid username or password."
    );
  }

  const token =
    createToken(user);

  return {
    token,

    user: {
      id: user.id,
      username: user.username,
      role: user.role
    }
  };
}

function verify(token) {
  return jwt.verify(
    token,
    secret
  );
}

module.exports = {
  register,
  login,
  verify
};
