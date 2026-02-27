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
    for (const queue of Object.values(QUEUES)) {
      await channel.assertQueue(queue, { durable: true });
    }
    console.log("Connected to RabbitMQ");
    connection.on("error", () => setTimeout(() => connect(url), 5000));
    connection.on("close", () => setTimeout(() => connect(url), 5000));
    return channel;
  } catch (err) {
    console.error("RabbitMQ connect error:", err.message);
    setTimeout(() => connect(url), 5000);
  }
}

async function publish(queue, message) {
  try {
    if (!channel) throw new Error("No channel");
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
      persistent: true,
    });
    console.log(`Published to ${queue}:`, message);
  } catch (err) {
    console.error(`Publish error (${queue}):`, err.message);
  }
}

async function consume(queue, handler) {
  try {
    if (!channel) throw new Error("No channel");
    await channel.consume(queue, async (msg) => {
      if (msg) {
        const content = JSON.parse(msg.content.toString());
        await handler(content);
        channel.ack(msg);
      }
    });
    console.log(`Consuming: ${queue}`);
  } catch (err) {
    console.error(`Consume error (${queue}):`, err.message);
  }
}

module.exports = { connect, publish, consume, QUEUES };
