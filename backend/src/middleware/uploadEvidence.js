const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

const {
  allowedMimeTypes,
  mimeToExtension,
} = require("../utils/fileValidation");

const uploadDirectory = path.join(
  __dirname,
  "../../uploads"
);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },

  filename: (req, file, cb) => {
    const extension =
      mimeToExtension[file.mimetype] ||
      path.extname(file.originalname).toLowerCase();

    const uniqueName =
      `${Date.now()}-${crypto.randomUUID()}${extension}`;

    cb(null, uniqueName);
  },
});

const uploadEvidence = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    console.log(
      "Evidence upload MIME type:",
      file.mimetype
    );

    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(
        new Error(
          "Only JPEG, PNG, WEBP, and PDF files are allowed"
        )
      );
    }

    cb(null, true);
  },
});

module.exports = uploadEvidence;
