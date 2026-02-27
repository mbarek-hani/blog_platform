const mongoose = require("mongoose");
const slugify = require("slugify");

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      minlength: [5, "Title must be at least 5 characters"],
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    slug: {
      type: String,
      unique: true,
    },
    content: {
      type: String,
      required: [true, "Content is required"],
      minlength: [10, "Content must be at least 10 characters"],
    },
    excerpt: {
      type: String,
      maxlength: [500, "Excerpt cannot exceed 500 characters"],
    },
    author: {
      userId: { type: String, required: true },
      username: { type: String, required: true },
    },
    tags: [{ type: String, trim: true, lowercase: true }],
    category: {
      type: String,
      enum: [
        "technology",
        "science",
        "lifestyle",
        "travel",
        "food",
        "sports",
        "other",
      ],
      default: "other",
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    publishedAt: Date,
    coverImage: String,
    views: { type: Number, default: 0 },
    likes: [{ type: String }], // userId array
    commentsCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

postSchema.pre("save", function (next) {
  if (this.isModified("title")) {
    this.slug =
      slugify(this.title, { lower: true, strict: true }) + "-" + Date.now();
  }
  if (
    this.isModified("status") &&
    this.status === "published" &&
    !this.publishedAt
  ) {
    this.publishedAt = new Date();
  }
  if (!this.excerpt && this.content) {
    this.excerpt =
      this.content.substring(0, 200) + (this.content.length > 200 ? "..." : "");
  }
  next();
});

postSchema.index({ title: "text", content: "text", tags: "text" });
postSchema.index({ "author.userId": 1 });
postSchema.index({ status: 1, publishedAt: -1 });

module.exports = mongoose.model("Post", postSchema);
