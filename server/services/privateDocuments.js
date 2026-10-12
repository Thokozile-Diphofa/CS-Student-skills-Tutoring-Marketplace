const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const multer = require("multer");

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const MIME_BY_EXTENSION = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png"
};
const DEFAULT_UPLOAD_DIRECTORY = path.join(__dirname, "..", "private-documents");
const CLIENT_DIRECTORY = path.resolve(__dirname, "..", "..", "client");

function isInsideDirectory(parent, child) {
  const relativePath = path.relative(parent, child);
  return relativePath === ""
    || (!relativePath.startsWith(`..${path.sep}`) && relativePath !== ".." && !path.isAbsolute(relativePath));
}

function getPrivateUploadDirectory() {
  const configuredDirectory = process.env.PRIVATE_UPLOAD_DIR;
  if (process.env.NODE_ENV === "production" && !configuredDirectory) {
    throw new Error("PRIVATE_UPLOAD_DIR must point to the Render persistent disk mount.");
  }
  if (configuredDirectory && process.env.NODE_ENV === "production" && !path.isAbsolute(configuredDirectory)) {
    throw new Error("PRIVATE_UPLOAD_DIR must be an absolute path in production.");
  }
  const directory = path.resolve(configuredDirectory || DEFAULT_UPLOAD_DIRECTORY);
  if (isInsideDirectory(CLIENT_DIRECTORY, directory)) {
    throw new Error("PRIVATE_UPLOAD_DIR must not be inside the frontend directory.");
  }
  if (process.env.NODE_ENV === "production") {
    const repositoryDirectory = path.resolve(__dirname, "..", "..");
    if (isInsideDirectory(repositoryDirectory, directory)) {
      throw new Error("PRIVATE_UPLOAD_DIR must be outside the deployed source directory.");
    }
  }
  return directory;
}

async function ensurePrivateUploadDirectory() {
  const directory = getPrivateUploadDirectory();
  await fs.promises.mkdir(directory, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") await fs.promises.chmod(directory, 0o700);
  return directory;
}

const storage = multer.diskStorage({
  destination(req, file, callback) {
    ensurePrivateUploadDirectory().then(
      (directory) => callback(null, directory),
      (error) => callback(error)
    );
  },
  filename(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${randomUUID()}${extension}`);
  }
});

function validateDeclaredFile(file, callback) {
  const extension = path.extname(file.originalname).toLowerCase();
  const expectedMimeType = MIME_BY_EXTENSION[extension];
  if (!expectedMimeType || file.mimetype !== expectedMimeType) {
    const error = new Error("Upload a PDF, JPG, JPEG, or PNG file with a matching file type.");
    error.statusCode = 415;
    callback(error);
    return;
  }
  callback(null, true);
}

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_DOCUMENT_BYTES,
    files: 2,
    fields: 16,
    fieldSize: 16 * 1024,
    parts: 18
  },
  fileFilter: (req, file, callback) => validateDeclaredFile(file, callback)
});

function parseApplicationDocuments(req, res, next) {
  upload.fields([
    { name: "registration", maxCount: 1 },
    { name: "academicRecord", maxCount: 1 }
  ])(req, res, (error) => {
    if (!error) {
      Promise.all(getRequestFiles(req).map((file) => fs.promises.chmod(file.path, 0o600)))
        .then(() => next())
      .catch(async (chmodError) => {
        await removeUploadedFiles(getRequestFiles(req));
        console.error("Unable to secure tutor application document permissions:", chmodError);
        res.status(500).json({ error: "Unable to securely store the uploaded documents." });
      });
    return;
    }
    removeUploadedFiles(getRequestFiles(req)).finally(() => {
    const status = error instanceof multer.MulterError ? 400 : error.statusCode || 500;
      res.status(status).json({
        error: error.code === "LIMIT_FILE_SIZE"
          ? "Each document must be 5 MB or smaller."
          : error.message || "Unable to process uploaded documents."
      });
    });
  });
}

function parseReplacementDocument(req, res, next) {
  upload.single("document")(req, res, (error) => {
    if (!error) {
      if (!req.file) {
        res.status(400).json({ error: "Choose a replacement document to upload." });
        return;
      }
      fs.promises.chmod(req.file.path, 0o600).then(
        () => next(),
        async (chmodError) => {
          await removeUploadedFiles([req.file]);
          console.error("Unable to secure replacement tutor application document permissions:", chmodError);
          res.status(500).json({ error: "Unable to securely store the replacement document." });
        }
      );
      return;
    }
    removeUploadedFiles(req.file ? [req.file] : []).finally(() => {
      const status = error instanceof multer.MulterError ? 400 : error.statusCode || 500;
      res.status(status).json({
        error: error.code === "LIMIT_FILE_SIZE"
          ? "The replacement document must be 5 MB or smaller."
          : error.message || "Unable to process the replacement document."
      });
    });
  });
}

function getRequestFiles(req) {
  if (req.file) return [req.file];
  return Object.values(req.files || {}).flat();
}

async function validateFileSignature(file) {
  const handle = await fs.promises.open(file.path, "r");
  try {
    const header = Buffer.alloc(8);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const signature = header.subarray(0, bytesRead);
    const extension = path.extname(file.originalname).toLowerCase();
    const valid = extension === ".pdf"
      ? signature.subarray(0, 5).toString("ascii") === "%PDF-"
      : extension === ".png"
        ? signature.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        : extension === ".jpg" || extension === ".jpeg"
          ? signature.length >= 3 && signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff
          : false;
    if (!valid) {
      const error = new Error("The file contents do not match the selected document type.");
      error.statusCode = 415;
      throw error;
    }
  } finally {
    await handle.close();
  }
}

function getDocumentMetadata(file) {
  const originalName = file.originalname
    .split(/[\\/]/)
    .pop()
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 255);
  const extension = path.extname(file.originalname).toLowerCase();
  return {
    storageKey: path.basename(file.filename),
    originalName: originalName || `document${extension}`,
    mimeType: MIME_BY_EXTENSION[extension],
    sizeBytes: file.size
  };
}

function getStoredDocumentPath(storageKey) {
  if (typeof storageKey !== "string" || !/^[0-9a-f-]{36}\.(pdf|jpg|jpeg|png)$/i.test(storageKey)) {
    throw new Error("Invalid stored document reference.");
  }
  return path.join(getPrivateUploadDirectory(), storageKey);
}

async function removeUploadedFiles(files) {
  const uploadedFiles = Array.isArray(files) ? files : Object.values(files || {}).flat();
  for (const file of uploadedFiles) {
    try {
      await fs.promises.unlink(file.path);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("Unable to remove an unreferenced tutor application document:", error);
      }
    }
  }
}

async function removeStoredDocument(storageKey) {
  try {
    await fs.promises.unlink(getStoredDocumentPath(storageKey));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

module.exports = {
  MAX_DOCUMENT_BYTES,
  ensurePrivateUploadDirectory,
  getDocumentMetadata,
  getPrivateUploadDirectory,
  getStoredDocumentPath,
  parseApplicationDocuments,
  parseReplacementDocument,
  removeStoredDocument,
  removeUploadedFiles,
  validateFileSignature
};
