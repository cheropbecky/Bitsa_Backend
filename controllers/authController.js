const jwt = require("jsonwebtoken");
const bcrypt = require('bcryptjs');
const { supabase } = require('../config/supabase');

const generateToken = (user) => {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

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

exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, role, studentId, course, year } = req.body;

    const userExists = await fetchUserByEmail(email);
    if (userExists)
      return res.status(400).json({ message: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password.trim(), 10);

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        name: name.trim(),
        email: normalizeEmail(email),
        password: hashedPassword,
        role: role || 'student',
        student_id: studentId || '',
        course: course || '',
        year: year || '',
      })
      .select(publicUserSelect)
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      message: "User registered",
      user: mapUser(user),
      token: generateToken(user),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await fetchUserByEmail(email, true);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" }); 
    }

    const isMatch = await bcrypt.compare(password.trim(), user.password);
    
    if (!isMatch) {
      
      return res.status(401).json({ message: "Invalid credentials" }); 
    }

    
    const token = generateToken(user);

    res.json({
      message: "Login successful",
      user: mapUser(user),
      token,
    });
  } catch (err) {
    console.error("Login failed:", err.message);
    res.status(500).json({ message: 'Server error during login' });
  }
};


exports.getMe = async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};