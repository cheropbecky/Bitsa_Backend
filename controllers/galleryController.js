const { supabase } = require("../config/supabase");
const { uploadToCloudinary, deleteFromCloudinary } = require("../config/cloudinary"); 

const gallerySelect = 'id,title,description,image_url,public_id,created_at';

const mapGalleryItem = (item) => ({
  id: item.id,
  title: item.title,
  description: item.description,
  imageUrl: item.image_url,
  publicId: item.public_id,
  createdAt: item.created_at,
});

const fetchGalleryItemById = async (id) => {
  const { data, error } = await supabase
    .from('gallery_items')
    .select(gallerySelect)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

// GET all gallery items
exports.getGallery = async (req, res) => {
  try {
    const { data: items, error } = await supabase
      .from('gallery_items')
      .select(gallerySelect)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json(items.map(mapGalleryItem));
  } catch (err) {
    console.error("Error fetching gallery:", err);
    res.status(500).json({ message: "Server error fetching gallery" });
  }
};

// ADD gallery item (admin)
exports.addGalleryItem = async (req, res) => {
  try {
    const { title, description, imageUrl: externalUrl } = req.body;
    let imageData = null;

    if (req.file) {
      // Upload file to Cloudinary using helper
      imageData = await uploadToCloudinary(req.file.buffer, "bitsa_gallery");
    } else if (externalUrl) {
      // If user provides an image URL instead of uploading a file
      imageData = { url: externalUrl, publicId: null };
    } else {
      return res.status(400).json({ message: "No image uploaded or URL provided" });
    }

    const { data: newItem, error } = await supabase
      .from('gallery_items')
      .insert({
        title: title || "Untitled",
        description: description || "",
        image_url: imageData.url,
        public_id: imageData.publicId,
      })
      .select(gallerySelect)
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({ message: "Gallery item added", item: mapGalleryItem(newItem) });
  } catch (err) {
    console.error("Error adding gallery item:", err);
    res.status(500).json({ message: "Server error adding gallery item" });
  }
};


exports.updateGalleryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, imageUrl: externalUrl } = req.body;

    const item = await fetchGalleryItemById(id);
    if (!item) return res.status(404).json({ message: "Gallery item not found" });

    // Update text fields
    const nextTitle = title || item.title;
    const nextDescription = description !== undefined ? description : item.description;

    let newImagePublicId = item.public_id;
    let newImageUrl = item.image_url;

    // Handle image update/replacement
    if (req.file) {
      // New file uploaded: Delete old image, upload new one
      if (item.public_id) await deleteFromCloudinary(item.public_id);

      const imageData = await uploadToCloudinary(req.file.buffer, "bitsa_gallery");
      newImageUrl = imageData.url;
      newImagePublicId = imageData.publicId;

    } else if (externalUrl) {
      // External URL provided: Delete old Cloudinary image (if exists) and use new URL
      if (item.public_id) await deleteFromCloudinary(item.public_id);

      newImageUrl = externalUrl;
      newImagePublicId = null;
      
    } else if (!externalUrl && item.public_id) {
      // Image cleared by user (neither file nor URL provided, but old image exists)
      await deleteFromCloudinary(item.public_id);
      newImageUrl = null;
      newImagePublicId = null;
    }

    const { data: updatedItem, error } = await supabase
      .from('gallery_items')
      .update({
        title: nextTitle,
        description: nextDescription,
        image_url: newImageUrl,
        public_id: newImagePublicId,
      })
      .eq('id', id)
      .select(gallerySelect)
      .single();

    if (error) {
      throw error;
    }

    res.json({ message: "Gallery item updated", item: mapGalleryItem(updatedItem) });
  } catch (err) {
    console.error("Error updating gallery item:", err);
    res.status(500).json({ message: "Server error updating gallery item" });
  }
};

// DELETE gallery item (admin)
exports.deleteGalleryItem = async (req, res) => {
  try {
    const item = await fetchGalleryItemById(req.params.id);
    if (!item) return res.status(404).json({ message: "Gallery item not found" });

    // Delete image from Cloudinary if exists
    if (item.public_id) {
      // Assuming deleteFromCloudinary uses cloudinary.uploader.destroy internally
      await deleteFromCloudinary(item.public_id); 
    }

    // Delete from DB
    const { error } = await supabase.from('gallery_items').delete().eq('id', req.params.id);

    if (error) {
      throw error;
    }

    res.json({ message: "Gallery item removed" });
  } catch (err) {
    console.error("Error deleting gallery item:", err);
    res.status(500).json({ message: "Server error deleting gallery item" });
  }
};