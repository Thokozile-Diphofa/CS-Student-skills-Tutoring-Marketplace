const { randomUUID } = require("node:crypto");
const multer = require("multer");
const supabaseSdk = require("@supabase/supabase-js");

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const SIGNED_URL_EXPIRY_SECONDS = 5 * 60;
const MIME_BY_EXTENSION = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png"
};
const DOCUMENT_STORAGE_ERROR =
  "Private document storage is unavailable. Configure durable private storage with SUPABASE_URL, SUPABASE_SECRET_KEY, and SUPABASE_BUCKET before processing application documents.";

let supabaseClient;
let supabaseClientConfiguration;

function getStorageConfiguration() {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_BUCKET } = process.env;
  if (!SUPABASE_URL?.trim() || !SUPABASE_SECRET_KEY?.trim() || !SUPABASE_BUCKET?.trim()) {
    const error = new Error(DOCUMENT_STORAGE_ERROR);
    error.statusCode = 503;
    throw error;
  }
  return {
    url: SUPABASE_URL.trim(),
    secretKey: SUPABASE_SECRET_KEY.trim(),
    bucket: SUPABASE_BUCKET.trim()
  };
}

function hasPrivateDocumentStorageConfiguration() {
  try {
    getStorageConfiguration();
    return true;
  } catch (error) {
    if (error.statusCode === 503) return false;
    throw error;
  }
}

function getSupabaseClient(configuration) {
  if (
    !supabaseClient
    || supabaseClientConfiguration.url !== configuration.url
    || supabaseClientConfiguration.secretKey !== configuration.secretKey
  ) {
    supabaseClient = supabaseSdk.createClient(configuration.url, configuration.secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    supabaseClientConfiguration = configuration;
  }
  return supabaseClient;
}

function createStorageOperationError(operation) {
  const error = new Error("Private document storage operation failed.");
  error.storageOperation = operation;
  error.statusCode = 500;
  return error;
}

async function performStorageOperation(operation, callback) {
  try {
    const { data, error } = await callback();
    if (error) throw createStorageOperationError(operation);
    return data;
  } catch (error) {
    if (error.storageOperation === operation) throw error;
    throw createStorageOperationError(operation);
  }
}

function requirePrivateDocumentStorage(req, res, next) {
  if (!hasPrivateDocumentStorageConfiguration()) {
    return res.status(503).json({ error: DOCUMENT_STORAGE_ERROR });
  }
  next();
}

function requirePrivateStorageForApproval(req, res, next) {
  if (req.body?.status === "APPROVED") {
    return requirePrivateDocumentStorage(req, res, next);
  }
  next();
}

function validateDeclaredFile(file, callback) {
  const extension = file.originalname.split(/[\\/]/).pop().toLowerCase();
  const expectedMimeType = MIME_BY_EXTENSION[extension.slice(extension.lastIndexOf("."))];
  if (!expectedMimeType || file.mimetype !== expectedMimeType) {
    const error = new Error("Upload a PDF, JPG, JPEG, or PNG file with a matching file type.");
    error.statusCode = 415;
    callback(error);
    return;
  }
  callback(null, true);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_DOCUMENT_BYTES,
    files: 2,
    fields: 16,
    fieldSize: 16 * 1024,
    parts: 18
  },
  fileFilter: (req, file, callback) => validateDeclaredFile(file, callback)
});

function respondToUploadError(error, res, message) {
  const status = error instanceof multer.MulterError ? 400 : error.statusCode || 500;
  res.status(status).json({
    error: error.code === "LIMIT_FILE_SIZE"
      ? message
      : error.message || "Unable to process uploaded documents."
  });
}

function parseApplicationDocuments(req, res, next) {
  upload.fields([
    { name: "registration", maxCount: 1 },
    { name: "academicRecord", maxCount: 1 }
  ])(req, res, (error) => {
    if (!error) return next();
    respondToUploadError(error, res, "Each document must be 5 MB or smaller.");
  });
}

function parseReplacementDocument(req, res, next) {
  upload.single("document")(req, res, (error) => {
    if (!error) {
      if (!req.file) {
        res.status(400).json({ error: "Choose a replacement document to upload." });
        return;
      }
      next();
      return;
    }
    respondToUploadError(error, res, "The replacement document must be 5 MB or smaller.");
  });
}

async function validateFileSignature(file) {
  const header = file.buffer.subarray(0, 8);
  const extension = file.originalname.split(/[\\/]/).pop().toLowerCase();
  const suffix = extension.slice(extension.lastIndexOf("."));
  const valid = suffix === ".pdf"
    ? header.subarray(0, 5).toString("ascii") === "%PDF-"
    : suffix === ".png"
      ? header.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : suffix === ".jpg" || suffix === ".jpeg"
        ? header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
        : false;
  if (!valid) {
    const error = new Error("The file contents do not match the selected document type.");
    error.statusCode = 415;
    throw error;
  }
}

function getDocumentMetadata(file) {
  const baseName = file.originalname.split(/[\\/]/).pop();
  const extension = baseName.slice(baseName.lastIndexOf(".")).toLowerCase();
  const originalName = baseName
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 255) || `document${extension}`;
  return {
    storageKey: `${randomUUID()}${extension}`,
    originalName,
    mimeType: MIME_BY_EXTENSION[extension],
    sizeBytes: file.size
  };
}

function validateStorageKey(storageKey) {
  if (typeof storageKey !== "string" || !/^[0-9a-f-]{36}\.(pdf|jpg|jpeg|png)$/i.test(storageKey)) {
    throw new Error("Invalid stored document reference.");
  }
  return storageKey;
}

async function storeUploadedDocument(file) {
  const configuration = getStorageConfiguration();
  const metadata = getDocumentMetadata(file);
  file.storageKey = metadata.storageKey;
  await performStorageOperation("upload", () => getSupabaseClient(configuration)
    .storage
    .from(configuration.bucket)
    .upload(metadata.storageKey, file.buffer, {
      contentType: metadata.mimeType,
      upsert: false
    }));
  return metadata;
}

async function getSignedDocumentUrl(storageKey, downloadName) {
  const key = validateStorageKey(storageKey);
  const configuration = getStorageConfiguration();
  const result = await performStorageOperation("signed-url", () => getSupabaseClient(configuration)
    .storage
    .from(configuration.bucket)
    .createSignedUrl(key, SIGNED_URL_EXPIRY_SECONDS, { download: downloadName }));
  if (typeof result?.signedUrl !== "string" || !result.signedUrl) {
    throw createStorageOperationError("signed-url");
  }
  return result.signedUrl;
}

async function removeStoredDocument(storageKey) {
  const key = validateStorageKey(storageKey);
  const configuration = getStorageConfiguration();
  await performStorageOperation("delete", () => getSupabaseClient(configuration)
    .storage
    .from(configuration.bucket)
    .remove([key]));
}

async function removeUploadedFiles(files) {
  const uploadedFiles = Array.isArray(files) ? files : Object.values(files || {}).flat();
  for (const file of uploadedFiles) {
    if (!file?.storageKey) continue;
    try {
      await removeStoredDocument(file.storageKey);
    } catch (error) {
      console.error("Unable to remove an unreferenced tutor application document.", {
        operation: error.storageOperation || "delete"
      });
    }
  }
}

module.exports = {
  MAX_DOCUMENT_BYTES,
  getDocumentMetadata,
  getSignedDocumentUrl,
  hasPrivateDocumentStorageConfiguration,
  parseApplicationDocuments,
  parseReplacementDocument,
  requirePrivateDocumentStorage,
  requirePrivateStorageForApproval,
  removeStoredDocument,
  removeUploadedFiles,
  storeUploadedDocument,
  validateFileSignature
};
