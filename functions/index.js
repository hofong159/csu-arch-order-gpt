const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { getAuth } = require("firebase-admin/auth");
const crypto = require("node:crypto");

initializeApp();
const INITIAL_ADMIN_EMAIL = defineSecret("INITIAL_ADMIN_EMAIL");
const ORIGIN = "https://hofong159.github.io";
const db = getFirestore();
const bucket = getStorage().bucket("csu-order-system-af6bb.firebasestorage.app");
const attempts = new Map();
const publicCreateAttempts = new Map();

function safeEqual(actual, expected) {
  const a = Buffer.from(String(actual || ""), "utf8");
  const b = Buffer.from(String(expected || ""), "utf8");
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}
function codeHash(phone, code) {
  return crypto.createHash("sha256").update(String(phone).trim() + "|" + String(code).trim().toUpperCase()).digest("hex");
}
function cleanPhone(v) { return String(v || "").trim().replace(/[\s-]/g, ""); }
function sendError(res, status, message) { return res.status(status).json({ error: message }); }
function asDate(date, time) { return new Date(date + "T" + time + ":00+08:00"); }
function dateString(d) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Taipei", year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(d);
  const m = Object.fromEntries(parts.map(p => [p.type,p.value]));
  return m.year + "-" + m.month + "-" + m.day;
}
function timeString(d) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone:"Asia/Taipei", hour:"2-digit", minute:"2-digit", hourCycle:"h23" }).formatToParts(d);
  const m = Object.fromEntries(parts.map(p => [p.type,p.value]));
  return m.hour + ":" + m.minute;
}
function eachDate(start, end) {
  const dates = [];
  let d = new Date(start.getTime());
  while (dateString(d) <= dateString(end)) {
    const s = dateString(d);
    if (!dates.includes(s)) dates.push(s);
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  }
  return dates;
}
function overlaps(a, b, c, d) { return a < d && b > c; }
async function verifyCode(body) {
  const phone = cleanPhone(body.phone);
  const code = String(body.code || "").trim().toUpperCase();
  if (!phone || !code) throw new Error("請輸入申請時的手機號碼及查詢碼。");
  const snap = await db.collection("bookings").where("manageCodeHash", "==", codeHash(phone, code)).limit(2).get();
  const doc = snap.docs.find(d => cleanPhone(d.data().phone) === phone);
  if (!doc) throw new Error("手機號碼或查詢碼錯誤，請重新確認。");
  return { ref:doc.ref, id:doc.id, data:doc.data(), phone, code };
}
function publicBooking(d, id) {
  return {
    id, name:d.name || "", className:d.className || "", item:d.item || "", type:d.type || "",
    date:d.date || "", start:d.start || "", endTime:d.endTime || "", hours:d.hours || 0,
    status:d.status || "pending", purpose:d.purpose || "", checkedIn:!!d.checkedInAt,
    checkedOut:!!d.checkedOutAt, photoCount:(d.photos || []).length
  };
}

async function verifyAdminBearer(req, requireAdmin = true) {
  const header = String(req.get("authorization") || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) { const e = new Error("請重新登入管理員帳號。"); e.status = 401; throw e; }
  let claims;
  try { claims = await getAuth().verifyIdToken(match[1], true); }
  catch (_) { const e = new Error("登入狀態已失效，請重新登入。"); e.status = 401; throw e; }
  if (!claims.email || claims.email_verified !== true) {
    const e = new Error("管理員信箱尚未驗證。請先完成 Email 驗證。"); e.status = 403; throw e;
  }
  if (requireAdmin && claims.admin !== true) {
    const e = new Error("此帳號沒有管理員權限。"); e.status = 403; throw e;
  }
  return claims;
}

exports.bootstrapAdmin = onRequest(
  { region:"asia-east1", cors:[ORIGIN], secrets:[INITIAL_ADMIN_EMAIL], memory:"256MiB" },
  async (req, res) => {
    if (req.method !== "POST") return sendError(res,405,"只接受 POST 請求。");
    if (req.get("origin") && req.get("origin") !== ORIGIN) return sendError(res,403,"不允許的網站來源。");
    try {
      const claims = await verifyAdminBearer(req, false);
      const configuredEmail = String(INITIAL_ADMIN_EMAIL.value() || "").trim().toLowerCase();
      if (!configuredEmail || String(claims.email).toLowerCase() !== configuredEmail) {
        return sendError(res,403,"此 Email 不是初始管理員信箱。請確認 INITIAL_ADMIN_EMAIL 設定。");
      }
      const user = await getAuth().getUser(claims.uid);
      await getAuth().setCustomUserClaims(claims.uid, { ...(user.customClaims || {}), admin:true });
      return res.status(200).json({ ok:true, message:"初始管理員權限已設定，請刷新登入權杖。" });
    } catch (error) {
      return sendError(res,error.status || 400,error.message || "無法設定初始管理員權限。");
    }
  }
);

exports.createAdminUser = onRequest(
  { region:"asia-east1", cors:[ORIGIN], memory:"256MiB" },
  async (req, res) => {
    if (req.method !== "POST") return sendError(res,405,"只接受 POST 請求。");
    if (req.get("origin") && req.get("origin") !== ORIGIN) return sendError(res,403,"不允許的網站來源。");
    try {
      await verifyAdminBearer(req, true);
      const email = String(req.body?.email || "").trim().toLowerCase();
      const password = String(req.body?.password || "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendError(res,400,"請輸入有效的 Email。");
      if (password.length < 12) return sendError(res,400,"新管理員密碼至少需要 12 個字元。");
      if (password.length > 128) return sendError(res,400,"密碼太長，請使用 128 個字元以下的密碼。");
      let created;
      try {
        created = await getAuth().createUser({ email, password, emailVerified:false, disabled:false });
      } catch (error) {
        if (error.code === "auth/email-already-exists") return sendError(res,409,"這個 Email 已經有帳號，請改用其他 Email。");
        throw error;
      }
      try {
        await getAuth().setCustomUserClaims(created.uid, { admin:true });
      } catch (error) {
        await getAuth().deleteUser(created.uid).catch(() => {});
        throw error;
      }
      return res.status(201).json({ ok:true, uid:created.uid, email:created.email,
        message:"管理員帳號已建立。該管理員首次登入時會收到驗證信，完成驗證後才能使用後台。" });
    } catch (error) {
      return sendError(res,error.status || 400,error.message || "新增管理員失敗。");
    }
  }
);

// Public student workflow: no Firebase Authentication, no account, no sign-in screen.
// Personal records are protected by phone number plus a random, one-time-shown management code.
exports.publicBookingApi = onRequest(
  { region:"asia-east1", cors:[ORIGIN], memory:"512MiB", timeoutSeconds:60 },
  async (req, res) => {
    if (req.method !== "POST") return sendError(res,405,"只接受 POST 請求。");
    if (req.get("origin") && req.get("origin") !== ORIGIN) return sendError(res,403,"不允許的網站來源。");
    const body = req.body || {};
    const action = String(body.action || "");
    if (action === "create") {
      const ip = req.ip || "unknown", now = Date.now();
      let state = publicCreateAttempts.get(ip) || { count:0, resetAt:now + 10*60*1000 };
      if (now > state.resetAt) state = { count:0, resetAt:now + 10*60*1000 };
      if (state.count >= 12) return sendError(res,429,"短時間內申請次數過多，請稍後再試。");
      state.count++; publicCreateAttempts.set(ip,state);
    }
    try {
      if (action === "create") {
        const name = String(body.name || "").trim();
        const className = String(body.className || "").trim();
        const phone = cleanPhone(body.phone);
        const type = String(body.type || "");
        const itemId = String(body.itemId || "");
        const date = String(body.date || "");
        const startTime = String(body.start || "");
        const hours = Number(body.hours);
        if (!name || !className || !phone || !itemId || !date || !startTime) throw new Error("請填寫姓名、班級、手機、項目、日期及時間。");
        if (!/^[\d+()]{8,20}$/.test(phone)) throw new Error("手機號碼格式不正確。");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || Number(startTime.slice(3)) % 30 !== 0) throw new Error("日期或時間格式不正確，起始時間須以半小時為一格。");
        if (![3,6,9,12].includes(hours)) throw new Error("借用時數必須為 3 小時倍數。");
        const start = asDate(date,startTime), end = new Date(start.getTime() + hours * 3600000);
        if (start.getTime() <= Date.now()) throw new Error("不能申請已開始或過去的時段。");
        if (hours > 6) throw new Error("每次申請最多 6 小時；如需更長時間，請分次申請或洽管理員。");
        const today = dateString(new Date());
        if (date < today) throw new Error("不能申請過去日期。");
        const settingsSnap = await db.doc("settings/public").get();
        const settings = settingsSnap.exists ? (settingsSnap.data().settings || {}) : {};
        if (type === "micro" && settings.microOpen === false) throw new Error("微工坊目前暫停開放。");
        if (type === "output" && settings.outputOpen === false) throw new Error("出圖室目前暫停開放。");
        const itemSnap = await db.collection("items").doc(itemId).get();
        if (!itemSnap.exists || itemSnap.data().available === false) throw new Error("此項目不存在或目前不可用。");
        const item = itemSnap.data();
        if (item.category !== type && item.category !== "all") throw new Error("所選項目與申請分類不符。");
        if ((type === "micro" || type === "output") && body.agreedRules !== true) throw new Error("請先閱讀並同意該空間規範。");
        if (body.agreed !== true) throw new Error("請先同意借用責任與簽退規範。");
        const nightStart = asDate(date,"19:00"), morning = new Date(asDate(date,"00:00").getTime() + 32*3600000);
        if (start >= nightStart && start < morning && date === today && new Date() >= nightStart) throw new Error("夜間借用須於當日 19:00 前登記。");

        for (const day of eachDate(start,end)) {
          const rows = await db.collection("schedule").where("date","==",day).get();
          for (const row of rows.docs) {
            const course = row.data();
            if (course.itemId && course.itemId !== itemId) continue;
            const s = asDate(day,course.start), e = asDate(day,course.end);
            if (overlaps(start.getTime(),end.getTime(),s.getTime(),e.getTime())) throw new Error("與課表衝突："+day+" "+course.start+"–"+course.end+"，請改選時間。");
          }
        }
        const slots = [];
        for (let t = new Date(start); t < end; t = new Date(t.getTime()+30*60000)) {
          const day = dateString(t), hhmm = timeString(t);
          slots.push({ id:day+"_"+itemId+"_"+hhmm.replace(":",""), date:day, time:hhmm });
        }
        const newRef = db.collection("bookings").doc();
        const code = crypto.randomBytes(8).toString("hex").toUpperCase();
        const manageCodeHash = codeHash(phone,code);
        const laneRefs = [0,1].map(lane => slots.map(slot => db.collection("reservationLocks").doc(slot.id+"_"+lane)));
        await db.runTransaction(async tx => {
          const refs = laneRefs[0].concat(laneRefs[1]);
          const snaps = await Promise.all(refs.map(ref => tx.get(ref)));
          const n = slots.length;
          let lane = snaps.slice(0,n).every(s => !s.exists) ? 0 : (snaps.slice(n).every(s => !s.exists) ? 1 : -1);
          if (lane < 0) throw new Error("所選時段已額滿，每個區域每半小時最多兩組。");
          const lockIds = slots.map(slot => slot.id+"_"+lane);
          const booking = {
            type, name, className, phone, borrowType:String(body.borrowType||"單人借用"),
            itemId, item:item.name || "", date, start:startTime, hours,
            purpose:String(body.purpose||"").slice(0,1000), startAt:start.getTime(),
            endAt:end.getTime(), endDate:dateString(end), endTime:timeString(end),
            lockIds, status:"pending", manageCodeHash, photos:[], photoPaths:[],
            createdAt:FieldValue.serverTimestamp(), checkedInAt:null, checkedOutAt:null
          };
          tx.set(newRef,booking);
          slots.forEach((slot,i)=>tx.set(db.collection("reservationLocks").doc(lockIds[i]),{
            bookingId:newRef.id,itemId,date:slot.date,time:slot.time,lane,status:"active",createdAt:FieldValue.serverTimestamp()
          }));
        });
        return res.status(200).json({ bookingId:newRef.id, code, booking:publicBooking({name,className,item:item.name,type,date,start:startTime,hours,endTime:timeString(end),status:"pending"},newRef.id) });
      }

      if (action === "lookup" || action === "checkin" || action === "photoUploadUrls" || action === "checkout") {
        const found = await verifyCode(body);
        const data = found.data;
        if (action === "lookup") return res.status(200).json({ booking:publicBooking(data,found.id) });
        if (action === "checkin") {
          if (data.status !== "approved") throw new Error("只有已核准的申請才能簽到。");
          if (data.checkedInAt) throw new Error("此申請已完成簽到。");
          await found.ref.update({checkedInAt:FieldValue.serverTimestamp()});
          return res.status(200).json({ok:true,message:"簽到成功。"});
        }
        if (action === "photoUploadUrls") {
          if (!data.checkedInAt || data.checkedOutAt) throw new Error("請先完成簽到，且尚未簽退的申請才能上傳照片。");
          const files = Array.isArray(body.files) ? body.files : [];
          if (files.length < 1 || files.length > 5) throw new Error("請選擇 1 至 5 張照片。");
          const existing = data.photoPaths || [];
          if (existing.length + files.length > 5) throw new Error("最多只能上傳 5 張簽退照片。");
          const token = crypto.randomBytes(6).toString("hex");
          const upload = [];
          for (let i=0;i<files.length;i++) {
            const f=files[i]||{}, contentType=String(f.type||"");
            if (!["image/jpeg","image/png","image/webp","image/heic"].includes(contentType)) throw new Error("只接受 JPG、PNG、WebP 或 HEIC 圖片。");
            if (Number(f.size)>8*1024*1024) throw new Error("單張照片不可超過 8 MB。");
            const safeName=String(f.name||"image").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-90);
            const path="checkoutPhotos/"+found.id+"/"+token+"-"+i+"-"+safeName;
            const [url]=await bucket.file(path).getSignedUrl({version:"v4",action:"write",expires:Date.now()+10*60*1000,contentType});
            upload.push({path,url,contentType});
          }
          await found.ref.update({pendingPhotoPaths:upload.map(x=>x.path),pendingPhotoAt:Date.now()});
          return res.status(200).json({upload});
        }
        if (action === "checkout") {
          if (!data.checkedInAt || data.checkedOutAt) throw new Error("請確認已簽到且尚未簽退。");
          const paths = Array.isArray(body.paths) ? body.paths.map(String) : [];
          const pending = data.pendingPhotoPaths || [];
          if (paths.length < 1 || paths.length > 5 || paths.some(p=>!pending.includes(p)) || paths.length !== pending.length) throw new Error("照片清單不正確，請重新選取照片後送出。");
          const photos=[];
          for (const path of paths) {
            const f=bucket.file(path), [exists]=await f.exists();
            if (!exists) throw new Error("有照片尚未上傳完成，請重試。");
            const [url]=await f.getSignedUrl({version:"v4",action:"read",expires:Date.now()+7*24*3600000});
            photos.push(url);
          }
          await found.ref.update({checkedOutAt:FieldValue.serverTimestamp(),photos,photoPaths:paths,photoDeleteAfter:Date.now()+7*24*3600000,pendingPhotoPaths:FieldValue.delete(),pendingPhotoAt:FieldValue.delete()});
          return res.status(200).json({ok:true,message:"簽退完成，照片將於 7 天後自動清除。"});
        }
      }
      return sendError(res,400,"不支援的操作。");
    } catch (error) {
      return sendError(res,400,error.message || "操作失敗，請稍後再試。");
    }
  }
);

exports.deleteExpiredCheckoutPhotos = onSchedule(
  { schedule:"20 3 * * *", timeZone:"Asia/Taipei", region:"asia-east1", memory:"256MiB" },
  async () => {
    const now=Date.now();
    const snap=await db.collection("bookings").where("photoDeleteAfter","<=",now).get();
    for (const row of snap.docs) {
      const data=row.data();
      for (const path of data.photoPaths||[]) {
        try { await bucket.file(path).delete({ignoreNotFound:true}); }
        catch(e) { console.error("Photo cleanup failed",path,e); }
      }
      await row.ref.update({photos:[],photoPaths:[],photoDeleteAfter:null});
    }
    console.log("Expired photo cleanup checked "+snap.size+" booking(s).");
  }
);
