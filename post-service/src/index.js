const express = require("express");
const mongoose = require("mongoose");
const morgan = require("morgan");
const broker = require("./messaging/broker");

const app = express();
app.use(express.json());
app.use(morgan("dev"));

app.use("/posts", require("./routes/posts"));

app.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "post-service",
    status: "healthy",
    timestamp: new Date(),
  });
});

app.use((req, res) =>
  res.status(404).json({ success: false, message: "Route not found" }),
);
app.use((err, req, res, next) =>
  res.status(500).json({ success: false, message: "Internal server error" }),
);

const PORT = process.env.PORT || 5001;

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB (posts_db)");

    await broker.connect(process.env.RABBITMQ_URL);

    // Listen for comment events to update commentsCount
    const Post = require("./models/Post");
    await broker.consume(broker.QUEUES.COMMENT_CREATED, async ({ postId }) => {
      await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });
    });
    await broker.consume(broker.QUEUES.COMMENT_DELETED, async ({ postId }) => {
      await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: -1 } });
    });

    app.listen(PORT, () => console.log(`Post Service running on port ${PORT}`));
  } catch (err) {
    console.error("Failed to start post service:", err);
    process.exit(1);
  }
}

start();
