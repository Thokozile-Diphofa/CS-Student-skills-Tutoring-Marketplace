const crypto = require("node:crypto");

const PAYFAST_IP_RANGES = [
  ["197.97.145.144", 28],
  ["41.74.179.192", 27],
  ["102.216.36.0", 28],
  ["102.216.36.128", 28],
  ["144.126.193.139", 32]
];

function encodePayfastValue(value) {
  return encodeURIComponent(String(value).trim())
    .replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, "+");
}

function buildPayfastParameterString(fields) {
  return Object.entries(fields)
    .filter(([name, value]) => name !== "signature" && value !== null && value !== undefined && String(value).trim() !== "")
    .map(([name, value]) => `${name}=${encodePayfastValue(value)}`)
    .join("&");
}

function generatePayfastSignature(fields, passphrase = "") {
  let parameterString = buildPayfastParameterString(fields);
  if (passphrase) parameterString += `&passphrase=${encodePayfastValue(passphrase)}`;
  return crypto.createHash("md5").update(parameterString).digest("hex");
}

function verifyPayfastSignature(fields, passphrase = "") {
  if (typeof fields.signature !== "string" || !/^[a-f0-9]{32}$/i.test(fields.signature)) return false;
  const expected = Buffer.from(generatePayfastSignature(fields, passphrase), "hex");
  const received = Buffer.from(fields.signature, "hex");
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function ipv4ToInteger(address) {
  const parts = address.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return null;
  return parts.reduce((value, part) => ((value << 8) | Number(part)) >>> 0, 0);
}

function isPayfastIp(address) {
  const normalizedAddress = typeof address === "string" ? address.replace(/^::ffff:/i, "") : "";
  const candidate = ipv4ToInteger(normalizedAddress);
  if (candidate === null) return false;

  return PAYFAST_IP_RANGES.some(([rangeAddress, prefix]) => {
    const range = ipv4ToInteger(rangeAddress);
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (candidate & mask) === (range & mask);
  });
}

function formatZarAmount(value) {
  const rawValue = typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : String(value ?? "").trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(rawValue);
  if (!match) return null;

  const whole = BigInt(match[1]).toString();
  const fraction = (match[2] || "").padEnd(2, "0");
  const amount = `${whole}.${fraction}`;
  return Number(amount) > 0 ? amount : null;
}

function getSandboxProcessUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.hostname !== "sandbox.payfast.co.za") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function getSandboxValidationUrl(value) {
  const processUrl = getSandboxProcessUrl(value);
  if (!processUrl) return null;
  return `${new URL(processUrl).origin}/eng/query/validate`;
}

module.exports = {
  buildPayfastParameterString,
  formatZarAmount,
  generatePayfastSignature,
  getSandboxProcessUrl,
  getSandboxValidationUrl,
  isPayfastIp,
  verifyPayfastSignature
};