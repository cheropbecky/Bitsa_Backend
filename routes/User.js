const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { protect } = require('../middleware/authMiddleware'); 
const bcrypt = require('bcryptjs');
const { supabase } = require('../config/supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret'; 
const publicUserSelect = 'id,name,email,role,student_id,course,year,photo,created_at';

const normalizeEmail = (email) => (email || '').trim().toLowerCase();

const mapUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  studentId: user.student_id || '',
  course: user.course || '',
  year: user.year || '',
  photo: user.photo || '',
  createdAt: user.created_at,
});

const fetchUserByEmail = async (email, includePassword = false) => {
  const select = includePassword
    ? 'id,name,email,password,role,student_id,course,year,photo,created_at'
    : publicUserSelect;

  const { data, error } = await supabase
    .from('users')
    .select(select)
    .eq('email', normalizeEmail(email))
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' });
};
router.post('/register', async (req, res) => {
  const { name, email, password, studentId, course, year } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Please provide all required fields.' });
  }

  try {
    const existingUser = await fetchUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password.trim(), 10);

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        name: name.trim(),
        email: normalizeEmail(email),
        password: hashedPassword,
        student_id: studentId || '',
        course: course || '',
        year: year || '',
      })
      .select(publicUserSelect)
      .single();

    if (error) {
      throw error;
    }

    const token = jwt.sign({ id: newUser.id, role: newUser.role }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Account created successfully!',
      token,
      user: mapUser(newUser),
    });
  } catch (err) {
    console.error('Register Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await fetchUserByEmail(email, true);

    if (!user || !(await bcrypt.compare(password.trim(), user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful!',
      token,
      user: mapUser(user),
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


router.get('/profile', protect, async (req, res) => {
  try {
    res.json(req.user);
  } catch (err) {
    console.error('Profile Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
