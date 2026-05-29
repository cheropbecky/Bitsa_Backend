// File: routes/contact.js
const express = require("express");
const router = express.Router();
const { verifyAdmin, protect } = require("../middleware/authMiddleware");
const { supabase } = require("../config/supabase");

const messageSelect = 'id,name,email,subject,message,status,admin_reply,replied,created_at';

const mapMessage = (message) => ({
  id: message.id,
  name: message.name,
  email: message.email,
  subject: message.subject,
  message: message.message,
  status: message.status,
  adminReply: message.admin_reply,
  replied: message.replied,
  createdAt: message.created_at,
});

const fetchMessageById = async (id) => {
  const { data, error } = await supabase
    .from('messages')
    .select(messageSelect)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
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
    const { error } = await supabase.from('messages').insert({
      name,
      email,
      subject,
      message,
      status: 'unread',
      admin_reply: null,
      replied: false,
    });

    if (error) {
      throw error;
    }

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
    const { data: messages, error } = await supabase
      .from('messages')
      .select(messageSelect)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.status(200).json(messages.map(mapMessage));
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// ==============================
// GET STUDENT MESSAGES
// ==============================
router.get("/my", protect, async (req, res) => {
  const userEmail = req.user.email;
  try {
    const { data: studentMessages, error } = await supabase
      .from('messages')
      .select(messageSelect)
      .eq('email', userEmail)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.status(200).json(studentMessages.map(mapMessage));
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
    const message = await fetchMessageById(id);

    if (!message) return res.status(404).json({ message: "Message not found." });

    const { data: updatedMessage, error } = await supabase
      .from('messages')
      .update({ admin_reply: adminReply, replied: true, status: 'unread' })
      .eq('id', id)
      .select(messageSelect)
      .single();

    if (error) {
      throw error;
    }

    res.status(200).json({ message: "Reply sent successfully.", updatedMessage: mapMessage(updatedMessage) });
  } catch (error) {
    console.error("Error replying to message:", error);
    res.status(500).json({ message: "Internal server error during reply." });
  }
});

// ==============================
// STUDENT MARKS MESSAGE AS READ
// ==============================
router.put("/:id/read", protect, async (req, res) => {
  const { id } = req.params;

  try {
    const message = await fetchMessageById(id);

    if (!message) return res.status(404).json({ message: "Message not found." });

    if (message.email !== req.user.email) {
      return res.status(403).json({ message: "You can only update your own messages." });
    }

    const { data: updatedMessage, error } = await supabase
      .from('messages')
      .update({ status: 'read' })
      .eq('id', id)
      .select(messageSelect)
      .single();

    if (error) {
      throw error;
    }

    res.status(200).json({ message: "Message marked as read.", updatedMessage: mapMessage(updatedMessage) });
  } catch (error) {
    console.error("Error marking message as read:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;
