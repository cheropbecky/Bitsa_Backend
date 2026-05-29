const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const bcrypt = require('bcryptjs');

const { supabase } = require('../config/supabase');
const { protect } = require('../middleware/authMiddleware');
const memoryStorage = multer.memoryStorage();
const upload = multer({ storage: memoryStorage });

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
const userSelect = 'id,name,email,password,role,student_id,course,year,photo,created_at';
const publicUserSelect = 'id,name,email,role,student_id,course,year,photo,created_at';

const normalizeEmail = (email) => (email || '').trim().toLowerCase();

const mapUser = (user) => {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    studentId: user.student_id || '',
    course: user.course || '',
    year: user.year || '',
    photo: user.photo || '',
    createdAt: user.created_at,
  };
};

const fetchUserByEmail = async (email, includePassword = false) => {
  const { data, error } = await supabase
    .from('users')
    .select(includePassword ? userSelect : publicUserSelect)
    .eq('email', normalizeEmail(email))
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

const fetchUserById = async (id, includePassword = false) => {
  const { data, error } = await supabase
    .from('users')
    .select(includePassword ? userSelect : publicUserSelect)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

const createToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });


router.get('/', async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select(publicUserSelect)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({ count: users.length, users: users.map(mapUser) });
  } catch (err) {
    console.error('GET /users error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
router.get('/profile', protect, async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (err) {
    console.error('GET /profile error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/profile', protect, upload.single('photo'), async (req, res) => {
  try {
    const currentUser = req.user;
    const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

    const updateData = {};

    if (req.body.email) {
      const nextEmail = normalizeEmail(req.body.email);
      const existingUser = await fetchUserByEmail(nextEmail);

      if (existingUser && existingUser.id !== currentUser.id) {
        return res.status(400).json({ message: 'Email already in use' });
      }

      updateData.email = nextEmail;
    }

    
    if (req.file) {
      try {
        
        if (currentUser.photo && currentUser.photo.includes('cloudinary')) {
          const publicIdMatch = currentUser.photo.match(/\/v\d+\/(.+)\./);
          if (publicIdMatch) {
            await deleteFromCloudinary(publicIdMatch[1]);
          }
        }
        const imageData = await uploadToCloudinary(req.file.buffer, 'bitsa_profiles');
        updateData.photo = imageData.url;
      } catch (uploadErr) {
        console.error('Photo upload error:', uploadErr);
        return res.status(500).json({ message: 'Failed to upload profile picture' });
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.json({ user: currentUser, message: 'Profile updated successfully' });
    }

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', currentUser.id)
      .select(publicUserSelect)
      .single();

    if (error) {
      throw error;
    }

    res.json({ user: mapUser(updatedUser), message: 'Profile updated successfully' });
  } catch (err) {
    console.error('PUT /profile error:', err);
    res.status(500).json({ message: 'Server error while updating profile' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, studentId, course, year } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide all required fields.' });
    }

    const existingUser = await fetchUserByEmail(email);
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

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
        role: 'student',
      })
      .select(publicUserSelect)
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      message: 'User registered successfully',
      user: mapUser(newUser),
      token: createToken(newUser),
    });
  } catch (err) {
    console.error('POST /register error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
router.post('/login', async (req, res) => {
  console.log('=========================');
  console.log('Login Attempt');
  console.log('Request Body:', req.body);

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const trimmedEmail = normalizeEmail(email);
    const trimmedPassword = password.trim();

    // Check if this is the admin email
    if (trimmedEmail === 'admin@bitsa.com') {
      // Check if admin user exists in database
      let adminUser = await fetchUserByEmail(trimmedEmail, true);
      
      if (!adminUser) {
        // Create admin user if it doesn't exist (only if using default password)
        if (trimmedPassword === 'admin123') {
          const hashedPassword = await bcrypt.hash(trimmedPassword, 10);
          const { data, error } = await supabase
            .from('users')
            .insert({
              name: 'Admin',
              email: trimmedEmail,
              password: hashedPassword,
              role: 'admin',
              student_id: '',
              course: '',
              year: '',
            })
            .select(userSelect)
            .single();

          if (error) {
            throw error;
          }

          adminUser = data;
          console.log('Admin user created in database');
        } else {
          return res.status(400).json({ message: 'Invalid credentials' });
        }
      } else {
        // Admin user exists - verify password (works with both default and changed passwords)
        const isMatch = await bcrypt.compare(trimmedPassword, adminUser.password);
        if (!isMatch) {
          return res.status(400).json({ message: 'Invalid credentials' });
        }
      }

      const token = jwt.sign(
        { id: adminUser.id, role: 'admin' },
        JWT_SECRET,
        { expiresIn: '1d' }
      );

      console.log('Admin login successful');
      return res.json({
        message: 'Login successful',
        token,
        user: {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
          role: 'admin',
          studentId: adminUser.student_id,
          course: adminUser.course,
          year: adminUser.year,
          photo: adminUser.photo,
        },
      });
    }

    // Regular user login
    const user = await fetchUserByEmail(trimmedEmail, true);
    if (!user) {
      console.log('User not found for email:', trimmedEmail);
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    const isMatch = await bcrypt.compare(trimmedPassword, user.password);
    console.log('Password match:', isMatch);

    if (!isMatch) {
      console.log('Invalid password for user:', trimmedEmail);
      return res.status(400).json({ 
        message: 'Invalid credentials. If you registered before recent updates, please reset your password or contact support.' 
      });
    }
    
    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    console.log('Login successful');
    res.json({
      message: 'Login successful',
      token,
      user: mapUser(user),
    });
  } catch (err) {
    console.error('POST /login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
router.delete('/:id', async (req, res) => {
  try {
    const { data: existingUser, error: lookupError } = await supabase
      .from('users')
      .select('id')
      .eq('id', req.params.id)
      .maybeSingle();

    if (lookupError) {
      throw lookupError;
    }

    if (!existingUser) return res.status(404).json({ message: 'User not found' });

    const { error } = await supabase.from('users').delete().eq('id', req.params.id);

    if (error) {
      throw error;
    }

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('DELETE /users/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
router.post('/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ message: 'Email and new password are required' });
    }

    const user = await fetchUserByEmail(email, true);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    
    const hashedPassword = await bcrypt.hash(newPassword.trim(), 10);

    const { error } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', user.id);

    if (error) {
      throw error;
    }

    res.json({ message: 'Password reset successfully. Please login with your new password.' });
  } catch (err) {
    console.error('POST /reset-password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
router.post('/fix-email', async (req, res) => {
  try {
    const { oldEmail, newEmail } = req.body;

    if (!oldEmail || !newEmail) {
      return res.status(400).json({ message: 'Both old and new email are required' });
    }

    const user = await fetchUserByEmail(oldEmail);
    if (!user) {
      return res.status(404).json({ message: 'User with old email not found' });
    }
    const existingUser = await fetchUserByEmail(newEmail);
    if (existingUser) {
      return res.status(400).json({ message: 'New email already exists' });
    }

    const { error } = await supabase
      .from('users')
      .update({ email: normalizeEmail(newEmail) })
      .eq('id', user.id);

    if (error) {
      throw error;
    }

    res.json({ 
      message: 'Email updated successfully', 
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    console.error('POST /fix-email error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
