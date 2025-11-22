// File: routes/contact.js
const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const { verifyAdmin } = require("../middleware/authMiddleware");

// Placeholder authentication middleware for students
const isAuthenticated = (req, res, next) => {
  if (req.user && req.user.email) {
    next();
  } else {
    res.status(401).json({ error: "Authentication required." });
  }
};

// ==============================
// SEND NEW MESSAGE (Student)
// ==============================
router.post("/send", async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    await Message.create({ name, email, subject, message });
    res.status(201).json({ message: "Message sent successfully!" });
  } catch (err) {
    console.error("Error sending message:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ==============================
// GET ALL MESSAGES (Admin)
// ==============================
router.get("/", verifyAdmin, async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 });
    res.status(200).json(messages);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// ==============================
// GET STUDENT MESSAGES
// ==============================
router.get("/my", isAuthenticated, async (req, res) => {
  const userEmail = req.user.email;
  try {
    const studentMessages = await Message.find({ email: userEmail }).sort({ createdAt: -1 });
    res.status(200).json(studentMessages);
  } catch (err) {
    console.error("Error fetching student messages:", err);
    res.status(500).json({ error: "Failed to fetch student messages" });
  }
});

// ==============================
// ADMIN REPLY TO MESSAGE
// ==============================
router.put("/:id/reply", verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { adminReply } = req.body;

  if (!adminReply) return res.status(400).json({ message: "Admin reply content is required." });

  try {
    const updatedMessage = await Message.findByIdAndUpdate(
      id,
      { adminReply, replied: true, status: "unread" },
      { new: true, runValidators: true }
    );

    if (!updatedMessage) return res.status(404).json({ message: "Message not found." });

    res.status(200).json({ message: "Reply sent successfully.", updatedMessage });
  } catch (error) {
    console.error("Error replying to message:", error);
    res.status(500).json({ message: "Internal server error during reply." });
  }
});

// ==============================
// STUDENT MARKS MESSAGE AS READ
// ==============================
router.put("/:id/read", isAuthenticated, async (req, res) => {
  const { id } = req.params;

  try {
    const updatedMessage = await Message.findByIdAndUpdate(
      id,
      { status: "read" },
      { new: true }
    );

    if (!updatedMessage) return res.status(404).json({ message: "Message not found." });

    res.status(200).json({ message: "Message marked as read.", updatedMessage });
  } catch (error) {
    console.error("Error marking message as read:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;
