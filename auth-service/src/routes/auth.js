const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticate, authorize } = require("../middleware/auth");

// Validation rules
const registerValidation = [
  body("username")
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be 3-30 characters"),
  body("email").isEmail().normalizeEmail().withMessage("Invalid email"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
];

const loginValidation = [
  body("email").isEmail().normalizeEmail().withMessage("Invalid email"),
  body("password").notEmpty().withMessage("Password is required"),
];

// Public routes
router.post("/register", registerValidation, authController.register);
router.post("/login", loginValidation, authController.login);

// Protected routes
router.use(authenticate);
router.get("/me", authController.getMe);

module.exports = router;
