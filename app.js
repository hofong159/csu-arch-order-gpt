// No-billing version: Firebase Authentication + Cloud Firestore only.
// Students do not sign in. A 128-bit random booking code acts as the bearer lookup key.
const $ = s => document.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const INITIAL_ADMIN_EMAIL = "hofong159@gmail.com";
let sdk = {}, app = null, auth = null, db = null, firebaseConfig = null;
let config = {items:[], rules:{}, settings:{}}, currentView = "booking", adminUser = null;
const labels = {booking:"空間預約", borrowing:"雙向借用", micro:"借用正修微工坊", output:"借用出圖室", records:"我的申請／簽到簽退"};
const BASELINE_SPACES = [
  {code:"A", name:"A區"},
  {code:"B", name:"B區"},
  {code:"C", name:"C區"},
  {code:"D", name:"D區"},
  {code:"E", name:"E區"},
  {code:"F", name:"F區"},
  {code:"G", name:"G區"},
  {code:"H", name:"H區"},
  {code:"review1", name:"總評一區"},
  {code:"review2", name:"總評二區"}
];
const BASELINE_COURSES = [
  {area:"A",start:"13:00",end:"13:45",title:"基本設計(一)／商博淵"},
  {area:"A",start:"13:50",end:"14:35",title:"建築與室內設計(1)／張龍吉"},
  {area:"A",start:"14:40",end:"15:25",title:"建築與室內設計(3)／梁俊仁"},
  {area:"A",start:"15:30",end:"16:15",title:"建築與室內設計(5)／陳柏志"},
  {area:"B",start:"13:50",end:"14:35",title:"建築與室內設計(1)／蔣曉梅"},
  {area:"B",start:"14:40",end:"15:25",title:"建築與室內設計(3)／黃宏傑"},
  {area:"B",start:"15:30",end:"16:15",title:"建築與室內設計(5)／龔天發"},
  {area:"C",start:"13:00",end:"13:45",title:"基本設計(一)／邱建銘"},
  {area:"C",start:"13:50",end:"14:35",title:"建築與室內設計(1)／吳建璋"},
  {area:"C",start:"14:40",end:"15:25",title:"建築與室內設計(3)／黃克明"},
  {area:"C",start:"15:30",end:"16:15",title:"建築與室內設計(5)／辜達齊"},
  {area:"D",start:"13:00",end:"13:45",title:"基本設計(一)／鄭尊仁"},
  {area:"D",start:"13:50",end:"14:35",title:"建築與室內設計(1)／謝志昌"},
  {area:"D",start:"14:40",end:"15:25",title:"建築與室內設計(3)／姜景龍"},
  {area:"D",start:"15:30",end:"16:15",title:"建築與室內設計(5)／曾亮"},
  {area:"F",start:"13:00",end:"13:45",title:"基本設計(一)／郭怡君"},
  {area:"F",start:"13:50",end:"14:35",title:"建築與室內設計(1)／鍾佳霖"}
];
const BASELINE_LEGACY_BOOKINGS = [
  {key:"A_20261023_2330", code:"a0000000000000000000000000000001", area:"A", name:"楊○宇", borrowType:"小組借用", date:"2026-10-23", start:"23:30", endDate:"2026-10-24", endTime:"11:30"},
  {key:"H_20261022_1700", code:"b0000000000000000000000000000002", area:"H", name:"顏○晰", borrowType:"單人借用", date:"2026-10-22", start:"17:00", endDate:"2026-10-27", endTime:"17:00"}
];
const defaultRules = {
  booking:"每區最多兩組，單組不得獨占。請愛惜空間與設備，使用後清潔復原。",
  borrowing:"借出及歸還時請確認物品狀況，並依管理員公告辦理。",
  micro:"使用前確認機器狀態並遵守操作規範，操作時請配戴必要防護具。",
  output:"使用前確認設備與檔案設定；離開前整理環境並帶走個人物品。"
};
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const today = () => {
  const d = new Date();
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
};
const localDate = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
const fmt = d => String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
const dateTime = (date,time) => new Date(date+"T"+time+":00");
const cleanPhone = p => String(p||"").trim().replace(/[\s-]/g,"");
function toast(s){const n=$("#toast");if(!n)return;n.textContent=s;n.classList.add("show");setTimeout(()=>n.classList.remove("show"),3200)}
function feedback(id,s,error=false){const n=$("#"+id);if(n){n.textContent=s||"";n.classList.toggle("error",!!error)}}
function randomCode(){
  const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
  return [...bytes].map(b=>b.toString(16).padStart(2,"0")).join("");
}
function getItems(type){return config.items.filter(i=>i.category===type||i.category==="all")}
function timeOptions(){let s="";for(let h=0;h<24;h++)for(const m of ["00","30"]){const t=String(h).padStart(2,"0")+":"+m;s+='<option value="'+t+'">'+t+"</option>"}return s}
function itemOptions(type){return '<option value="">請選擇空間／設備</option>'+getItems(type).map(i=>'<option value="'+esc(i.id)+'" '+(i.available===false?"disabled":"")+'>'+esc(i.name)+(i.available===false?"（暫停借用）":"")+"</option>").join("")}
async function loadConfig(){
  const [settingsSnap,itemsSnap] = await Promise.all([
    sdk.getDoc(sdk.doc(db,"settings","public")),
    sdk.getDocs(sdk.collection(db,"items"))
  ]);
  if(settingsSnap.exists())config={...config,...settingsSnap.data()};
  config.items=itemsSnap.docs.map(d=>({id:d.id,...d.data()}));
}
function requestForm(type,title){
  const available=getItems(type), workshop=["micro","output"].includes(type);
  return '<h2>'+esc(title)+'</h2><p class="muted">學生免登入，直接填表申請。送出後請保存查詢碼，之後使用手機號碼＋查詢碼查詢、簽到及簽退。</p>'+
    (available.length?"":'<div class="notice">目前尚未建立此分類的空間／設備，請管理員先新增項目。</div>')+
    '<form id="requestForm"><div class="grid">'+
    '<label class="field">姓名 *<input id="personName" required maxlength="60"></label>'+
    '<label class="field">班級／單位 *<input id="className" required maxlength="80" placeholder="例如：建築四甲"></label>'+
    '<label class="field">手機號碼 *<input id="phone" type="tel" required maxlength="30" placeholder="09xxxxxxxx"></label>'+
    '<label class="field">借用方式<select id="borrowType"><option value="單人借用">單人借用</option><option value="小組借用">小組借用</option></select></label>'+
    '<label class="field">空間／設備 *<select id="item" required>'+itemOptions(type)+'</select></label>'+
    '<label class="field">開始日期 *<input id="date" type="date" value="'+today()+'" min="'+today()+'" required></label>'+
    '<label class="field">開始時間 *<select id="start" required>'+timeOptions()+'</select></label>'+
    '<label class="field">借用時數 *<select id="hours"><option value="3">3 小時</option><option value="6">6 小時</option></select></label></div>'+
    '<label class="field">用途／備註<textarea id="purpose" maxlength="1000" placeholder="簡述使用目的、材料或設備需求"></textarea></label>'+
    (workshop?'<h3>使用規範與注意事項</h3><div class="rule">'+esc(config.rules[type]||defaultRules[type])+'</div><label class="check"><input id="agreeRules" type="checkbox"><span>我已閱讀並同意遵守上述規範。</span></label>':"")+
    '<label class="check"><input id="agree" type="checkbox"><span>我會對本人／全組使用負責，離場前清潔復原並完成簽退；簽退時需上傳現況照片。</span></label>'+
    '<div class="notice">'+esc(config.settings.notice||"原站規則：起始時間每 30 分鐘一格；借用時數以 3 小時為倍數，建議不超過 6 小時。夜間 19:00 至翌日 08:00 須在 19:00 前登記；寒暑假開放情況依管理員公告。21:30 現場無人將鎖門。")+'</div>'+
    '<p id="requestMessage" class="feedback" role="status"></p><div id="receipt" class="notice hidden"></div><button class="primary full" type="submit" '+(available.length?"":"disabled")+'>送出申請</button></form>';
}
function render(){
  $$(".tab").forEach(b=>b.classList.toggle("active",b.dataset.view===currentView));
  const v=$("#view");if(!v)return;
  if(currentView==="booking")v.innerHTML=requestForm("booking","正修建築圖科九樓設計教室空間預約");
  else if(currentView==="borrowing")v.innerHTML=requestForm("borrowing","設備借還登記（雙向借用）");
  else if(currentView==="micro"||currentView==="output"){
    const closed=config.settings[currentView+"Open"]===false;
    const cards=getItems(currentView).map(i=>'<article class="item"><h3>'+esc(i.name)+'</h3><span class="status '+(i.available===false?"off":"")+'">'+(i.available===false?"目前不可用":"可用")+'</span><p>'+esc(i.description||"請依現場公告及管理員指示使用。")+'</p></article>').join("");
    v.innerHTML='<div class="notice">'+labels[currentView]+'目前：<b>'+(closed?"暫停開放":"開放申請")+'</b></div>'+(closed?"<p>目前暫停申請，請留意管理員公告。</p>":'<div class="cards">'+(cards||'<p class="muted">目前尚未建立機器或設備清單。</p>')+'</div>'+requestForm(currentView,labels[currentView]));
  }else{
    v.innerHTML='<h2>我的申請／簽到簽退</h2><p class="muted">學生免登入。請使用申請時取得的查詢碼和原本填寫的手機號碼；遺失查詢碼後，無法從公開頁面找回。</p>'+
      '<div class="grid"><label class="field">申請時的手機號碼<input id="lookupPhone" type="tel" required></label><label class="field">申請查詢碼<input id="lookupCode" maxlength="32" required placeholder="32 碼英數查詢碼"></label></div>'+
      '<button id="lookupBtn" class="primary">查詢我的申請</button><p id="lookupMessage" class="feedback" role="status"></p><div id="myRecords"></div>';
    $("#lookupBtn").onclick=loadMine;
  }
  const f=$("#requestForm");if(f)f.onsubmit=submitRequest;
}
function intersect(a,b,c,d){return a<d&&b>c}
async function checkCourseConflicts(start,end,itemId){
  const dates=new Set();for(let d=new Date(start);d<end;d.setDate(d.getDate()+1))dates.add(localDate(d));
  for(const day of dates){
    const q=await sdk.getDocs(sdk.query(sdk.collection(db,"schedule"),sdk.where("date","==",day)));
    for(const docSnap of q.docs){
      const course=docSnap.data();if(course.itemId&&course.itemId!==itemId)continue;
      const s=dateTime(day,course.start),e=dateTime(day,course.end);
      if(intersect(start.getTime(),end.getTime(),s.getTime(),e.getTime()))throw new Error("與課表衝突："+day+" "+course.start+"–"+course.end+"，請改選時間。");
    }
  }
}
async function submitRequest(e){
  e.preventDefault();
  const val=id=>$("#"+id)?.value?.trim()||"",type=currentView;
  const itemId=val("item"),item=config.items.find(i=>i.id===itemId),hours=Number(val("hours"));
  try{
    feedback("requestMessage","");
    if(!val("personName")||!val("className")||!val("phone")||!itemId||!val("date"))throw new Error("請完整填寫姓名、班級、手機、空間／設備及日期。");
    if(!item||item.available===false)throw new Error("此空間／設備目前不可用。");
    if(type==="micro"&&config.settings.microOpen===false||type==="output"&&config.settings.outputOpen===false)throw new Error("此空間目前暫停開放。");
    if(["micro","output"].includes(type)&&!$("#agreeRules").checked)throw new Error("請先閱讀並同意使用規範。");
    if(!$("#agree").checked)throw new Error("請先勾選使用責任與簽退規範。");
    if(![3,6].includes(hours))throw new Error("借用時數需為 3 或 6 小時。");
    if(val("date")<today())throw new Error("不能申請過去日期。");
    const start=dateTime(val("date"),val("start")),end=new Date(start.getTime()+hours*3600000);
    if(start.getTime()<=Date.now())throw new Error("不能申請已開始或過去的時段。");
    await checkCourseConflicts(start,end,itemId);
    const slots=[];for(let d=new Date(start);d<end;d=new Date(d.getTime()+30*60000)){const date=localDate(d),time=fmt(d);slots.push({date,time,key:date+"_"+itemId+"_"+time.replace(":","")})}
    const code=randomCode(), bookingRef=sdk.doc(db,"bookings",code);
    const lanes=[0,1].map(lane=>slots.map(slot=>sdk.doc(db,"reservationLocks",slot.key+"_"+lane)));
    await sdk.runTransaction(db,async tx=>{
      const refs=lanes[0].concat(lanes[1]);
      const snaps=await Promise.all(refs.map(ref=>tx.get(ref)));
      const n=slots.length;
      const lane=snaps.slice(0,n).every(s=>!s.exists())?0:(snaps.slice(n).every(s=>!s.exists())?1:-1);
      if(lane<0)throw new Error("此區域時段已額滿（每區每半小時最多兩組），請選擇其他時間。");
      const lockIds=slots.map(s=>s.key+"_"+lane);
      tx.set(bookingRef,{
        name:val("personName"),className:val("className"),phone:cleanPhone(val("phone")),
        borrowType:val("borrowType"),type,itemId,item:item.name,date:val("date"),start:val("start"),
        hours,purpose:val("purpose"),status:"pending",startAt:start.getTime(),endAt:end.getTime(),
        endDate:localDate(end),endTime:fmt(end),lockIds,photoIds:[],createdAt:sdk.serverTimestamp(),
        checkedInAt:null,checkedOutAt:null
      });
      slots.forEach((slot,i)=>tx.set(sdk.doc(db,"reservationLocks",lockIds[i]),{
        bookingId:code,lockId:lockIds[i],itemId,date:slot.date,time:slot.time,lane,status:"active",createdAt:sdk.serverTimestamp()
      }));
    });
    const receipt=$("#receipt");receipt.classList.remove("hidden");
    receipt.innerHTML='<b>申請已送出，狀態：待審核</b><p>預約查詢碼：<strong style="font-size:22px;letter-spacing:.08em">'+esc(code)+'</strong></p><p>請立即保存這組查詢碼；之後需同時輸入手機號碼與查詢碼。查詢碼只顯示這一次。</p><button type="button" id="copyCode" class="secondary">複製查詢碼</button>';
    $("#copyCode").onclick=async()=>{try{await navigator.clipboard.writeText(code);toast("查詢碼已複製")}catch{toast("請手動抄下查詢碼："+code)}};
    feedback("requestMessage","申請已送出。請保存上方查詢碼。");e.target.reset();$("#date").value=today();toast("申請已送出");
  }catch(err){feedback("requestMessage",err.message||"送出失敗，請稍後重試。",true)}
}
function statusLabel(s){return ({pending:"待審核",approved:"已核准",rejected:"未核准",cancelled:"已取消",finished:"已完成"})[s]||s||"未知"}
async function loadMine(){
  const phone=cleanPhone($("#lookupPhone").value),code=$("#lookupCode").value.trim().toLowerCase();
  if(!phone||!/^[a-f0-9]{32}$/.test(code)){feedback("lookupMessage","請輸入手機號碼及完整 32 碼查詢碼。",true);return}
  try{
    const snap=await sdk.getDoc(sdk.doc(db,"bookings",code));
    if(!snap.exists())throw new Error("查無此申請，請確認查詢碼。");
    const data=snap.data();
    if(cleanPhone(data.phone)!==phone)throw new Error("手機號碼或查詢碼不正確。");
    $("#myRecords").innerHTML=recordCard(data,code);feedback("lookupMessage","查詢成功。");
    if($("#checkinBtn"))$("#checkinBtn").onclick=async()=>{try{
      await sdk.updateDoc(sdk.doc(db,"bookings",code),{checkedInAt:sdk.serverTimestamp()});toast("簽到成功");await loadMine();
    }catch(e){feedback("lookupMessage",friendlyError(e),true)}};
    if($("#checkoutBtn"))$("#checkoutBtn").onclick=()=>checkout(code);
  }catch(e){$("#myRecords").innerHTML="";feedback("lookupMessage",friendlyError(e),true)}
}
function recordCard(d,code){
  return '<article class="item"><h3>'+esc(d.item)+'</h3><p>申請人：'+esc(d.name)+'（'+esc(d.className)+'）</p><p>日期：'+esc(d.date)+'　時段：'+esc(d.start)+'–'+esc(d.endTime)+'（'+esc(d.hours)+' 小時）</p><p>狀態：<b>'+esc(statusLabel(d.status))+'</b></p><p>簽到：'+(d.checkedInAt?"已完成":"尚未簽到")+'；簽退：'+(d.checkedOutAt?"已完成":"尚未簽退")+'</p>'+
    (d.status==="approved"&&!d.checkedInAt?'<button id="checkinBtn" class="primary">到場簽到</button>':"")+
    (d.checkedInAt&&!d.checkedOutAt?'<button id="checkoutBtn" class="primary">簽退並上傳照片</button>':"")+
    (d.status==="pending"?'<p class="muted">申請正在等待管理員核准。</p>':"")+
    (d.status==="rejected"||d.status==="cancelled"?'<p class="muted">此申請未核准或已取消。</p>':"")+
    ((d.photoIds||[]).length?'<p class="muted">已回傳 '+d.photoIds.length+' 張簽退照片。</p>':"")+'</article>';
}
async function compressImage(file){
  const bitmap=await createImageBitmap(file);
  const max=1000,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const context=canvas.getContext("2d");context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("圖片壓縮失敗。")),"image/jpeg",0.68));
  return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("讀取圖片失敗。"));reader.readAsDataURL(blob)});
}
async function checkout(code){
  const picker=document.createElement("input");picker.type="file";picker.accept="image/*";picker.multiple=true;
  picker.onchange=async()=>{
    const files=[...(picker.files||[])];if(files.length<1||files.length>5){toast("請選擇 1 至 5 張照片");return}
    const status=$("#lookupMessage");
    try{
      const bookingSnap=await sdk.getDoc(sdk.doc(db,"bookings",code));
      if(!bookingSnap.exists())throw new Error("查無此申請。");
      const booking=bookingSnap.data();if(booking.checkedOutAt)throw new Error("此申請已簽退。");
      const photoIds=[];
      for(const file of files){
        const dataUrl=await compressImage(file);
        if(dataUrl.length>700000)throw new Error("壓縮後單張照片仍太大，請選擇較小圖片。");
        const photoRef=sdk.doc(sdk.collection(db,"bookings",code,"photos"));
        await sdk.setDoc(photoRef,{dataUrl,name:file.name.slice(0,100),contentType:"image/jpeg",createdAt:sdk.serverTimestamp()});
        photoIds.push(photoRef.id);
      }
      await sdk.updateDoc(sdk.doc(db,"bookings",code),{checkedOutAt:sdk.serverTimestamp(),photoIds});
      toast("簽退完成，照片已儲存");await loadMine();
    }catch(e){feedback("lookupMessage",friendlyError(e),true)}
  };
  picker.click();
}
function friendlyError(e){
  const message=e?.message||String(e||"操作失敗。");
  if(e?.code==="permission-denied")return "Firebase 權限規則尚未更新。請執行新版免計費部署腳本，或確認 Firestore Rules 已發布。";
  if(e?.code==="unavailable")return "Firebase 目前無法連線，請檢查網路後重試。";
  return message;
}
async function cleanupExpiredPhotos(){
  if(!adminUser)return;
  try{
    const cutoff=new Date(Date.now()-7*24*60*60*1000);
    const q=await sdk.getDocs(sdk.query(sdk.collection(db,"bookings"),sdk.where("checkedOutAt","<=",sdk.Timestamp.fromDate(cutoff))));
    let cleaned=0;
    for(const b of q.docs){
      const d=b.data();if(!(d.photoIds||[]).length)continue;
      const photos=await sdk.getDocs(sdk.collection(db,"bookings",b.id,"photos"));
      for(const p of photos.docs)await sdk.deleteDoc(p.ref);
      await sdk.updateDoc(b.ref,{photoIds:[]});cleaned+=photos.size;
    }
    if(cleaned)toast("已清理 "+cleaned+" 張超過 7 天的照片");
  }catch(e){console.warn("Expired photo cleanup did not run",e)}
}
async function callAdminSignIn(email,password){
  return sdk.signInWithEmailAndPassword(auth,email,password);
}
async function loginAdmin(){
  const email=$("#adminEmail").value.trim().toLowerCase(),password=$("#adminPassword").value,button=$("#loginBtn"),label=button.textContent;
  if(!email||!password){feedback("loginError","請輸入管理員 Email 與密碼。",true);return}
  button.disabled=true;button.textContent="登入中…";
  try{
    const credential=await callAdminSignIn(email,password);
    const user=credential.user;
    let allowed=email===INITIAL_ADMIN_EMAIL;
    if(!allowed){const grant=await sdk.getDoc(sdk.doc(db,"adminUsers",email));allowed=grant.exists()}
    if(!allowed){await sdk.signOut(auth);throw new Error("帳號或密碼正確，但尚未被授予管理員權限。請使用初始管理員帳號新增此 Email。")}
    adminUser=user;$("#adminPassword").value="";feedback("loginError","");
    await showAdmin();await cleanupExpiredPhotos();
  }catch(e){
    let message=friendlyError(e);
    if(e.code==="auth/operation-not-allowed")message="請到 Firebase Authentication → 登入方式，啟用「電子郵件／密碼」。不需要啟用匿名登入。";
    else if(e.code==="auth/invalid-credential"||e.code==="auth/wrong-password"||e.code==="auth/user-not-found")message="Email 或密碼錯誤，請確認 Firebase Authentication 的使用者清單。";
    feedback("loginError",message,true);
  }finally{button.disabled=false;button.textContent=label}
}
async function showAdmin(){
  const p=$("#adminPanel");p.classList.remove("hidden");
  p.innerHTML='<div class="admin-tools"><h2>管理員設定中心</h2><div class="admin-nav"><button data-admin="settings">公告／開放設定</button><button data-admin="items">空間／設備</button><button data-admin="schedule">課表</button><button data-admin="bookings">申請與照片</button><button data-admin="admins">管理員帳號</button><button id="logoutBtn">登出</button></div><div id="adminContent"></div></div>';
  $$("[data-admin]").forEach(b=>b.onclick=()=>adminSection(b.dataset.admin));
  $("#logoutBtn").onclick=async()=>{await sdk.signOut(auth);adminUser=null;p.classList.add("hidden");toast("已登出管理員")};
  await adminSection("settings");
}
async function adminSection(which){
  const c=$("#adminContent");
  if(which==="admins"){
    c.innerHTML='<h3>新增管理員帳號</h3><p class="muted">不需要 Email 驗證信。請只新增可信任的人；新管理員可用自己的 Email 與密碼登入。</p>'+
      '<label class="field">新管理員 Email *<input id="newAdminEmail" type="email" autocomplete="off" required></label>'+
      '<label class="field">初始密碼（至少 6 個字元）*<input id="newAdminPassword" type="password" minlength="6" autocomplete="new-password" required></label>'+
      '<label class="field">再次輸入密碼 *<input id="newAdminPassword2" type="password" minlength="6" autocomplete="new-password" required></label>'+
      '<button id="createAdminBtn" class="primary">新增管理員</button><p id="createAdminMessage" class="feedback" role="status"></p>'+
      '<div class="notice">這個版本不使用 Cloud Functions、Secret Manager 或 Firebase Storage。簽退照片存於 Firestore 壓縮圖片；超過 7 天會在管理員開啟後台時清理。</div>'+
      '<h3>已授權管理員</h3><div id="adminList" class="cards">載入中…</div>';
    $("#createAdminBtn").onclick=createAdmin;
    loadAdminList();
  }
  if(which==="settings"){
    const s=config.settings||{},r=config.rules||{};
    c.innerHTML='<h3>開放狀態／公告</h3><label class="check"><input id="microOpen" type="checkbox" '+(s.microOpen===false?"":"checked")+'>開放正修微工坊</label><label class="check"><input id="outputOpen" type="checkbox" '+(s.outputOpen===false?"":"checked")+'>開放出圖室</label><label class="field">公告／提醒<textarea id="siteNotice">'+esc(s.notice||"")+'</textarea></label>'+
      ["booking","borrowing","micro","output"].map(k=>'<label class="field">'+labels[k]+'規範<textarea id="rule_'+k+'">'+esc(r[k]||defaultRules[k])+'</textarea></label>').join("")+
      '<button id="saveSettings" class="primary">儲存設定</button>';
    $("#saveSettings").onclick=async()=>{try{await sdk.setDoc(sdk.doc(db,"settings","public"),{settings:{microOpen:$("#microOpen").checked,outputOpen:$("#outputOpen").checked,notice:$("#siteNotice").value},rules:Object.fromEntries(["booking","borrowing","micro","output"].map(k=>[k,$("#rule_"+k).value]))},{merge:true});await loadConfig();render();toast("設定已儲存")}catch(e){toast("儲存失敗："+friendlyError(e))}};
  }
  if(which==="items"){
    c.innerHTML='<h3>新增空間／設備</h3><div class="grid"><label class="field">名稱<input id="newName"></label><label class="field">分類<select id="newCategory"><option value="booking">設計教室</option><option value="borrowing">雙向借用</option><option value="micro">正修微工坊</option><option value="output">出圖室</option><option value="all">全部分類</option></select></label></div><label class="field">說明／用途<input id="newDesc"></label><label class="check"><input id="newAvailable" type="checkbox" checked>目前可用</label><button id="addItem" class="primary">新增項目</button><h3>既有項目（可編輯）</h3><div class="table-wrap"><table><thead><tr><th>名稱／說明</th><th>分類</th><th>狀態</th><th>操作</th></tr></thead><tbody>'+
      config.items.map(i=>'<tr><td><input data-name="'+esc(i.id)+'" value="'+esc(i.name)+'"><input data-desc="'+esc(i.id)+'" value="'+esc(i.description||"")+'" placeholder="說明"></td><td><select data-cat="'+esc(i.id)+'">'+["booking","borrowing","micro","output","all"].map(k=>'<option value="'+k+'" '+(i.category===k?"selected":"")+'>'+k+'</option>').join("")+'</select></td><td><input data-avail="'+esc(i.id)+'" type="checkbox" '+(i.available===false?"":"checked")+'></td><td><button class="secondary" data-saveitem="'+esc(i.id)+'">儲存</button><button class="danger" data-delitem="'+esc(i.id)+'">刪除</button></td></tr>').join("")+
      '</tbody></table></div><p class="muted">原始匯出碼未包含動態空間清單，請依原站實際資料建立。</p>';
    $("#addItem").onclick=async()=>{const name=$("#newName").value.trim();if(!name)return toast("請輸入名稱");try{await sdk.addDoc(sdk.collection(db,"items"),{name,category:$("#newCategory").value,description:$("#newDesc").value,available:$("#newAvailable").checked,updatedAt:sdk.serverTimestamp()});await loadConfig();await adminSection("items");render();toast("項目已新增")}catch(e){toast("新增失敗："+friendlyError(e))}};
    $$("[data-saveitem]").forEach(b=>b.onclick=async()=>{const id=b.dataset.saveitem;try{await sdk.updateDoc(sdk.doc(db,"items",id),{name:$("[data-name='"+id+"']",c).value.trim(),description:$("[data-desc='"+id+"']",c).value,category:$("[data-cat='"+id+"']",c).value,available:$("[data-avail='"+id+"']",c).checked,updatedAt:sdk.serverTimestamp()});await loadConfig();await adminSection("items");render();toast("項目已更新")}catch(e){toast("更新失敗："+friendlyError(e))}});
    $$("[data-delitem]").forEach(b=>b.onclick=async()=>{if(!confirm("確定刪除此項目？"))return;try{await sdk.deleteDoc(sdk.doc(db,"items",b.dataset.delitem));await loadConfig();await adminSection("items");render();toast("項目已刪除")}catch(e){toast("刪除失敗："+friendlyError(e))}});
  }
  if(which==="schedule"){
    const snap=await sdk.getDocs(sdk.query(sdk.collection(db,"schedule"),sdk.orderBy("date","asc"))).catch(()=>null),rows=snap?snap.docs.map(d=>({id:d.id,...d.data()})):[];
    c.innerHTML='<h3>課表管理</h3><p class="muted">每行一筆：日期,開始時間,結束時間,課程名稱,空間項目 ID（可省略，省略表示全域占用）。</p><label class="field">課表 CSV<textarea id="csv" rows="6" placeholder="2026-10-22,09:00,12:00,建築設計課"></textarea></label><label class="check"><input type="checkbox" id="replaceSchedule">匯入前清除所有現有課表（慎用）</label><button id="importSchedule" class="primary">匯入課表</button><h3>已匯入 '+rows.length+' 筆課表</h3><div class="table-wrap"><table><thead><tr><th>日期</th><th>時段</th><th>課程</th><th>操作</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.date)+'</td><td>'+esc(r.start)+'–'+esc(r.end)+'</td><td>'+esc(r.title||"課表占用")+'</td><td><button class="danger" data-sdel="'+esc(r.id)+'">刪除</button></td></tr>').join("")+'</tbody></table></div>';
    $("#importSchedule").onclick=async()=>{const parsed=[];for(const line of $("#csv").value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)){const p=line.split(",").map(x=>x.trim());if(p.length<3||!/^\d{4}-\d{2}-\d{2}$/.test(p[0])||!/^([01]\d|2[0-3]):[0-5]\d$/.test(p[1])||!/^([01]\d|2[0-3]):[0-5]\d$/.test(p[2])||p[1]>=p[2])return toast("格式錯誤："+line);parsed.push({date:p[0],start:p[1],end:p[2],title:p[3]||"課表占用",itemId:p[4]||"",createdAt:sdk.serverTimestamp()})}try{if($("#replaceSchedule").checked){const old=await sdk.getDocs(sdk.collection(db,"schedule"));for(const d of old.docs)await sdk.deleteDoc(sdk.doc(db,"schedule",d.id))}for(const row of parsed)await sdk.addDoc(sdk.collection(db,"schedule"),row);await adminSection("schedule");toast("已匯入 "+parsed.length+" 筆")}catch(e){toast("匯入失敗："+friendlyError(e))}};
    $$("[data-sdel]").forEach(b=>b.onclick=async()=>{if(!confirm("確定刪除此課表？"))return;try{await sdk.deleteDoc(sdk.doc(db,"schedule",b.dataset.sdel));await adminSection("schedule")}catch(e){toast("刪除失敗："+friendlyError(e))}});
  }
  if(which==="bookings"){
    const snap=await sdk.getDocs(sdk.query(sdk.collection(db,"bookings"),sdk.orderBy("createdAt","desc"))),rows=snap.docs.map(d=>({id:d.id,...d.data()}));
    c.innerHTML='<h3>申請／照片管理</h3><div class="table-wrap"><table><thead><tr><th>申請人／手機</th><th>項目／時間</th><th>狀態</th><th>簽到／照片</th><th>審核</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.name)+'<br>'+esc(r.className)+'<br>'+esc(r.phone)+'</td><td>'+esc(r.item)+'<br>'+esc(r.date)+' '+esc(r.start)+'–'+esc(r.endTime)+'<br><small>'+esc(r.purpose||"")+'</small></td><td>'+esc(statusLabel(r.status))+'</td><td>'+(r.checkedInAt?"已簽到":"未簽到")+'／'+(r.checkedOutAt?"已簽退":"未簽退")+'<br>'+((r.photoIds||[]).map((p,i)=>'<button class="secondary" data-openphoto="'+esc(r.id)+'" data-photoid="'+esc(p)+'">照片'+(i+1)+'</button>').join(" ")||"無照片")+'</td><td><select data-status="'+esc(r.id)+'">'+["pending","approved","rejected","cancelled","finished"].map(k=>'<option value="'+k+'" '+(r.status===k?"selected":"")+'>'+statusLabel(k)+'</option>').join("")+'</select><button class="secondary" data-savebooking="'+esc(r.id)+'">儲存</button></td></tr>').join("")+'</tbody></table></div>';
    $$("[data-savebooking]").forEach(b=>b.onclick=async()=>{const id=b.dataset.savebooking,status=$("[data-status='"+id+"']",c).value;try{await sdk.updateDoc(sdk.doc(db,"bookings",id),{status,reviewedAt:sdk.serverTimestamp()});if(["rejected","cancelled","finished"].includes(status)){const locks=await sdk.getDocs(sdk.query(sdk.collection(db,"reservationLocks"),sdk.where("bookingId","==",id)));for(const l of locks.docs)await sdk.deleteDoc(sdk.doc(db,"reservationLocks",l.id))}toast("申請狀態已更新");await adminSection("bookings")}catch(e){toast("更新失敗："+friendlyError(e))}});
    $$("[data-openphoto]").forEach(b=>b.onclick=async()=>{const w=window.open("","_blank");if(!w)return toast("瀏覽器阻擋新視窗，請允許彈出視窗後重試");try{const d=await sdk.getDoc(sdk.doc(db,"bookings",b.dataset.openphoto,"photos",b.dataset.photoid));if(!d.exists())throw new Error("照片已清除");w.document.write('<!doctype html><meta charset="utf-8"><title>簽退照片</title><img style="max-width:100%;height:auto" src="'+d.data().dataUrl+'">')}catch(e){w.close();toast("無法開啟照片："+friendlyError(e))}});
  }
}
async function loadAdminList(){
  const list=$("#adminList");if(!list)return;
  try{
    const snap=await sdk.getDocs(sdk.collection(db,"adminUsers")),emails=new Set([INITIAL_ADMIN_EMAIL,...snap.docs.map(d=>d.id)]);
    list.innerHTML=[...emails].map(email=>'<article class="item"><b>'+esc(email)+'</b>'+(email===INITIAL_ADMIN_EMAIL?'<p class="muted">初始管理員（固定）</p>':'<p><button class="danger" data-revoke="'+esc(email)+'">移除管理員權限</button></p>')+'</article>').join("");
    $$("[data-revoke]").forEach(b=>b.onclick=async()=>{if(!confirm("確定移除 "+b.dataset.revoke+" 的管理員權限？"))return;try{await sdk.deleteDoc(sdk.doc(db,"adminUsers",b.dataset.revoke));await loadAdminList();toast("已移除管理員權限")}catch(e){toast("移除失敗："+friendlyError(e))}});
  }catch(e){list.textContent="無法讀取管理員清單："+friendlyError(e)}
}
async function createAdmin(){
  const email=$("#newAdminEmail").value.trim().toLowerCase(),password=$("#newAdminPassword").value,password2=$("#newAdminPassword2").value,button=$("#createAdminBtn");
  if(!email||!password){feedback("createAdminMessage","請填寫 Email 與密碼。",true);return}
  if(password.length<6){feedback("createAdminMessage","密碼至少需要 6 個字元。",true);return}
  if(password!==password2){feedback("createAdminMessage","兩次密碼不一致。",true);return}
  if(email===INITIAL_ADMIN_EMAIL){feedback("createAdminMessage","這是初始管理員 Email，不需要重複新增。",true);return}
  button.disabled=true;button.textContent="建立中…";
  let secondary=null,secondaryAuth=null,createdUser=null;
  try{
    const name="admin-creator-"+crypto.randomUUID();
    secondary=sdk.initializeApp(firebaseConfig,name);secondaryAuth=sdk.getAuth(secondary);
    const credential=await sdk.createUserWithEmailAndPassword(secondaryAuth,email,password);createdUser=credential.user;
    await sdk.setDoc(sdk.doc(db,"adminUsers",email),{email,uid:createdUser.uid,addedBy:adminUser.email,createdAt:sdk.serverTimestamp()});
    await sdk.signOut(secondaryAuth);
    $("#newAdminEmail").value="";$("#newAdminPassword").value="";$("#newAdminPassword2").value="";
    feedback("createAdminMessage","已建立管理員："+email+"。對方可直接使用 Email 與密碼登入，不需要驗證信。");
    await loadAdminList();toast("管理員已新增");
  }catch(e){
    if(createdUser&&secondaryAuth)await sdk.deleteUser(createdUser).catch(()=>{});
    feedback("createAdminMessage",e.code==="auth/email-already-in-use"?"這個 Email 已有 Firebase 帳號，請先確認並授予權限。":friendlyError(e),true);
  }finally{
    if(secondary)await sdk.deleteApp(secondary).catch(()=>{});
    button.disabled=false;button.textContent="新增管理員";
  }
}
function bindShell(){
  $("#adminOpen")?.addEventListener("click",()=>$("#adminModal").classList.remove("hidden"));
  $("#adminClose")?.addEventListener("click",()=>$("#adminModal").classList.add("hidden"));
  $("#loginBtn")?.addEventListener("click",loginAdmin);
  $$(".tab").forEach(b=>b.addEventListener("click",()=>{currentView=b.dataset.view;render()}));
  render();
  window.dispatchEvent(new Event("csu-app-ready"));
}
async function boot(){
  try{
    const [appSdk,authSdk,firestoreSdk,configModule]=await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"),
      import("./firebase-config.js")
    ]);
    sdk=Object.assign({},appSdk,authSdk,firestoreSdk);firebaseConfig=configModule.firebaseConfig;
    app=sdk.initializeApp(firebaseConfig);auth=sdk.getAuth(app);db=sdk.getFirestore(app);
    try{await loadConfig();render()}catch(e){console.error(e);const n=document.createElement("div");n.className="notice";n.textContent="表單已載入，但 Firestore 讀取失敗。請確認 Firestore 已建立並發布 firestore.rules。"+friendlyError(e);$("#view").prepend(n)}
  }catch(e){console.error(e);const n=document.createElement("div");n.className="notice";n.textContent="網站介面可用，但 Firebase SDK／設定載入失敗。"+friendlyError(e);$("#view").prepend(n)}
}
bindShell();
boot();
