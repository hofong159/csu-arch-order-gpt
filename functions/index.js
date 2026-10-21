const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

initializeApp();

// Daily cleanup at 03:20 Asia/Taipei. app.js records photoDeleteAfter on checkout.
exports.deleteExpiredCheckoutPhotos = onSchedule(
  { schedule: "20 3 * * *", timeZone: "Asia/Taipei", region: "asia-east1", memory: "256MiB" },
  async () => {
    const db = getFirestore();
    const bucket = getStorage().bucket();
    const now = Date.now();
    const snap = await db.collection("bookings").where("photoDeleteAfter", "<=", now).get();

    for (const row of snap.docs) {
      const data = row.data();
      for (const path of data.photoPaths || []) {
        try {
          await bucket.file(path).delete({ ignoreNotFound: true });
        } catch (error) {
          console.error("Could not delete expired checkout photo", path, error);
        }
      }
      await row.ref.update({ photos: [], photoPaths: [], photoDeleteAfter: null });
    }
    console.log("Expired photo cleanup checked " + snap.size + " booking(s).");
  }
);


const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getAuth } = require("firebase-admin/auth");
const crypto = require("node:crypto");

const ADMIN_USERNAME = defineSecret("ADMIN_USERNAME");
const ADMIN_PASSWORD = defineSecret("ADMIN_PASSWORD");
const allowedOrigin = "https://hofong159.github.io";
const attempts = new Map();

function safeEqual(actual, expected) {
  const a = Buffer.from(String(actual ?? ""), "utf8");
  const b = Buffer.from(String(expected ?? ""), "utf8");
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

// Password validation stays on the server; the public site never contains the admin password.
exports.adminLogin = onRequest(
  {
    region: "asia-east1",
    cors: [allowedOrigin],
    secrets: [ADMIN_USERNAME, ADMIN_PASSWORD],
    memory: "256MiB"
  },
  async (req, res) => {
    const origin = req.get("origin");
    if (origin && origin !== allowedOrigin) {
      return res.status(403).json({ message: "不允許的來源網站。" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ message: "只接受 POST 請求。" });
    }

    const ip = req.ip || "unknown";
    const now = Date.now();
    const record = attempts.get(ip) || { count: 0, resetAt: now + 10 * 60 * 1000 };
    if (now > record.resetAt) {
      record.count = 0;
      record.resetAt = now + 10 * 60 * 1000;
    }
    if (record.count >= 8) {
      return res.status(429).json({ message: "登入嘗試過多，請稍後再試。" });
    }

    const body = req.body || {};
    const username = String(body.username || "");
    const password = String(body.password || "");
    const expectedUser = ADMIN_USERNAME.value();
    const expectedPassword = ADMIN_PASSWORD.value();

    if (!expectedUser || !expectedPassword) {
      console.error("Admin login secrets are not configured.");
      return res.status(503).json({ message: "管理員登入服務尚未完成設定。" });
    }

    const matched = safeEqual(username, expectedUser) && safeEqual(password, expectedPassword);
    if (!matched) {
      record.count += 1;
      attempts.set(ip, record);
      return res.status(401).json({ message: "管理員帳號或密碼錯誤。" });
    }

    attempts.delete(ip);
    try {
      const token = await getAuth().createCustomToken("csu-site-admin", { admin: true });
      return res.status(200).json({ token });
    } catch (error) {
      console.error("Could not mint admin custom token.", error);
      return res.status(500).json({ message: "無法建立管理員登入狀態，請稍後重試。" });
    }
  }
);
