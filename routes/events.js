const router = require('express').Router();
const multer = require('multer');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');
const { protect, verifyAdmin } = require('../middleware/authMiddleware');
const {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  registerEvent
} = require('../controllers/eventController');

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get('/', getEvents);
router.get('/:id', getEventById);
router.post('/', verifyAdmin, upload.single('image'), createEvent);
router.put('/:id', verifyAdmin, upload.single('image'), updateEvent);
router.delete('/:id', verifyAdmin, deleteEvent);
router.post('/:id/register', protect, registerEvent);

// Admin registrations endpoints handled in adminController
router.get('/:id/registrations', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: registrations, error } = await require('../config/supabase').supabase
      .from('registrations')
      .select('id,status,registered_at,reviewed_at,notes, user:users(id,name,email,student_id,course,year)')
      .eq('event_id', id)
      .order('registered_at', { ascending: false });

    if (error) throw error;

    res.json({ event: { id }, count: registrations.length, registrations });
  } catch (err) {
    console.error('Error fetching registrations:', err);
    res.status(500).json({ message: 'Server error fetching registrations', error: err.message });
  }
});

router.put('/registrations/:registrationId/status', verifyAdmin, async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!['Approved', 'Rejected'].includes(status)) return res.status(400).json({ message: 'Invalid status' });

    const registrationId = req.params.registrationId;
    const updates = { status, reviewed_at: new Date() };
    if (notes) updates.notes = notes;
    if (req.admin && req.admin.id) updates.reviewed_by = req.admin.id;

    const { data, error } = await require('../config/supabase').supabase
      .from('registrations')
      .update(updates)
      .eq('id', registrationId)
      .select()
      .maybeSingle();

    if (error) throw error;
    res.json({ message: `Registration ${status.toLowerCase()} successfully`, registration: data });
  } catch (err) {
    console.error('Error updating registration status:', err);
    res.status(500).json({ message: 'Server error updating registration', error: err.message });
  }
});

router.get('/user/registrations', protect, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'User not found. Please log in again.' });
    const { data: registrations, error } = await require('../config/supabase').supabase
      .from('registrations')
      .select('id,status,registered_at,reviewed_at,notes, event:events(id,title,description,date,location,status)')
      .eq('user_id', req.user.id)
      .order('registered_at', { ascending: false });

    if (error) throw error;
    res.json({ registrations });
  } catch (err) {
    console.error('Error fetching user registrations:', err);
    res.status(500).json({ message: 'Server error fetching registrations', error: err.message });
  }
});

module.exports = router;