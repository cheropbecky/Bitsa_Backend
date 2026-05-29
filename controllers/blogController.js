const { supabase } = require("../config/supabase");
const { uploadToCloudinary, deleteFromCloudinary } = require("../config/cloudinary");

const blogSelect = 'id,title,content,author,category,image_url,public_id,created_at';

const mapBlog = (blog) => ({
  id: blog.id,
  title: blog.title,
  content: blog.content,
  author: blog.author,
  category: blog.category,
  imageUrl: blog.image_url,
  publicId: blog.public_id,
  createdAt: blog.created_at,
});

const fetchBlogById = async (id) => {
  const { data, error } = await supabase
    .from('blogs')
    .select(blogSelect)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

// GET ALL BLOGS
const getAllBlogs = async (req, res) => {
  try {
    const { data: blogs, error } = await supabase
      .from('blogs')
      .select(blogSelect)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json(blogs.map(mapBlog));
  } catch (err) {
    console.error("Error fetching blogs:", err);
    res.status(500).json({ message: "Server error fetching blogs" });
  }
};

// CREATE BLOG
const createBlog = async (req, res) => {
  try {
    const { title, author, category, content, imageUrl } = req.body;

    if (!title || !author || !content) {
      return res.status(400).json({ message: "Title, author, and content are required" });
    }

    let imageData = null;

    if (req.file) {
      imageData = await uploadToCloudinary(req.file.buffer);
    } else if (imageUrl) {
      imageData = { url: imageUrl, publicId: null };
    }

    const { data: blog, error } = await supabase
      .from('blogs')
      .insert({
        title,
        author,
        category: category || '',
        content,
        image_url: imageData?.url || null,
        public_id: imageData?.publicId || null,
      })
      .select(blogSelect)
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json(mapBlog(blog));
  } catch (err) {
    console.error("Error creating blog:", err);
    res.status(500).json({ message: "Server error creating blog", error: err.message });
  }
};

// UPDATE BLOG (Handles text and optional image update/removal)
const updateBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, author, category, content, imageUrl } = req.body;
        
        if (!title || !author || !content) {
            return res.status(400).json({ message: "Title, author, and content are required" });
        }

        const blog = await fetchBlogById(id);
        if (!blog) return res.status(404).json({ message: "Blog not found" });

        let newImagePublicId = blog.public_id;
        let newImageUrl = blog.image_url;

        // Image Update Logic
        if (req.file) {
            // New file uploaded: Delete old image, upload new one
          if (blog.public_id) await deleteFromCloudinary(blog.public_id);
            
            const imageData = await uploadToCloudinary(req.file.buffer);
            newImageUrl = imageData.url;
            newImagePublicId = imageData.publicId;

        } else if (imageUrl) {
            // Image URL provided: Use URL, remove publicId if present
          if (blog.public_id) await deleteFromCloudinary(blog.public_id);
            
            newImageUrl = imageUrl;
            newImagePublicId = null;
            
        } else if (blog.public_id) {
            // Image cleared: No file or URL provided, but an old Cloudinary image exists
          await deleteFromCloudinary(blog.public_id);
            newImageUrl = null;
            newImagePublicId = null;
        }

        const { data: updatedBlog, error } = await supabase
          .from('blogs')
          .update({
          title,
          author,
          category: category || '',
          content,
          image_url: newImageUrl,
          public_id: newImagePublicId,
          })
          .eq('id', id)
          .select(blogSelect)
          .single();

        if (error) {
          throw error;
        }

        res.status(200).json(mapBlog(updatedBlog));

    } catch (err) {
        console.error("Error updating blog:", err);
        res.status(500).json({ message: "Server error updating blog", error: err.message });
    }
};

// DELETE BLOG
const deleteBlog = async (req, res) => {
  try {
    const blog = await fetchBlogById(req.params.id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    // Delete image from Cloudinary if it exists
    if (blog.public_id) await deleteFromCloudinary(blog.public_id);

    const { error } = await supabase.from('blogs').delete().eq('id', req.params.id);

    if (error) {
      throw error;
    }

    res.json({ message: "Blog deleted successfully" });
  } catch (err) {
    console.error("Error deleting blog:", err);
    res.status(500).json({ message: "Server error deleting blog", error: err.message });
  }
};

// GET ONE BLOG
const getBlog = async (req, res) => {
  try {
    const blog = await fetchBlogById(req.params.id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });
    res.json(mapBlog(blog));
  } catch (err) {
    console.error("Error fetching single blog:", err);
    res.status(500).json({ message: "Server error fetching blog" });
  }
};

// UPDATE BLOG IMAGE (Can be removed, as updateBlog now handles it)
const updateBlogImage = async (req, res) => {
  try {
    const blog = await fetchBlogById(req.params.id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });
    if (!req.file) return res.status(400).json({ message: "No image provided" });

    // Delete old image
    if (blog.public_id) await deleteFromCloudinary(blog.public_id);

    // Upload new image
    const imageData = await uploadToCloudinary(req.file.buffer);

    const { data: updatedBlog, error } = await supabase
      .from('blogs')
      .update({
        image_url: imageData.url,
        public_id: imageData.publicId,
      })
      .eq('id', req.params.id)
      .select(blogSelect)
      .single();

    if (error) {
      throw error;
    }

    res.json(mapBlog(updatedBlog));
  } catch (err) {
    console.error("Error updating blog image:", err);
    res.status(500).json({ message: "Server error updating blog image", error: err.message });
  }
};

module.exports = { getAllBlogs, createBlog, updateBlog, deleteBlog, updateBlogImage, getBlog };