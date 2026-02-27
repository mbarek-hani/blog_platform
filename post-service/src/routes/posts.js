const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const postController = require("../controllers/postController");
const { authenticate } = require("../middleware/auth");

const postValidation = [
  body("title")
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage("Title must be 5-200 characters"),
  body("content")
    .trim()
    .isLength({ min: 10 })
    .withMessage("Content must be at least 10 characters"),
];

router.use(authenticate);

router.get("/", postController.getPosts);
router.post("/", postValidation, postController.createPost);
router.get("/:id", postController.getPost);
router.put("/:id", postController.updatePost);
router.delete("/:id", postController.deletePost);
router.post("/:id/like", postController.likePost);

module.exports = router;
