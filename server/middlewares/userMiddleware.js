import { errorHandler } from "./general.js";
import jwt from "jsonwebtoken";

const revokedTokens = new Set();

const verifyUser = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return errorHandler(res, 401, "Unauthorized access.");
    }
    if (revokedTokens.has(token)) {
      return errorHandler(res, 401, "Token has been revoked.");
    }
    const decoded = await jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return errorHandler(res, 500, "Internal server error.");
  }
};

export { verifyUser };
