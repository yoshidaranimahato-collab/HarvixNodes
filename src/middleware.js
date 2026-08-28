const { verify } = require("./auth");

/*
 * Login protection
 */
function auth(req, res, next) {
  const header =
    req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Login required."
    });
  }

  const token =
    header.slice(7);

  try {
    req.user = verify(token);
    next();

  } catch (error) {

    return res.status(401).json({
      error: "Invalid or expired session."
    });
  }
}

/*
 * Admin protection
 */
function admin(req, res, next) {

  if (!req.user) {
    return res.status(401).json({
      error: "Login required."
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      error:
        "Administrator access required."
    });
  }

  next();
}

module.exports = {
  auth,
  admin
};
