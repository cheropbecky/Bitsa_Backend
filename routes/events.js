const express = require('express');
const router = express.Router();
const multer = require('multer');
const mongoose = require('mongoose');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');
const { protect, verifyAdmin } = require('../middleware/authMiddleware');

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get('/', async (req, res) => {
  try {
    const events = await Event.find()
      .sort({ date: -1 })
      .populate({
        path: 'registeredUsers',
        select: 'name email',
        match: { _id: { $exists: true } }
      });
    
    // Filter out null values from populate and clean up invalid ObjectIds
    const cleanedEvents = events.map(event => {
      const eventObj = event.toObject();
      // Filter out null/undefined populated users
      if (eventObj.registeredUsers) {
        eventObj.registeredUsers = eventObj.registeredUsers.filter(user => user !== null && user !== undefined);
      }
      return eventObj;
    });
    
    res.json(cleanedEvents);
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ message: 'Server error fetching events', error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate({
        path: 'registeredUsers',
        select: 'name email',
        match: { _id: { $exists: true } }
      });
    if (!event) return res.status(404).json({ message: 'Event not found' });
    
    // Filter out null values from populate
    const eventObj = event.toObject();
    if (eventObj.registeredUsers) {
      eventObj.registeredUsers = eventObj.registeredUsers.filter(user => user !== null && user !== undefined);
    }
    
    res.json(eventObj);
  } catch (err) {
    console.error('Error fetching event:', err);
    res.status(500).json({ message: 'Server error fetching event', error: err.message });
  }
});

router.post('/', verifyAdmin, upload.single('image'), async (req, res) => {
  try {
    const { title, description, date, location, status } = req.body;

    if (!title || !description || !date) {
      return res.status(400).json({ message: "Title, description, and date are required" });
    }

    let imageData = null;
    if (req.file) {
      imageData = await uploadToCloudinary(req.file.buffer);
    }

    const eventData = {
      title,
      description,
      date: new Date(date),
      location: location || "",
      status: status || "Upcoming",
      imageUrl: imageData?.url || null,
      publicId: imageData?.publicId || null,
      registeredUsers: []
    };

    const event = new Event(eventData);
    await event.save();
    res.status(201).json({ message: 'Event created successfully', event });
  } catch (err) {
    console.error('Error creating event:', err);
    res.status(500).json({ message: 'Server error creating event', error: err.message });
  }
});

router.put('/:id', verifyAdmin, upload.single('image'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const { title, description, date, location, status } = req.body;
    if (title) event.title = title;
    if (description) event.description = description;
    if (date) event.date = new Date(date);
    if (location) event.location = location;
    if (status) event.status = status;

    if (req.file) {
      if (event.publicId) await deleteFromCloudinary(event.publicId);
      const imageData = await uploadToCloudinary(req.file.buffer);
      event.imageUrl = imageData.url;
      event.publicId = imageData.publicId;
    }

    await event.save();
    res.json({ message: 'Event updated successfully', event });
  } catch (err) {
    console.error('Error updating event:', err);
    res.status(500).json({ message: 'Server error updating event', error: err.message });
  }
});

router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (event.publicId) await deleteFromCloudinary(event.publicId);
    await event.deleteOne();

    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    console.error('Error deleting event:', err);
    res.status(500).json({ message: 'Server error deleting event', error: err.message });
  }
});

router.post('/:id/register', protect, async (req, res) => {
  try {
    // Check if user exists
    if (!req.user) {
      return res.status(401).json({ message: 'User not found. Please log in again.' });
    }

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const userId = req.user._id;

    const existingRegistration = await Registration.findOne({ 
      event: req.params.id, 
      user: userId 
    });

    if (existingRegistration) {
      return res.status(400).json({ 
        message: 'You have already registered for this event',
        status: existingRegistration.status 
      });
    }

    const registration = new Registration({
      event: req.params.id,
      user: userId,
      status: 'Pending'
    });

    await registration.save();

    // Check if userId is already in registeredUsers array
    const userIdString = userId.toString();
    const isAlreadyInArray = event.registeredUsers.some(id => id.toString() === userIdString);
    
    if (!isAlreadyInArray) {
      event.registeredUsers.push(userId);
      await event.save();
    }

    res.json({ 
      message: 'Registration submitted successfully. Awaiting admin approval.', 
      registration 
    });
  } catch (err) {
    console.error('Error registering for event:', err);
    res.status(500).json({ message: 'Server error registering for event', error: err.message });
  }
});

router.get('/:id/registrations', verifyAdmin, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const registrations = await Registration.find({ event: req.params.id })
      .populate({
        path: 'user',
        select: 'name email studentId course year',
        match: { _id: { $exists: true } }
      })
      .populate({
        path: 'reviewedBy',
        select: 'name email',
        match: { _id: { $exists: true } }
      })
      .sort({ registeredAt: -1 });

    // Filter out registrations with null users
    const cleanedRegistrations = registrations
      .filter(reg => reg.user !== null && reg.user !== undefined)
      .map(reg => {
        const regObj = reg.toObject();
        // Ensure reviewedBy is null if it doesn't exist
        if (!regObj.reviewedBy) {
          regObj.reviewedBy = null;
        }
        return regObj;
      });

    res.json({ 
      event: { id: event._id, title: event.title },
      count: cleanedRegistrations.length,
      registrations: cleanedRegistrations
    });
  } catch (err) {
    console.error('Error fetching registrations:', err);
    res.status(500).json({ message: 'Server error fetching registrations', error: err.message });
  }
});

router.put('/registrations/:registrationId/status', verifyAdmin, async (req, res) => {
  try {
    const { status, notes } = req.body;
    
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be Approved or Rejected' });
    }

    const registration = await Registration.findById(req.params.registrationId)
      .populate({
        path: 'user',
        select: 'name email',
        match: { _id: { $exists: true } }
      })
      .populate({
        path: 'event',
        select: 'title',
        match: { _id: { $exists: true } }
      });

    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    if (!registration.user) {
      return res.status(404).json({ message: 'User associated with registration not found' });
    }

    registration.status = status;
    registration.reviewedAt = new Date();
    // Note: reviewedBy is a User reference, so we only set it if it's a valid ObjectId
    // For admin reviews, we'll leave it null or try to find a user by email
    if (req.admin.id && mongoose.Types.ObjectId.isValid(req.admin.id)) {
      registration.reviewedBy = req.admin.id;
    }
    // Otherwise, leave reviewedBy as null (admin reviews won't have a user reference)
    if (notes) registration.notes = notes;

    await registration.save();

    res.json({ 
      message: `Registration ${status.toLowerCase()} successfully`, 
      registration 
    });
  } catch (err) {
    console.error('Error updating registration status:', err);
    res.status(500).json({ message: 'Server error updating registration', error: err.message });
  }
});

router.get('/user/registrations', protect, async (req, res) => {
  try {
    // Check if user exists
    if (!req.user) {
      return res.status(401).json({ message: 'User not found. Please log in again.' });
    }

    const registrations = await Registration.find({ user: req.user._id })
      .populate({
        path: 'event',
        select: 'title description date location status imageUrl',
        match: { _id: { $exists: true } }
      })
      .sort({ registeredAt: -1 });

    // Filter out registrations with null events
    const cleanedRegistrations = registrations
      .filter(reg => reg.event !== null && reg.event !== undefined)
      .map(reg => reg.toObject());

    res.json({ registrations: cleanedRegistrations });
  } catch (err) {
    console.error('Error fetching user registrations:', err);
    res.status(500).json({ message: 'Server error fetching registrations', error: err.message });
  }
});

module.exports = router;