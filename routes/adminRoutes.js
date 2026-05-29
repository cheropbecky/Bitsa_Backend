const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const { supabase } = require('../config/supabase');
    const { data: user, error } = await supabase
      .from('users')
      .select('id,name,email,password,role')
      .eq('email', email.trim())
      .maybeSingle();

    if (error) throw error;
    if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password || '');
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, email: user.email, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({ token, admin: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;