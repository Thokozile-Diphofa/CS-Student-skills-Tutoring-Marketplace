const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
  const tokenFromCookie = req.cookies && req.cookies.token;
  const authHeader = req.headers["authorization"];
  const tokenFromHeader = authHeader && authHeader.split(" ")[1];

  const token = tokenFromCookie || tokenFromHeader;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const jwtSecret = process.env.JWT_SECRET || "easylearning_default_secret_key_change_in_prod";

  jwt.verify(token, jwtSecret, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: "Invalid or expired authentication token" });
    }

    // Support both multi-role array and legacy single role
    const roles = Array.isArray(decoded.roles)
      ? decoded.roles
      : (decoded.role ? [decoded.role] : []);

    req.user = {
      ...decoded,
      roles
    };
    next();
  });
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.roles) {
      return res.status(403).json({ error: "Access denied. No roles assigned." });
    }

    const hasPermission = allowedRoles.some(role => req.user.roles.includes(role));
    if (!hasPermission) {
      return res.status(403).json({ error: "Access denied. Insufficient role permissions." });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole
};
