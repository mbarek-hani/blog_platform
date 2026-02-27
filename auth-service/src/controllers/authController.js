const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const User = require("../models/User");
const broker = require("../messaging/broker");

// POST /auth/register
exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      const field = existingUser.email === email ? "email" : "username";
      return res
        .status(409)
        .json({ success: false, message: `This ${field} is already taken` });
    }

    const user = await User.create({ username, email, password });
    const accessToken = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      {
        expiresIn: "24h",
      },
    );
    user.lastLogin = new Date();
    await user.save();

    // Publish event
    await broker.publish(broker.QUEUES.USER_REGISTERED, {
      userId: user._id,
      username: user.username,
      email: user.email,
    });

    res.status(201).json({
      success: true,
      message: "Registration successful",
      data: { user, accessToken },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /auth/login
exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    if (!user.isActive) {
      return res
        .status(403)
        .json({ success: false, message: "Account is deactivated" });
    }

    const accessToken = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      {
        expiresIn: "24h",
      },
    );

    user.lastLogin = new Date();
    await user.save();

    const userObj = user.toJSON();
    res.json({
      success: true,
      message: "Login successful",
      data: { user: userObj, accessToken },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /auth/me
exports.getMe = async (req, res) => {
  res.json({ success: true, data: req.user });
};
