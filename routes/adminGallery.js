const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const { supabase } = require("../config/supabase");

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post("/gallery", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded." });
    }
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "bitsa_gallery" },
      async (err, result) => {
        if (err) {
          console.error("Cloudinary Upload Error:", err);
          return res.status(500).json({ message: "Error uploading to Cloudinary" });
        }

        const { data: newImage, error } = await supabase
          .from('gallery_items')
          .insert({
            title: req.body.title,
            description: req.body.description || '',
            image_url: result.secure_url,
            public_id: result.public_id,
          })
          .select('id,title,description,image_url,public_id,created_at')
          .single();

        if (error) {
          throw error;
        }

        res.status(201).json({
          id: newImage.id,
          title: newImage.title,
          description: newImage.description,
          imageUrl: newImage.image_url,
          publicId: newImage.public_id,
          createdAt: newImage.created_at,
        });
      }
    );

    uploadStream.end(req.file.buffer);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
});

module.exports = router;
