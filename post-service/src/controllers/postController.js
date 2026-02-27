const { validationResult } = require("express-validator");
const Post = require("../models/Post");
const broker = require("../messaging/broker");

// GET /posts
exports.getPosts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      tag,
      search,
      status = "published",
      author,
    } = req.query;
    const query = {};

    // Only admins can see non-published posts unless it's their own
    if (status !== "published") {
      if (req.user.role !== "admin" && author !== req.user.userId) {
        query["author.userId"] = req.user.userId;
      }
    }

    query.status = status;
    if (category) query.category = category;
    if (tag) query.tags = tag;
    if (author) query["author.userId"] = author;
    if (search) query.$text = { $search: search };

    const skip = (page - 1) * limit;
    const posts = await Post.find(query)
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select("-content");

    const total = await Post.countDocuments(query);

    res.json({
      success: true,
      data: {
        posts,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / limit),
          limit: Number(limit),
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /posts/:id
exports.getPost = async (req, res) => {
  try {
    const post = await Post.findOne({
      $or: [
        {
          _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null,
        },
        { slug: req.params.id },
      ],
    });

    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    if (post.status !== "published") {
      if (req.user.userId !== post.author.userId && req.user.role !== "admin") {
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });
      }
    }

    // Increment views
    await Post.findByIdAndUpdate(post._id, { $inc: { views: 1 } });

    res.json({ success: true, data: post });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /posts
exports.createPost = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(422).json({ success: false, errors: errors.array() });

  try {
    const { title, content, tags, category, status, coverImage } = req.body;

    const post = await Post.create({
      title,
      content,
      tags,
      category,
      status,
      coverImage,
      author: {
        userId: req.user.userId,
        username: req.user.username || "Unknown",
      },
    });

    // Publish event
    await broker.publish(broker.QUEUES.POST_CREATED, {
      postId: post._id,
      title: post.title,
      authorId: post.author.userId,
      authorUsername: post.author.username,
      status: post.status,
    });

    res
      .status(201)
      .json({ success: true, message: "Post created", data: post });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /posts/:id
exports.updatePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });

    if (post.author.userId !== req.user.userId && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    const updates = req.body;
    const updated = await Post.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, message: "Post updated", data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /posts/:id
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });

    if (post.author.userId !== req.user.userId && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    await Post.findByIdAndDelete(req.params.id);

    await broker.publish(broker.QUEUES.POST_DELETED, {
      postId: post._id,
      authorId: post.author.userId,
    });

    res.json({ success: true, message: "Post deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /posts/:id/like
exports.likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });

    const userId = req.user.userId;
    const alreadyLiked = post.likes.includes(userId);

    const update = alreadyLiked
      ? { $pull: { likes: userId } }
      : { $addToSet: { likes: userId } };

    const updated = await Post.findByIdAndUpdate(req.params.id, update, {
      new: true,
    });

    res.json({
      success: true,
      message: alreadyLiked ? "Post unliked" : "Post liked",
      data: { likes: updated.likes.length, liked: !alreadyLiked },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
