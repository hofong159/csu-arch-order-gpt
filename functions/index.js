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
