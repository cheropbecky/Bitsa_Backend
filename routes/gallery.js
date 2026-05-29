const express = require("express");
const router = express.Router();
const { verifyAdmin } = require("../middleware/authMiddleware");
const multer = require("multer");
const { uploadToCloudinary, deleteFromCloudinary } = require("../config/cloudinary");
const { supabase } = require("../config/supabase");

const storage = multer.memoryStorage();
const upload = multer({ storage });

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

router.post("/", verifyAdmin, upload.single("image"), async (req, res) => {
  try {
    let imageUrl = null;
    let publicId = null;

    if (req.body.imageUrl) {
      imageUrl = req.body.imageUrl;
    }

    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, "bitsa_gallery");
      imageUrl = result.url;
      publicId = result.publicId;
    }

    if (!imageUrl) {
      return res.status(400).json({ message: "Image file or URL required" });
    }

    const { data: newItem, error } = await supabase
      .from('gallery_items')
      .insert({
        title: req.body.title,
        description: req.body.description || '',
        image_url: imageUrl,
        public_id: publicId,
      })
      .select(gallerySelect)
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({ message: "Gallery item added", item: mapGalleryItem(newItem) });
  } catch (err) {
    console.error("Gallery creation error:", err);
    res.status(500).json({ message: "Failed to add gallery item" });
  }
});

router.get("/", async (req, res) => {
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
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const item = await fetchGalleryItemById(req.params.id);
    if (!item) return res.status(404).json({ message: "Gallery item not found" });
    res.json(mapGalleryItem(item));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", verifyAdmin, upload.single("image"), async (req, res) => {
  try {
    const item = await fetchGalleryItemById(req.params.id);
    if (!item) return res.status(404).json({ message: "Gallery item not found" });

    const { title, description, imageUrl } = req.body;

    const nextTitle = title || item.title;
    const nextDescription = description !== undefined ? description : item.description;
    let nextImageUrl = item.image_url;
    let nextPublicId = item.public_id;

    if (req.file) {
      if (item.public_id) {
        await deleteFromCloudinary(item.public_id);
      }
      
      const result = await uploadToCloudinary(req.file.buffer, "bitsa_gallery");
      nextImageUrl = result.url;
      nextPublicId = result.publicId;
    } else if (imageUrl) {
      if (item.public_id) {
        await deleteFromCloudinary(item.public_id);
      }
      nextImageUrl = imageUrl;
      nextPublicId = null;
    } else if (item.public_id) {
      await deleteFromCloudinary(item.public_id);
      nextImageUrl = null;
      nextPublicId = null;
    }

    const { data: updatedItem, error } = await supabase
      .from('gallery_items')
      .update({
        title: nextTitle,
        description: nextDescription,
        image_url: nextImageUrl,
        public_id: nextPublicId,
      })
      .eq('id', req.params.id)
      .select(gallerySelect)
      .single();

    if (error) {
      throw error;
    }

    res.json({ message: "Gallery item updated", item: mapGalleryItem(updatedItem) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", verifyAdmin, async (req, res) => {
  try {
    const item = await fetchGalleryItemById(req.params.id);
    if (!item) return res.status(404).json({ message: "Gallery item not found" });

    if (item.public_id) await deleteFromCloudinary(item.public_id);

    const { error } = await supabase.from('gallery_items').delete().eq('id', req.params.id);

    if (error) {
      throw error;
    }
    res.json({ message: "Gallery item deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;