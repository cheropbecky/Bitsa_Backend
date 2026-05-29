const { supabase } = require('../config/supabase');

const publicUserSelect = 'id,name,email,role,student_id,course,year,photo,created_at';

const mapUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  studentId: user.student_id || '',
  course: user.course || '',
  year: user.year || '',
  role: user.role,
  photo: user.photo || '',
  createdAt: user.created_at,
});

exports.getDashboardMetrics = async (req, res) => {
  try {
    const [usersResult, blogsResult, galleryResult, eventsResult, pendingRegsResult] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('blogs').select('id', { count: 'exact', head: true }),
      supabase.from('gallery_items').select('id', { count: 'exact', head: true }),
      supabase.from('events').select('id', { count: 'exact', head: true }),
      supabase.from('registrations').select('id', { count: 'exact', head: true }).eq('status', 'Pending')
    ]);

    if (usersResult.error) throw usersResult.error;
    if (blogsResult.error) throw blogsResult.error;
    if (galleryResult.error) throw galleryResult.error;
    if (eventsResult.error) throw eventsResult.error;
    if (pendingRegsResult.error) throw pendingRegsResult.error;

    const totalUsers = usersResult.count || 0;
    const totalBlogs = blogsResult.count || 0;
    const totalGallery = galleryResult.count || 0;
    const totalEvents = eventsResult.count || 0;
    const pendingRegistrations = pendingRegsResult.count || 0;

    // events by status
    const { data: eventsByStatus = [], error: ebsError } = await supabase
      .from('events')
      .select('status, id', { count: 'exact' })
      .neq('status', null);

    if (ebsError) throw ebsError;

    // count events by status
    const upcoming = await supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'Upcoming');
    const ongoing = await supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'Ongoing');
    const past = await supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'Past');

    res.json({
      metrics: {
        totalUsers,
        totalBlogs,
        totalGallery,
        totalEvents,
        pendingRegistrations,
        eventsByStatus: {
          upcoming: upcoming.count || 0,
          ongoing: ongoing.count || 0,
          past: past.count || 0
        }
      }
    });
  } catch (err) {
    console.error('Error fetching dashboard metrics:', err);
    res.status(500).json({ message: 'Server error fetching metrics', error: err.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select(publicUserSelect)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      count: users.length,
      users: users.map(mapUser)
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Server error fetching users', error: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    const { data: user, error: lookupError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.id === req.admin.id) return res.status(400).json({ message: 'Cannot delete your own account' });

    // delete registrations for user
    const { error: delRegsErr } = await supabase.from('registrations').delete().eq('user_id', userId);
    if (delRegsErr) throw delRegsErr;

    // delete user row
    const { error: deleteError } = await supabase.from('users').delete().eq('id', userId);
    if (deleteError) throw deleteError;

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ message: 'Server error deleting user', error: err.message });
  }
};

exports.getAllRegistrations = async (req, res) => {
  try {
    const { status, eventId } = req.query;

    let query = supabase.from('registrations').select(`id,status,registered_at,reviewed_at,notes, created_at, user:users(id,name,email,student_id,course,year), event:events(id,title,description,date,location,status)`)
      .order('registered_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (eventId) query = query.eq('event_id', eventId);

    const { data: registrations, error } = await query;
    if (error) throw error;

    res.json({ count: registrations.length, registrations });
  } catch (err) {
    console.error('Error fetching registrations:', err);
    res.status(500).json({ message: 'Server error fetching registrations', error: err.message });
  }
};
