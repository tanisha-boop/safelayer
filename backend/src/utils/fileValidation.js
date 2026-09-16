const fs = require("fs/promises");

const mimeToExtension = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

const allowedMimeTypes = new Set(
  Object.keys(mimeToExtension)
);

const signatures = {
  "image/jpeg": (buffer) =>
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff,

  "image/png": (buffer) =>
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    ),

  "image/webp": (buffer) =>
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP",

  "application/pdf": (buffer) =>
    buffer.length >= 5 &&
    buffer.subarray(0, 5).toString("ascii") === "%PDF-",
};

async function validateFileContent(filePath, declaredMimeType) {
  if (!allowedMimeTypes.has(declaredMimeType)) {
    return false;
  }

  const buffer = await fs.readFile(filePath);

  const detector = signatures[declaredMimeType];

  if (!detector) {
    return false;
  }

  return detector(buffer);
}

module.exports = {
  allowedMimeTypes,
  mimeToExtension,
  validateFileContent,
};
