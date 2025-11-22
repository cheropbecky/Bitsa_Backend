const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Protect routes - for regular authenticated users
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token has an id field (user token) or email field (admin token)
    if (!decoded.id) {
      return res.status(401).json({ message: "Invalid token format. Please log in again." });
    }
    
    req.user = await User.findById(decoded.id).select("-password");
    
    if (!req.user) {
      return res.status(401).json({ message: "User account not found. Please log in again." });
    }
    
    next();
  } catch (err) {
    console.error("Token verification error:", err);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: "Token expired. Please log in again." });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Invalid token. Please log in again." });
    }
    res.status(401).json({ message: "Token verification failed. Please log in again." });
  }
};


const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};


const verifyAdmin = async (req, res, next) => {
  try {
    
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided. Access denied.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Check if token has admin role
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }
    
    // If token has an id (user token), fetch the user to get email
    if (decoded.id) {
      const user = await User.findById(decoded.id).select('email name');
      if (!user) {
        return res.status(401).json({ message: 'User not found. Please login again.' });
      }
      req.admin = {
        email: user.email,
        role: 'admin',
        id: decoded.id
      };
    } else {
      // Legacy admin token format (email-based)
      req.admin = {
        email: decoded.email,
        role: decoded.role,
        id: decoded.id || decoded.email
      };
    }

    next();
  } catch (error) {
    console.error('Admin token verification error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired. Please login again.' });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    
    return res.status(401).json({ message: 'Authentication failed.' });
  }
};

module.exports = { protect, isAdmin, verifyAdmin };