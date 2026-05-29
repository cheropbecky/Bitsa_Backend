const { supabase } = require('../config/supabase');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

const ALLOWED_STATUSES = ['Upcoming', 'Ongoing', 'Past'];

const getEventStatus = (eventDate) => {
  const now = new Date();
  const event = new Date(eventDate);
  if (event.toDateString() === now.toDateString()) return 'Ongoing';
  if (event > now) return 'Upcoming';
  return 'Past';
};

const getEvents = async (req, res) => {
  try {
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .order('date', { ascending: false });

    if (error) throw error;

    const eventsWithStatus = events.map(e => ({
      ...e,
      status: e.status || getEventStatus(e.date)
    }));

    res.json(eventsWithStatus);
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ message: 'Server error fetching events', error: err.message });
  }
};

const getEventById = async (req, res) => {
  try {
    const { data: event, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const status = event.status || getEventStatus(event.date);
    res.json({ ...event, status });
  } catch (err) {
    console.error('Error fetching event:', err);
    res.status(500).json({ message: 'Server error fetching event', error: err.message });
  }
};

const createEvent = async (req, res) => {
  try {
    const { title, description, date, location, status } = req.body;
    if (!title || !description || !date) {
      return res.status(400).json({ message: 'Title, description, and date are required' });
    }

    let imageData = null;
    if (req.file) imageData = await uploadToCloudinary(req.file.buffer);

    const eventStatus = ALLOWED_STATUSES.includes(status) ? status : getEventStatus(date);

    const payload = {
      title,
      description,
      date,
      location: location || '',
      status: eventStatus,
      image_url: imageData?.url || null,
      public_id: imageData?.publicId || null,
      created_at: new Date(),
      updated_at: new Date()
    };

    const { data, error } = await supabase.from('events').insert(payload).select().maybeSingle();
    if (error) throw error;

    res.status(201).json({ message: 'Event created successfully', event: data });
  } catch (err) {
    console.error('Error creating event:', err);
    res.status(500).json({ message: 'Server error creating event', error: err.message });
  }
};

const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, date, location, status } = req.body;

    const { data: existing, error: fetchErr } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing) return res.status(404).json({ message: 'Event not found' });

    const updates = {};
    if (title) updates.title = title;
    if (description) updates.description = description;
    if (date) updates.date = date;
    if (location) updates.location = location;
    if (status && ALLOWED_STATUSES.includes(status)) updates.status = status;

    if (req.file) {
      if (existing.public_id) await deleteFromCloudinary(existing.public_id);
      const imageData = await uploadToCloudinary(req.file.buffer);
      updates.image_url = imageData.url;
      updates.public_id = imageData.publicId;
    }

    updates.updated_at = new Date();

    const { data, error } = await supabase.from('events').update(updates).eq('id', id).select().maybeSingle();
    if (error) throw error;

    res.json({ message: 'Event updated successfully', event: data });
  } catch (err) {
    console.error('Error updating event:', err);
    res.status(500).json({ message: 'Server error updating event', error: err.message });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: event, error: fetchErr } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (event.public_id) await deleteFromCloudinary(event.public_id);

    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) throw error;

    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    console.error('Error deleting event:', err);
    res.status(500).json({ message: 'Server error deleting event', error: err.message });
  }
};

const registerEvent = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'User not found. Please log in again.' });

    const eventId = req.params.id;
    const userId = req.user.id;

    const { data: event, error: evErr } = await supabase.from('events').select('id').eq('id', eventId).maybeSingle();
    if (evErr) throw evErr;
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const { data: existing, error: exErr } = await supabase.from('registrations').select('id,status').eq('event_id', eventId).eq('user_id', userId).maybeSingle();
    if (exErr) throw exErr;
    if (existing) return res.status(400).json({ message: 'You have already registered for this event', status: existing.status });

    const payload = {
      event_id: eventId,
      user_id: userId,
      status: 'Pending',
      registered_at: new Date(),
      created_at: new Date()
    };

    const { data, error } = await supabase.from('registrations').insert(payload).select().maybeSingle();
    if (error) throw error;

    res.json({ message: 'Registration submitted successfully. Awaiting admin approval.', registration: data });
  } catch (err) {
    console.error('Error registering for event:', err);
    res.status(500).json({ message: 'Server error registering for event', error: err.message });
  }
};

module.exports = {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  registerEvent
};