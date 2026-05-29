const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
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

const createToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  console.log('Login attempt received:', req.body);

  const userExists = await fetchUserByEmail(email);
  if (userExists) return res.status(400).json({ message: 'User already exists' });

  const hashedPassword = await bcrypt.hash(password.trim(), 10);

  const { data: user, error } = await supabase
    .from('users')
    .insert({
      name: name.trim(),
      email: normalizeEmail(email),
      password: hashedPassword,
      role: role || 'student',
      student_id: '',
      course: '',
      year: '',
    })
    .select(publicUserSelect)
    .single();

  if (error) {
    console.error('Register error:', error);
    return res.status(500).json({ message: 'Server error' });
  }

  const token = createToken(user);

  res.json({ token, user: mapUser(user) });
});
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await fetchUserByEmail(email, true);
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const isMatch = await bcrypt.compare(password.trim(), user.password);
  if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

  const token = createToken(user);

  res.json({ token, user: mapUser(user) });
});

module.exports = router;
