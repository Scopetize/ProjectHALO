import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { errorHandler, sendEmail } from "../middlewares/general.js";
import { verifyUser } from "../middlewares/userMiddleware.js";

import User from "../models/UserModel.js";
import Patient from "../models/PatientModel.js"

const router = express.Router();
const revokedTokens = new Set();

router.post("/signup", async (req, res) => {
  const { email, password, role, username } = req.body;

  if (!email || !password || !role || !username) {
    return errorHandler(res, 400, "All fields are required to complete the signup.");
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const existingUser = await User.findOne({ email });
    const existingUsername = role === 'Patient' ? await Patient.findOne({ username }) : null;

    if (existingUser) {
      return errorHandler(res, 400, "Email already registered.");
    }

    if (existingUsername) {
      return errorHandler(res, 400, "Username already in use.");
    }

    const newUser = new User({
      email,
      password: hashedPassword,
      verified: false,
      role
    });

    await newUser.save();

    let newPatient = null;
    if (role === 'Patient') {
      newPatient = new Patient({
        userId: newUser._id,
        username
      });
      await newPatient.save();
    }

    if (!newUser || (role === 'Patient' && !newPatient)) {
      return errorHandler(res, 500, "Failed to set up user account fully.");
    }

    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    const VerificationToken = encodeURIComponent(token).replace(/\./g, "%2E");

    const mailOptions = {
      to: newUser.email,
      subject: 'Welcome to HALO! Please Verify Your Email Address',
      html: `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; border: 1px solid #e2e2e2; max-width: 600px; margin: 40px auto; padding: 30px; box-shadow: 0 4px 8px rgba(0,0,0,0.05); border-radius: 8px;">
                <h1 style="color: #0264d6; font-size: 24px;">Welcome to HALO!</h1>
                <p style="color: #626262; font-size: 16px;">We are delighted to welcome you to our community. To begin, please confirm your email address by clicking the link below.</p>
                <p style="margin: 30px 0; text-align: center;">
                    <a href="http://localhost:5173/verify/${VerificationToken}" style="background-color: #0264d6; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Verify Email</a>
                </p>
                <p style="color: #626262; font-size: 14px;"><strong>Note:</strong> This verification link will expire in 1 hour.</p>
                <p style="color: #626262; font-size: 14px;">If you did not request an account with HALO, please disregard this message.</p>
                <p style="color: #626262; font-size: 14px;">Thank you,<br>The HALO Team</p>
            </div>`
    };

    const emailResult = await sendEmail(mailOptions);

    if (!emailResult.success) {
      return errorHandler(res, 500, "Failed to send verification email.");
    }

    res.cookie("token", token, { httpOnly: true, sameSite: 'strict' });
    return res.status(201).json({ message: "User created and logged in successfully.", user: newUser });
  } catch (err) {
    return errorHandler(res, 500, "Internal server error.");
  }
});

router.post("/login", async (req, res) => {
  const { email, username, password } = req.body;

  try {
    let user;
    if (email) {
      user = await User.findOne({ email });
    } else if (username) {
      const patient = await Patient.findOne({ username }).populate('userId');
      user = patient ? patient.userId : null;
    }

    if (!user) {
      return errorHandler(res, 401, "Invalid email/username or password.");
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return errorHandler(res, 401, "Invalid email/username or password.");
    }

    if (req.cookies.token) {
      return errorHandler(res, 403, "You are already logged in. Please log out first to log in with another account.");
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.cookie("token", token, { httpOnly: true, sameSite: 'strict' });
    return res.status(200).json({ message: "Login successful" });
  } catch (err) {
    return errorHandler(res, 500, "Internal server error.");
  }
});

router.get('/logout', (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return errorHandler(res, 400, "No token found, user not logged in.");
  }

  revokedTokens.delete(token);
  res.clearCookie("token", { path: '/' });
  return res.status(200).json({ status: true, message: "Logout successful." });
});

router.get("/profile", verifyUser, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return errorHandler(res, 404, "User not found.");
    }

    let patientInfo = null;
    if (user.role === 'Patient') {
      patientInfo = await Patient.findOne({ userId: user._id });
    }

    res.status(200).json({ message: "Profile fetched successfully.", user, patientInfo });
  } catch (err) {
    return errorHandler(res, 500, "Failed to retrieve user profile.");
  }
});

router.delete("/delete", verifyUser, async (req, res) => {
  try {
    const userId = req.userId;
    const { password } = req.body;
    const user = await User.findById(userId);

    if (!user) {
      return errorHandler(res, 404, "User not found.");
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return errorHandler(res, 401, "Unauthorized: Incorrect password.");
    }

    if (user.role === 'Patient') {
      await Patient.deleteOne({ userId: userId });
    }

    await User.deleteOne({ _id: userId });
    revokedTokens.delete(req.cookies.token);
    res.clearCookie("token", { path: '/' });

    return res.status(200).json({ message: "Account deleted successfully." });
  } catch (err) {
    return errorHandler(res, 500, "Failed to delete account.");
  }
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return errorHandler(res, 400, "Email is required.");
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return errorHandler(res, 404, "User not found.");
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "5m",
    });

    const encodedToken = encodeURIComponent(token).replace(/\./g, "%2E");

    const mailOptions = {
      to: email,
      subject: 'Reset Your Password for HALO',
      html: `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; border: 1px solid #e2e2e2; max-width: 600px; margin: 40px auto; padding: 30px; box-shadow: 0 4px 8px rgba(0,0,0,0.05); border-radius: 8px;">
            <h1 style="color: #0264d6; font-size: 24px;">Reset Your Password for HALO</h1>
            <p style="color: #626262; font-size: 16px;">You recently requested to reset your password for your HALO account. Please click the link below to reset your password.</p>
            <p style="margin: 30px 0; text-align: center;">
                <a href="${process.env.FRONTEND_URL}/resetpassword/${encodedToken}" style="background-color: #0264d6; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Reset Your Password</a>
            </p>
            <p style="color: #626262; font-size: 14px;"><strong>Note:</strong> This link will expire in 5 minutes.</p>
            <p style="color: #626262; font-size: 14px;">If you did not request this email, please ignore it.</p>
            <p style="color: #626262; font-size: 14px;">Thank you,<br>The HALO Team</p>
        </div>`
    };

    await sendEmail(mailOptions);
    return res.status(200).json({ status: true, message: "Password reset link sent to your email." });
  } catch (err) {
    return errorHandler(res, 500, "Internal server error.");
  }
});


router.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password) {
    return errorHandler(res, 400, "Password is required.");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    if (revokedTokens.has(token)) {
      return errorHandler(res, 401, "Token revoked. Please request a new password reset.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.findByIdAndUpdate(userId, { password: hashedPassword, sessionTokens: [] });

    revokedTokens.add(token);
    res.clearCookie("token", { path: '/' });

    return res.status(200).json({ status: true, message: "Password updated successfully. You have been logged out. Please log in again." });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return errorHandler(res, 408, "Request Timeout. Please try resetting your password again.");
    }
    return errorHandler(res, 400, "Invalid token.");
  }
});


router.get("/verify/:token", async (req, res) => {
  const { token } = req.params;

  if (!token) {
    return errorHandler(res, 400, "Token is required.");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const user = await User.findById(userId);
    if (!user) {
      return errorHandler(res, 404, "User not found.");
    }

    if (user.verified) {
      return errorHandler(res, 400, "Email is already verified.");
    }

    user.verified = true;
    await user.save();

    return res.status(200).json({ message: "Email verification successful." });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return errorHandler(res, 410, "Verification link expired. Please request a new verification email.");
    }
    return errorHandler(res, 400, "Invalid or expired verification link.");
  }
});

router.post("/resendVerification", async (req, res) => {
  const token = req.cookies.token;

  if (!token) {
    return errorHandler(res, 401, "Authentication token is missing.");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const user = await User.findById(userId);

    if (!user) {
      return errorHandler(res, 404, "User not found.");
    }

    if (user.verified) {
      return res.status(200).json({ verified: true, message: "User is already verified." });
    } else {
      const newToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
      const VerificationToken = encodeURIComponent(newToken).replace(/\./g, "%2E");

      const mailOptions = {
        to: user.email,
        subject: 'Please Verify Your Email Address',
        html: `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; border: 1px solid #e2e2e2; max-width: 600px; margin: 40px auto; padding: 30px; box-shadow: 0 4px 8px rgba(0,0,0,0.05); border-radius: 8px;">
            <h1 style="color: #0264d6; font-size: 24px;">Verify Your Email</h1>
            <p style="color: #626262; font-size: 16px;">Please confirm your email address by clicking the link below.</p>
            <p style="margin: 30px 0; text-align: center;">
              <a href="http://localhost:5173/verify/${VerificationToken}" style="background-color: #0264d6; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Verify Email</a>
            </p>
            <p style="color: #626262; font-size: 14px;"><strong>Note:</strong> This verification link will expire in 1 hour.</p>
            <p style="color: #626262; font-size: 14px;">If you did not request this, please disregard this message.</p>
            <p style="color: #626262; font-size: 14px;">Thank you,<br>The Team</p>
          </div>`
      };

      const emailResult = await sendEmail(mailOptions);
      if (emailResult.success) {
        return res.status(200).json({ verified: false, message: "Verification email sent again. Please check your inbox." });
      } else {
        return errorHandler(res, 500, "Failed to send verification email.");
      }
    }
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return errorHandler(res, 410, "Session expired. Please log in again.");
    }
    return errorHandler(res, 500, "Server error while processing request.");
  }
});


export { router as UserRouter };