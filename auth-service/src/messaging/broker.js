const amqp = require("amqplib");

let connection = null;
let channel = null;

const QUEUES = {
  USER_REGISTERED: "user.registered",
  POST_CREATED: "post.created",
  POST_DELETED: "post.deleted",
  COMMENT_CREATED: "comment.created",
  COMMENT_DELETED: "comment.deleted",
};

async function connect(url) {
  try {
    connection = await amqp.connect(url);
    channel = await connection.createChannel();

    // Assert all queues
    for (const queue of Object.values(QUEUES)) {
      await channel.assertQueue(queue, { durable: true });
    }

    console.log("Connected to RabbitMQ");

    connection.on("error", (err) => {
      console.error("RabbitMQ connection error:", err);
      setTimeout(() => connect(url), 5000);
    });

    connection.on("close", () => {
      console.log("RabbitMQ connection closed. Reconnecting...");
      setTimeout(() => connect(url), 5000);
    });

    return channel;
  } catch (err) {
    console.error("Failed to connect to RabbitMQ:", err.message);
    setTimeout(() => connect(url), 5000);
  }
}

function getChannel() {
  return channel;
}

async function publish(queue, message) {
  try {
    if (!channel) throw new Error("Channel not initialized");
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
      persistent: true,
    });
    console.log(`Published to ${queue}:`, message);
  } catch (err) {
    console.error(`Failed to publish to ${queue}:`, err.message);
  }
}

async function consume(queue, handler) {
  try {
    if (!channel) throw new Error("Channel not initialized");
    await channel.consume(queue, async (msg) => {
      if (msg) {
        const content = JSON.parse(msg.content.toString());
        console.log(`Received from ${queue}:`, content);
        await handler(content);
        channel.ack(msg);
      }
    });
    console.log(`Consuming from queue: ${queue}`);
  } catch (err) {
    console.error(`Failed to consume from ${queue}:`, err.message);
  }
}

module.exports = { connect, getChannel, publish, consume, QUEUES };
