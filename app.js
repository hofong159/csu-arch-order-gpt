// No-billing version: Firebase Authentication + Cloud Firestore only.
// Students do not sign in. A 128-bit random booking code acts as the bearer lookup key.
const $ = s => document.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const INITIAL_ADMIN_EMAIL = "hofong159@gmail.com";
const FIRESTORE_DATABASE_ID = "default"; // named database shown in Firebase Console
let sdk = {}, app = null, auth = null, db = null, firebaseConfig = null;
let config = {items:[], rules:{}, settings:{}}, currentView = "booking", adminUser = null;
const labels = {booking:"空間預約", borrowing:"設備借還登記（雙向借用）", micro:"借用正修微工坊", output:"借用出圖室", records:"我的申請／簽到簽退"};
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
  {key:"A_20261023_2330", area:"A", name:"楊○宇", borrowType:"小組借用", date:"2026-10-23", start:"23:30", endDate:"2026-10-24", endTime:"11:30"},
  {key:"H_20261022_1700", area:"H", name:"顏○晰", borrowType:"單人借用", date:"2026-10-22", start:"17:00", endDate:"2026-10-27", endTime:"17:00"}
];
const LEGACY_EXPORT_SNIPPET = String.raw`(function () {
  if (!window.google || !google.script || !google.script.run) {
    alert("請在舊網站執行這段程式，而且要選到包含 #date 的 Google Apps Script 網頁框架。");
    return;
  }
  function isoDate(d) {
    return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  }
  var start = prompt("要匯出的起始日期（YYYY-MM-DD，最多 31 天）", isoDate(new Date()));
  if (!start) return;
  var end = prompt("要匯出的結束日期（YYYY-MM-DD，最多 31 天）", start);
  if (!end) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    alert("日期格式必須是 YYYY-MM-DD。"); return;
  }
  var begin = new Date(start + "T12:00:00"), finish = new Date(end + "T12:00:00");
  var count = Math.round((finish - begin) / 86400000) + 1;
  if (!Number.isFinite(count) || count < 1 || count > 31) {
    alert("請選擇 1 至 31 天的日期範圍。"); return;
  }
  var days = [];
  for (var i = 0; i < count; i++) {
    var d = new Date(begin); d.setDate(d.getDate() + i); days.push(isoDate(d));
  }
  var spaces = new Map(), courses = new Map(), bookings = new Map(), index = 0;
  function keyOf(row, fallback) {
    return String(row && (row.id || row.key || row.code) || fallback);
  }
  function next() {
    if (index >= days.length) {
      var payload = {
        source: "Google Apps Script getBoard export",
        date: start,
        dateFrom: start,
        dateTo: end,
        spaces: Array.from(spaces.values()),
        courses: Array.from(courses.values()),
        bookings: Array.from(bookings.values())
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
      var url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = "csu-old-data-" + start + "-to-" + end + ".json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 1500);
      console.log("舊資料匯出完成", {
        days: days.length, spaces: payload.spaces.length,
        courses: payload.courses.length, bookings: payload.bookings.length
      });
      alert("匯出完成！空間 " + payload.spaces.length + " 筆、課表 " +
        payload.courses.length + " 筆、借用紀錄 " + payload.bookings.length +
        " 筆。把下載的 JSON 上傳到新網站「管理員後台 → 初始資料匯入」。");
      return;
    }
    var day = days[index++];
    google.script.run
      .withSuccessHandler(function (raw) {
        var data = raw && raw.data ? raw.data : (raw || {});
        (Array.isArray(data.spaces) ? data.spaces : []).forEach(function (row) {
          spaces.set(keyOf(row, row.name || row.label || JSON.stringify(row)), row);
        });
        (Array.isArray(data.courses) ? data.courses : []).forEach(function (row) {
          var item = Object.assign({}, row, {date: row.date || row.courseDate || day});
          var k = [item.date, item.areaCode || item.area || item.space || "",
            item.start || item.startTime || "", item.end || item.endTime || "",
            item.label || item.title || item.course || ""].join("|");
          courses.set(k, item);
        });
        (Array.isArray(data.bookings) ? data.bookings : (Array.isArray(data.reservations) ? data.reservations : [])).forEach(function (row) {
          var item = Object.assign({}, row, {date: row.date || row.bookingDate || day});
          var k = keyOf(item, [item.date || "", item.endDate || "", item.name || item.owner || "", item.area || item.space || "",
            item.start || item.startTime || "", item.end || item.endTime || "",
            item.borrowType || "", item.phone || ""].join("|"));
          bookings.set(k, item);
        });
        console.log("已匯出", day, "課表", (data.courses || []).length,
          "借用", (data.bookings || data.reservations || []).length);
        next();
      })
      .withFailureHandler(function (error) {
        alert("匯出 " + day + " 失敗：" + (error && error.message || error) +
          "。已停止，請檢查舊網站連線或 Apps Script 權限。");
      })
      .getBoard(day);
  }
  next();
})();`;
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
  const board=type==="booking"?'<section class="item public-week-board"><div class="week-board-heading"><div><h2>本週課表與預約狀況</h2><p class="muted">固定課表每週自動重複；橘色代表已有申請或預約。只顯示教室與時段，不公開個人資料。</p></div><button type="button" id="refreshWeekBoard" class="secondary">重新整理</button></div><div id="publicWeekBoard" aria-live="polite"><p class="muted">正在載入整週課表…</p></div></section>':"";
  return '<h2>'+esc(title)+'</h2><p class="muted">學生免登入，直接填表申請。送出後請保存查詢碼，之後使用手機號碼＋查詢碼查詢、簽到及簽退。</p>'+
    (available.length?"":'<div class="notice">目前尚未建立此分類的空間／設備，請管理員先新增項目。</div>')+
    board+
    '<form id="requestForm"><div class="grid">'+
    '<label class="field">姓名 *<input id="personName" required maxlength="60"></label>'+
    '<label class="field">班級／單位 *<input id="className" required maxlength="80" placeholder="例如：建築四甲"></label>'+
    '<label class="field">手機號碼 *<input id="phone" type="tel" required maxlength="30" placeholder="09xxxxxxxx"></label>'+
    '<label class="field">借用方式<select id="borrowType"><option value="單人借用">單人借用</option><option value="小組借用">小組借用</option></select></label>'+
    '<label class="field">空間／設備 *<select id="item" required>'+itemOptions(type)+'</select></label>'+
    '<label class="field">開始日期 *<input id="date" type="date" value="'+today()+'" min="'+today()+'" required></label>'+
    '<label class="field">開始時間 *<select id="start" required>'+timeOptions()+'</select></label>'+
    '<label class="field">借用時數（小時）*<input id="hours" type="number" inputmode="decimal" min="3" max="6" step="3" value="3" required placeholder="輸入 3 或 6"></label></div>'+
    '<p class="muted">借用時數請直接輸入 3 或 6 小時。</p>'+
    '<label class="field">用途／備註<textarea id="purpose" maxlength="1000" placeholder="簡述使用目的、材料或設備需求"></textarea></label>'+
    (workshop?'<h3>使用規範與注意事項</h3><div class="rule">'+esc(config.rules[type]||defaultRules[type])+'</div><label class="check"><input id="agreeRules" type="checkbox"><span>我已閱讀並同意遵守上述規範。</span></label>':"")+
    '<label class="check"><input id="agree" type="checkbox"><span>我會對本人／全組使用負責，離場前清潔復原並完成簽退；簽退時需上傳現況照片。</span></label>'+
    '<div class="notice">'+esc(config.settings.notice||"原站規則：起始時間每 30 分鐘一格；借用時間以 3 小時為倍數，建議不超過 6 小時。夜間 19:00 至翌日 08:00 須在 19:00 前登記；寒暑假開放情況依管理員公告。21:30 現場無人將鎖門。")+'</div>'+
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
  if($("#publicWeekBoard")){
    $("#refreshWeekBoard")?.addEventListener("click",loadPublicWeeklyBoard);
    if(db)loadPublicWeeklyBoard();else $("#publicWeekBoard").innerHTML='<p class="muted">Firebase 連線後會顯示課表。</p>';
  }
}
async function loadPublicWeeklyBoard(){
  const board=$("#publicWeekBoard");if(!board||!db)return;
  board.innerHTML='<p class="muted">正在讀取固定課表與預約時段…</p>';
  try{
    const courseResult=await sdk.getDocs(sdk.collection(db,"schedule"));
    let bookings=[],bookingReadError=null;
    try{
      const bookingSnap=await sdk.getDocs(sdk.collection(db,"publicBookings"));
      bookings=bookingSnap.docs.map(d=>({id:d.id,...d.data()})).filter(b=>["pending","approved"].includes(b.status));
    }catch(e){bookingReadError=e;console.warn("Public booking occupancy read failed",e)}
    const courses=courseResult.docs.map(normalizeCourseDocument).filter(Boolean);
    const monday=new Date(today()+"T12:00:00");monday.setDate(monday.getDate()-(monday.getDay()+6)%7);
    const week=Array.from({length:7},(_,i)=>{
      const date=new Date(monday);date.setDate(monday.getDate()+i);
      return {weekday:date.getDay(),date:localDate(date),label:["日","一","二","三","四","五","六"][date.getDay()]};
    });
    const rooms=config.items.filter(i=>i.category==="booking"||i.category==="all").sort((a,b)=>String(a.areaCode||a.name).localeCompare(String(b.areaCode||b.name),"zh-Hant"));
    if(!rooms.length){board.innerHTML='<div class="notice">尚未建立可預約教室。管理員請到「空間／設備」新增教室。</div>';return}
    board.innerHTML='<div class="week-range">顯示 '+esc(week[0].date)+' 至 '+esc(week[6].date)+' · 每週固定課表＋本週預約</div>'+
      (bookingReadError?'<p class="feedback error">固定課表可以顯示，但已預約時段尚無法讀取。請管理員將最新版 firestore.rules 發布到 Firebase。</p>':"")+
      '<div class="public-room-grid">'+rooms.map(room=>{
        const roomCourses=courses.filter(c=>c.itemId===room.id||(!c.itemId&&areaKey(c.areaCode)===areaKey(room.areaCode||room.name)));
        const roomBookings=bookings.filter(b=>b.itemId===room.id);
        return '<article class="public-room-card"><h3>'+esc(room.name)+'</h3><div class="public-room-days">'+week.map(day=>{
          const items=roomCourses.filter(c=>c.weekday===day.weekday).map(c=>({kind:"course",start:c.start,end:c.end,title:c.title||"正課"}));
          const dayStart=startOfLocalDay(day.date),dayEnd=dayStart+86400000;
          roomBookings.filter(b=>{
            const start=Number(b.startAt)||startOfLocalDay(b.date||day.date);
            const end=Number(b.endAt)||startOfLocalDay(b.endDate||b.date||day.date)+86400000;
            return start<dayEnd&&end>dayStart;
          }).forEach(b=>{
            const st=Number(b.startAt)?new Date(Number(b.startAt)):dateTime(b.date,b.start||"00:00");
            const en=Number(b.endAt)?new Date(Number(b.endAt)):dateTime(b.endDate||b.date,b.endTime||"23:59");
            items.push({kind:"booking",start:localDate(st)===day.date?fmt(st):"00:00",end:localDate(en)===day.date?fmt(en):"24:00"});
          });
          items.sort((a,b)=>a.start.localeCompare(b.start));
          return '<section class="public-day"><div class="public-day-title"><b>週'+day.label+'</b><span>'+day.date.slice(5)+'</span></div>'+
            (items.length?items.map(item=>'<div class="'+(item.kind==="booking"?"public-booked":"public-course")+'"><b>'+(item.kind==="booking"?"預約中":"正課")+'</b><span>'+esc(item.start)+'–'+esc(item.end)+'</span>'+(item.kind==="course"?'<span class="public-course-title">'+esc(item.title)+'</span>':'')+'</div>').join(""):'<div class="public-empty">無課／無預約</div>')+'</section>';
        }).join("")+'</div></article>';
      }).join("")+'</div>';
  }catch(e){
    board.innerHTML='<div class="feedback error">固定課表載入失敗：'+esc(friendlyError(e))+'。請確認 Firestore Rules 允許公開讀取 schedule。</div>';
  }
}

function intersect(a,b,c,d){return a<d&&b>c}
function stableHash(value){
  let h=2166136261;
  for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
  return (h>>>0).toString(16).padStart(8,"0");
}
function parseCsvText(text){
  const rows=[];let row=[],cell="",quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i],next=text[i+1];
    if(ch==='"'){if(quoted&&next==='"'){cell+='"';i++}else quoted=!quoted}
    else if(ch===","&&!quoted){row.push(cell.trim());cell=""}
    else if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&next==="\n")i++;row.push(cell.trim());cell="";if(row.some(v=>v!==""))rows.push(row);row=[]}
    else cell+=ch;
  }
  if(cell!==""||row.length){row.push(cell.trim());if(row.some(v=>v!==""))rows.push(row)}
  return rows;
}
function importDate(raw,fallback){
  if(raw==null||String(raw).trim()==="")return fallback||"";
  if(typeof raw==="number"){
    if(raw>100000000000){const d=new Date(raw);return Number.isNaN(d.getTime())?"":localDate(d)}
    if(raw>=20000&&raw<=90000){const d=new Date(Date.UTC(1899,11,30)+raw*86400000);return d.toISOString().slice(0,10)}
  }
  const v=String(raw).trim();
  const iso=v.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s].*)?$/);
  if(iso){
    const parts=iso[1].split("-").map(Number),d=new Date(Date.UTC(parts[0],parts[1]-1,parts[2]));
    if(d.getUTCFullYear()===parts[0]&&d.getUTCMonth()===parts[1]-1&&d.getUTCDate()===parts[2])return iso[1];
  }
  let m=v.match(/^(\d{2,4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?$/);
  if(!m)m=v.match(/^(\d{2,4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})$/);
  if(!m)return "";
  let y=Number(m[1]);if(y<1911)y+=1911;
  const mo=Number(m[2]),day=Number(m[3]),d=new Date(Date.UTC(y,mo-1,day));
  if(d.getUTCFullYear()!==y||d.getUTCMonth()!==mo-1||d.getUTCDate()!==day)return "";
  return y+"-"+String(mo).padStart(2,"0")+"-"+String(day).padStart(2,"0");
}
function importTime(raw){
  if(raw==null||String(raw).trim()==="")return "";
  if(typeof raw==="number"&&raw>=0&&raw<=1){
    const mins=Math.round(raw*1440)%1440;
    return String(Math.floor(mins/60)).padStart(2,"0")+":"+String(mins%60).padStart(2,"0");
  }
  let value=String(raw).trim();
  if(/^0?\.\d+$/.test(value)){
    const mins=Math.round(Number(value)*1440)%1440;
    return String(Math.floor(mins/60)).padStart(2,"0")+":"+String(mins%60).padStart(2,"0");
  }
  if(/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}[T\s]/.test(value)){
    const d=new Date(value);if(!Number.isNaN(d.getTime()))return fmt(d);
  }
  const marker=(value.match(/上午|下午|晚上|中午|AM|PM/i)||[])[0];
  value=value.replace(/上午|下午|晚上|中午|AM|PM/ig,"").trim();
  const m=value.match(/^(\d{1,2})[:.](\d{2})(?::(\d{2})(?:\.\d+)?)?$/);
  if(!m)return "";
  let h=Number(m[1]),min=Number(m[2]);if(h>23||min>59)return "";
  if(marker&&/下午|晚上|中午|PM/i.test(marker)&&h<12)h+=12;
  if(marker&&/上午|AM/i.test(marker)&&h===12)h=0;
  return String(h).padStart(2,"0")+":"+String(min).padStart(2,"0");
}
function areaKey(value){return String(value||"").trim().replace(/\s/g,"").replace(/^區/,"").replace(/區$/,"").toUpperCase()}
function findAreaItem(value){
  if(!value)return null;
  const raw=String(value).trim(),key=areaKey(raw);
  return config.items.find(i=>String(i.id)===raw||String(i.areaCode||"").toUpperCase()===key||String(i.name||"").replace(/\s/g,"")===raw.replace(/\s/g,"")||areaKey(i.name)===key)||null;
}
function legacyCandidates(parsed){
  const candidates=[],queue=[{value:parsed,depth:0}],seen=new Set();
  while(queue.length){
    const {value,depth}=queue.shift();
    if(!value||typeof value!=="object"||seen.has(value)||depth>5)continue;
    seen.add(value);candidates.push(value);
    for(const key of ["data","board","payload","result","response","value","snapshot","responseData"]){
      if(value[key]&&typeof value[key]==="object")queue.push({value:value[key],depth:depth+1});
    }
  }
  return candidates;
}
function legacyArray(parsed,keys){
  const candidates=legacyCandidates(parsed);
  for(const candidate of candidates){for(const key of keys){if(Array.isArray(candidate[key])&&candidate[key].length)return candidate[key]}}
  for(const candidate of candidates){for(const key of keys){if(Array.isArray(candidate[key]))return candidate[key]}}
  return [];
}
function legacyValue(parsed,keys){
  for(const candidate of legacyCandidates(parsed)){for(const key of keys){const value=candidate[key];if(value!==undefined&&value!==null&&String(value).trim()!=="")return value}}
  return undefined;
}
function unwrapLegacyPayload(parsed){
  const candidates=legacyCandidates(parsed);
  const keys=["spaces","areas","rooms","locations","courses","schedule","classes","lessons","bookings","reservations","appointments","records"];
  const hasContent=o=>o&&keys.some(k=>Array.isArray(o[k])&&o[k].length>0);
  return candidates.find(hasContent)||candidates.find(o=>keys.some(k=>Array.isArray(o[k])))||parsed;
}
function scheduleRowsFromText(text,defaultDate){
  const trimmed=String(text||"").replace(/^\uFEFF/,"").trim();
  if(!trimmed)throw new Error("請選擇課表檔案或貼上 CSV／JSON。");
  let input=[],jsonRoot=null,root=null;
  if(trimmed.startsWith("{")||trimmed.startsWith("[")){
    try{jsonRoot=JSON.parse(trimmed)}catch(e){throw new Error("JSON 格式錯誤："+e.message)}
    root=Array.isArray(jsonRoot)?jsonRoot:unwrapLegacyPayload(jsonRoot);
    if(Array.isArray(root))input=root;
    else{
      input=legacyArray(jsonRoot,["courses","schedule","classes","lessons","timetable"]);
      const rootDate=legacyValue(jsonRoot,["date","selectedDate","day","today","dateFrom","fromDate"])||defaultDate;
      defaultDate=importDate(rootDate,defaultDate)||defaultDate;
    }
    if(!Array.isArray(input)||!input.length)throw new Error("JSON 內找不到非空的 courses／schedule／classes／lessons 陣列。請確認匯入的是 getBoard() 回傳 JSON，不是舊網頁 HTML。");
  }else{
    const table=parseCsvText(trimmed);
    if(!table.length)throw new Error("CSV 沒有資料。");
    const normalize=h=>String(h).toLowerCase().replace(/[\s_\-（）()【】［］]/g,"");
    const headers=table[0].map(normalize);
    const idx=names=>headers.findIndex(h=>names.some(n=>h===normalize(n)));
    const idate=idx(["date","日期","上課日期","課程日期","預約日期","日期時間"]);
    const istart=idx(["start","starttime","timeStart","開始時間","起始時間","開始","上課開始"]);
    const iend=idx(["end","endtime","timeEnd","結束時間","下課時間","結束","上課結束"]);
    const iarea=idx(["areaCode","area","區域","教室","空間","場地","itemId","room","roomId","spaceId","區"]);
    const ititle=idx(["title","label","courseName","course","課程名稱","課程","課名","科目","教師"]);
    const hasHeader=istart>=0&&iend>=0;
    input=hasHeader
      ?table.slice(1).filter(row=>row.some(v=>String(v||"").trim()!=="")).map(row=>({
        date:idate>=0?row[idate]:"",start:row[istart]||"",end:row[iend]||"",
        area:iarea>=0?row[iarea]:"",title:ititle>=0?row[ititle]:""
      }))
      :table.map((row,index)=>{
        if(row.length>=4&&importTime(row[2])&&importTime(row[3]))return {date:row[0],area:row[1],start:row[2],end:row[3],title:row[4]||"課表占用"};
        if(row.length>=3&&importTime(row[1])&&importTime(row[2]))return {date:row[0],start:row[1],end:row[2],title:row[3]||"課表占用",area:row[4]||""};
        if(row.length>=2&&importTime(row[0])&&importTime(row[1]))return {date:defaultDate,start:row[0],end:row[1],title:row[2]||"課表占用",area:row[3]||""};
        throw new Error("第 "+(index+1)+" 列格式無法辨識。請使用「日期,區域,開始時間,結束時間,課程名稱」或有標題的 CSV。");
      });
  }
  return input.map((r,index)=>{
    if(Array.isArray(r))r={date:r[0],area:r[1],start:r[2],end:r[3],title:r[4]};
    const date=importDate(r.date??r.courseDate??r.classDate??r.class_date??r.scheduleDate??r.dateString??r["日期"],defaultDate);
    const start=importTime(r.start??r.startTime??r.start_time??r.begin??r.timeStart??r.from??r["開始時間"]);
    const end=importTime(r.end??r.endTime??r.end_time??r.finish??r.timeEnd??r.to??r["結束時間"]);
    const title=String(r.title??r.label??r.course??r.courseName??r.course_name??r.subject??r.teacher??r["課程名稱"]??r["課程"]??"課表占用").trim();
    const area=String(r.areaCode??r.area_code??r.area??r.space??r.spaceId??r.room??r.roomId??r.classroom??r.itemId??r["區域"]??r["教室"]??r["空間"]??"").trim();
    if(!date)throw new Error("第 "+(index+1)+" 筆「"+title+"」日期無法辨識（"+String(r.date??r.courseDate??defaultDate)+"）。可使用 YYYY-MM-DD、YYYY/MM/DD 或民國年 115/10/24。");
    if(!start||!end||start>=end)throw new Error("第 "+(index+1)+" 筆「"+title+"」時間格式錯誤（"+String(r.start??r.startTime)+"–"+String(r.end??r.endTime)+"）。");
    const item=area?findAreaItem(area):null;
    if(area&&!item)throw new Error("第 "+(index+1)+" 筆找不到區域「"+area+"」。請先匯入 spaces 空間清單，或確認區域名稱／代碼。");
    return {date,start,end,title,itemId:item?.id||"",areaCode:item?.areaCode||(item?areaKey(item.name):area),type:"course"};
  });
}
function weekDays(){
  return [{value:1,label:"星期一"},{value:2,label:"星期二"},{value:3,label:"星期三"},{value:4,label:"星期四"},{value:5,label:"星期五"},{value:6,label:"星期六"},{value:0,label:"星期日"}];
}
function getCourseWeekday(course){
  const raw=course.weekday??course.dayOfWeek??course.weekDay;
  if(raw!==undefined&&raw!==null&&raw!==""&&Number.isInteger(Number(raw))&&Number(raw)>=0&&Number(raw)<=6)return Number(raw);
  const date=String(course.date||"");
  const match=date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(match)return new Date(Number(match[1]),Number(match[2])-1,Number(match[3]),12).getDay();
  return null;
}
function normalizeCourseDocument(doc){
  const data=doc.data(),weekday=getCourseWeekday(data);
  if(weekday===null)return null;
  const item=config.items.find(i=>i.id===(data.itemId||""))||findAreaItem(data.areaCode||data.area||"");
  return {id:doc.id,...data,weekday,itemId:item?.id||data.itemId||"",areaCode:item?.areaCode||data.areaCode||areaKey(item?.name||""),title:data.title||data.course||data.label||"",start:data.start||data.startTime||"",end:data.end||data.endTime||""};
}
function startOfLocalDay(date){return new Date(date+"T00:00:00").getTime()}
async function checkCourseConflicts(start,end,itemId){
  const dates=[];for(let d=new Date(start);d<end;d=new Date(d.getTime()+86400000))dates.push(localDate(d));
  if(!dates.length)dates.push(localDate(start));
  const snap=await sdk.getDocs(sdk.collection(db,"schedule"));
  const courses=snap.docs.map(normalizeCourseDocument).filter(Boolean);
  for(const day of dates){
    const weekday=new Date(day+"T12:00:00").getDay();
    for(const course of courses){
      if(course.weekday!==weekday)continue;
      if(course.itemId&&course.itemId!==itemId)continue;
      const courseStart=dateTime(day,course.start),courseEnd=dateTime(day,course.end);
      if(intersect(start.getTime(),end.getTime(),courseStart.getTime(),courseEnd.getTime()))
        throw new Error("與固定課表衝突："+weekDays().find(d=>d.value===weekday)?.label+" "+course.start+"–"+course.end+"（"+(course.title||"正課")+"），請改選時間。");
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
    if(!Number.isFinite(hours)||hours<3||hours>6||hours%3!==0)throw new Error("借用時數請輸入 3 或 6 小時。");
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
    let photoRows=[];
    if(Array.isArray(data.photoIds)&&data.photoIds.length){
      const photoResults=await Promise.all(data.photoIds.slice(0,5).map(async id=>{
        try{const p=await sdk.getDoc(sdk.doc(db,"bookings",code,"photos",id));return p.exists()?{id,...p.data()}:null}catch(e){return null}
      }));
      photoRows=photoResults.filter(Boolean);
    }
    const legacyPhotoRows=(Array.isArray(data.photos)?data.photos:[]).map((entry,i)=>{
      const src=typeof entry==="string"?entry:(entry?.dataUrl||entry?.url||entry?.src||"");
      return src?{id:"legacy-"+i,name:entry?.name||("舊照片"+(i+1)),dataUrl:src,legacy:true}:null;
    }).filter(Boolean);
    photoRows=[...photoRows,...legacyPhotoRows].slice(0,5);
    $("#myRecords").innerHTML=recordCard(data,code,photoRows);feedback("lookupMessage","查詢成功。");
    if($("#checkinBtn"))$("#checkinBtn").onclick=async()=>{try{
      await sdk.updateDoc(sdk.doc(db,"bookings",code),{checkedInAt:sdk.serverTimestamp()});toast("簽到成功");await loadMine();
    }catch(e){feedback("lookupMessage",friendlyError(e),true)}};
    if($("#checkoutBtn"))$("#checkoutBtn").onclick=()=>checkout(code);
  }catch(e){$("#myRecords").innerHTML="";feedback("lookupMessage",friendlyError(e),true)}
}
function recordCard(d,code,photoRows=[]){
  const photoHtml=photoRows.length
    ?'<h4>已回傳照片</h4><div class="photo-grid">'+photoRows.map((p,i)=>'<a class="photo-thumb" href="'+esc(p.dataUrl)+'" target="_blank" rel="noopener"><img src="'+esc(p.dataUrl)+'" alt="簽退照片 '+(i+1)+'"><span>照片 '+(i+1)+'</span></a>').join("")+'</div>'
    :(Array.isArray(d.photoIds)&&d.photoIds.length?'<p class="muted">已儲存 '+d.photoIds.length+' 張照片，但目前無法讀取預覽；請確認 Firestore Rules 已更新。</p>':"");
  return '<article class="item"><h3>'+esc(d.item)+'</h3><p>申請人：'+esc(d.name)+'（'+esc(d.className)+'）</p><p>日期：'+esc(d.date)+'　時段：'+esc(d.start)+'–'+esc(d.endDate&&d.endDate!==d.date?d.endDate+" ":"") +esc(d.endTime)+'（'+esc(d.hours)+' 小時）</p><p>狀態：<b>'+esc(d.displayStatus||statusLabel(d.status))+'</b></p><p>簽到：'+(d.checkedInAt?"已完成":"尚未簽到")+'；簽退：'+(d.checkedOutAt?"已完成":"尚未簽退")+'</p>'+
    (d.status==="approved"&&!d.checkedInAt?'<button id="checkinBtn" class="primary">到場簽到</button>':"")+
    (d.checkedInAt&&!d.checkedOutAt?'<button id="checkoutBtn" class="primary">簽退並上傳照片</button>':"")+
    (d.status==="pending"?'<p class="muted">申請正在等待管理員核准。</p>':"")+
    (d.status==="rejected"||d.status==="cancelled"?'<p class="muted">此申請未核准或已取消。</p>':"")+photoHtml+'</article>';
}
async function compressImage(file){
  if(!file||!String(file.type||"").startsWith("image/"))throw new Error("請選擇照片檔案。");
  let bitmap;
  try{bitmap=await createImageBitmap(file)}
  catch(e){throw new Error("瀏覽器無法讀取這張照片。請先轉成 JPG／PNG，再重新上傳；部分 HEIC 照片需先轉檔。")}
  try{
    for(const maxSide of [1280,1000,800,640]){
      const scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement("canvas");
      canvas.width=Math.max(1,Math.round(bitmap.width*scale));
      canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);
      for(const quality of [0.72,0.62,0.52,0.42]){
        const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("照片壓縮失敗。")),"image/jpeg",quality));
        if(blob.size>620000)continue;
        const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("讀取照片失敗。"));reader.readAsDataURL(blob)});
        if(dataUrl.length<650000)return dataUrl;
      }
    }
    throw new Error("照片壓縮後仍超過免費版限制。請選擇較小張的照片再試。");
  }finally{bitmap.close?.()}
}
async function checkout(code){
  const picker=document.createElement("input");picker.type="file";picker.accept="image/jpeg,image/png,image/webp";picker.multiple=true;
  picker.onchange=async()=>{
    const files=[...(picker.files||[])];if(files.length<1||files.length>5){toast("請選擇 1 至 5 張照片");return}
    try{
      const bookingRef=sdk.doc(db,"bookings",code),bookingSnap=await sdk.getDoc(bookingRef);
      if(!bookingSnap.exists())throw new Error("查無此申請。");
      const booking=bookingSnap.data();
      if(booking.status!=="approved")throw new Error("此申請尚未核准，不能簽退。");
      if(!booking.checkedInAt)throw new Error("請先完成到場簽到。");
      if(booking.checkedOutAt)throw new Error("此申請已完成簽退。");
      if((booking.photoIds||[]).length+files.length>5)throw new Error("每筆申請最多只能回傳 5 張照片。");
      const compressed=[];
      for(const file of files)compressed.push({name:file.name.slice(0,100),dataUrl:await compressImage(file)});
      const existing=Array.isArray(booking.photoIds)?booking.photoIds:[];
      const photoRefs=compressed.map(()=>sdk.doc(sdk.collection(db,"bookings",code,"photos")));
      const batch=sdk.writeBatch(db);
      compressed.forEach((photo,i)=>batch.set(photoRefs[i],{
        dataUrl:photo.dataUrl,name:photo.name,contentType:"image/jpeg",createdAt:sdk.serverTimestamp()
      }));
      batch.update(bookingRef,{checkedOutAt:sdk.serverTimestamp(),photoIds:[...existing,...photoRefs.map(r=>r.id)]});
      await batch.commit();
      toast("簽退完成，"+compressed.length+" 張照片已儲存");
      await loadMine();
    }catch(e){feedback("lookupMessage",friendlyError(e),true)}
  };
  picker.click();
}
function withFirestoreTimeout(promise,label,timeoutMs=12000){
  let timer;
  const timeout=new Promise((_,reject)=>{
    timer=setTimeout(()=>{
      const error=new Error(label+"逾時：Firestore 在 "+Math.round(timeoutMs/1000)+" 秒內沒有回應。這通常是資料庫連線／網路傳輸沒有完成；Rules 權限問題通常會回傳 permission-denied，而不是逾時。請確認 Firebase 專案、Firestore Database 已建立、網路／防火牆允許連線，然後重試。此逾時不會自動刪除資料。");
      error.code="csu/firestore-timeout";
      reject(error);
    },timeoutMs);
  });
  return Promise.race([Promise.resolve(promise),timeout]).finally(()=>clearTimeout(timer));
}
function friendlyError(e){
  const message=e?.message||String(e||"操作失敗。");
  if(e?.code==="permission-denied")return "Firestore 權限不足：請到 Firebase Console → Firestore Database → Rules，發布 GitHub 專案內最新的 firestore.rules。GitHub Pages 部署不會自動發布 Firestore Rules。";
  if(e?.code==="unavailable")return "Firebase 目前無法連線，請檢查網路後重試。";
  return message;
}
async function cleanupExpiredPhotos(){
  if(!adminUser)return;
  try{
    const now=Date.now(),cutoffMs=now-7*24*60*60*1000;
    const snap=await sdk.getDocs(sdk.collection(db,"bookings"));
    let deletedCount=0,checkedCount=0;
    for(const bookingDoc of snap.docs){
      const data=bookingDoc.data(),checkedOut=data.checkedOutAt;
      const checkedOutMs=checkedOut?.toDate?checkedOut.toDate().getTime():(checkedOut?new Date(checkedOut).getTime():0);
      const deadline=data.photoDeleteAfter?.toDate?data.photoDeleteAfter.toDate().getTime():Number(data.photoDeleteAfter||0);
      const expireAll=(checkedOutMs>0&&checkedOutMs<=cutoffMs)||(deadline>0&&deadline<=now);
      const hasRefs=(Array.isArray(data.photoIds)&&data.photoIds.length>0)||(Array.isArray(data.photos)&&data.photos.length>0)||(Array.isArray(data.photoPaths)&&data.photoPaths.length>0);
      if(!expireAll&&!hasRefs)continue;
      const photoSnap=await sdk.getDocs(sdk.collection(db,"bookings",bookingDoc.id,"photos"));
      const expiredDocs=expireAll?photoSnap.docs:photoSnap.docs.filter(photoDoc=>{
        const created=photoDoc.data().createdAt;
        const ms=created?.toDate?created.toDate().getTime():(created?new Date(created).getTime():0);
        return ms>0&&ms<=cutoffMs;
      });
      const expiredIds=new Set(expiredDocs.map(photoDoc=>photoDoc.id));
      const remainingIds=expireAll?[]:(Array.isArray(data.photoIds)?data.photoIds.filter(id=>!expiredIds.has(id)):[]);
      const needParentUpdate=expireAll||expiredIds.size>0||(Array.isArray(data.photoIds)&&remainingIds.length!==data.photoIds.length);
      if(!expiredDocs.length&&!needParentUpdate)continue;
      const batch=sdk.writeBatch(db);
      expiredDocs.forEach(photoDoc=>batch.delete(photoDoc.ref));
      if(needParentUpdate){
        const patch={photoIds:remainingIds};
        if(expireAll){patch.photos=[];patch.photoPaths=[];if(data.photoDeleteAfter!==undefined)patch.photoDeleteAfter=null;}
        batch.update(bookingDoc.ref,patch);
      }
      await batch.commit();
      deletedCount+=expiredDocs.length+(expireAll?(Array.isArray(data.photos)?data.photos.length:0)+(Array.isArray(data.photoPaths)?data.photoPaths.length:0):0);
      checkedCount++;
    }
    if(deletedCount)toast("已清理 "+deletedCount+" 個超過 7 天的照片紀錄（"+checkedCount+" 筆申請）");
  }catch(e){console.warn("Expired photo cleanup did not run",e);toast("照片期限清理失敗："+friendlyError(e))}
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
  $("#adminEmail")?.closest("label")?.classList.add("hidden");
  $("#adminPassword")?.closest("label")?.classList.add("hidden");
  $("#loginBtn")?.classList.add("hidden");
  $("#loginError")?.classList.add("hidden");
  p.innerHTML='<div class="admin-tools">'+
    '<h2>管理員設定中心</h2>'+
    '<div class="admin-nav" role="group" aria-label="管理員功能">'+
      '<button type="button" data-admin="settings">公告／開放設定</button>'+
      '<button type="button" data-admin="items">空間／設備</button>'+
      '<button type="button" data-admin="schedule">課表</button>'+
      '<button type="button" data-admin="bookings">申請與照片</button>'+
      '<button type="button" data-admin="admins">管理員帳號</button>'+
      '<button type="button" id="logoutBtn">登出</button>'+
    '</div>'+
    '<div id="adminActionMessage" class="feedback hidden" role="status" aria-live="polite"></div>'+
    '<div id="adminContent" aria-live="polite"></div></div>';
  // Delegate clicks from the panel itself. This survives innerHTML refreshes and avoids
  // lost listeners when navigating between admin sections.
  p.onclick=async(event)=>{
    const quick=event.target.closest&&event.target.closest("#quickSeedBtn");
    const tab=event.target.closest&&event.target.closest("button[data-admin]");
    if(quick||tab){
      event.preventDefault();
      const which=tab.dataset.admin;
      $$("#adminPanel button[data-admin]").forEach(b=>b.classList.toggle("active",b===tab));
      const msg=$("#adminActionMessage");
      if(msg){msg.classList.remove("hidden","error");msg.textContent="正在載入「"+tab.textContent.trim()+"」…"}
      try{
        await adminSection(which);
        if(msg){msg.classList.add("hidden");msg.textContent=""}
      }catch(err){
        const content=$("#adminContent");
        const message=friendlyError(err);
        const hint=err?.code==="permission-denied"?"請到 Firebase Console → Firestore Database → Rules，確認已發布目前的 firestore.rules。":err?.code==="firestore-rest-timeout"?"SDK 與 REST 兩種讀取方式均無回應；這是連線／資料庫端問題，並非單純的畫面載入問題。":err?.code?.startsWith("firestore-rest-http-")?"REST API 已回應錯誤，請依上方 HTTP 狀態與回應內容修正專案設定或 Rules。":"系統已嘗試 Firestore SDK 與 REST 備援讀取；請查看上方完整錯誤內容。";
        if(content)content.innerHTML='<div class="feedback error">無法開啟功能：'+esc(message)+'<br>'+esc(hint)+'</div>';
        if(msg){msg.classList.remove("hidden");msg.classList.add("error");msg.textContent="載入失敗："+message}
      }
      return;
    }
  };
  $("#logoutBtn").onclick=async()=>{
    try{await sdk.signOut(auth)}finally{
      adminUser=null;p.classList.add("hidden");
      $("#adminEmail")?.closest("label")?.classList.remove("hidden");
      $("#adminPassword")?.closest("label")?.classList.remove("hidden");
      $("#loginBtn")?.classList.remove("hidden");
      $("#loginError")?.classList.remove("hidden");
      toast("已登出管理員");
    }
  };
  await adminSection("settings");
  $$("[data-admin]").forEach(b=>b.classList.toggle("active",b.dataset.admin==="settings"));
}
async function seedBaselineData(){
  const button=$("#seedBaselineBtn"), original=button?.textContent||"匯入預設空間、課表與原站借用紀錄";
  if(button){button.disabled=true;button.textContent="正在寫入 Firebase…"}
  feedback("seedMessage","正在讀取目前資料並準備匯入；已有相同資料會沿用，不會清空其他設定。");
  try{
    await loadConfig();
    const [scheduleSnap,bookingSnap,lockSnap,settingsSnap]=await Promise.all([
      sdk.getDocs(sdk.collection(db,"schedule")),
      sdk.getDocs(sdk.collection(db,"bookings")),
      sdk.getDocs(sdk.collection(db,"reservationLocks")),
      sdk.getDoc(sdk.doc(db,"settings","public"))
    ]);
    const existingCourses=scheduleSnap.docs.map(d=>({id:d.id,...d.data()}));
    const existingBookings=bookingSnap.docs.map(d=>({id:d.id,...d.data()}));
    const existingLocks=new Set(lockSnap.docs.map(d=>d.id));
    const existingItems=config.items;
    const itemIdByArea={};
    const batch=sdk.writeBatch(db);
    let itemWrites=0,courseWrites=0,bookingWrites=0,lockWrites=0;
    const serverTime=sdk.serverTimestamp();

    for(const area of BASELINE_SPACES){
      const oldItem=existingItems.find(i=>i.name===area.name);
      const itemId=oldItem?.id||("space_"+area.code);
      itemIdByArea[area.code]=itemId;
      const itemRef=sdk.doc(db,"items",itemId);
      batch.set(itemRef,{
        name:area.name,category:"booking",
        description:"正修建築圖科九樓設計教室區域。每區最多兩組，單組不得獨占。",
        available:oldItem?.available===false?false:true,
        capacityGroups:2,areaCode:area.code,sourceSeedKey:"original_space_"+area.code,
        updatedAt:serverTime
      },{merge:true});
      itemWrites++;
    }

    for(const course of BASELINE_COURSES){
      const itemId=itemIdByArea[course.area];
      const seedKey="course_20261024_"+course.area+"_"+course.start.replace(":","");
      const same=existingCourses.find(r=>r.sourceSeedKey===seedKey||(
        r.date==="2026-10-24"&&r.start===course.start&&r.end===course.end&&
        r.itemId===itemId&&r.title===course.title
      ));
      const ref=sdk.doc(db,"schedule",same?.id||seedKey);
      batch.set(ref,{
        date:"2026-10-24",start:course.start,end:course.end,
        title:course.title,itemId,areaCode:course.area,type:"course",
        sourceSeedKey:seedKey,source:"使用者提供之原站課表",updatedAt:serverTime
      },{merge:true});
      courseWrites++;
    }

    const formatTaipei=ms=>{
      const d=new Date(ms+8*60*60*1000);
      return {date:d.toISOString().slice(0,10),time:d.toISOString().slice(11,16)};
    };
    const buildSlots=(date,start,endDate,endTime,itemId)=>{
      let cursor=new Date(date+"T"+start+":00+08:00").getTime();
      const finish=new Date(endDate+"T"+endTime+":00+08:00").getTime();
      const result=[];
      while(cursor<finish){
        const local=formatTaipei(cursor);
        result.push({date:local.date,time:local.time,key:local.date+"_"+itemId+"_"+local.time.replace(":","")});
        cursor+=30*60*1000;
      }
      return result;
    };

    for(const row of BASELINE_LEGACY_BOOKINGS){
      const itemId=itemIdByArea[row.area];
      const already=existingBookings.find(b=>b.sourceSeedKey==="original_booking_"+row.key);
      if(already)continue;
      const slots=buildSlots(row.date,row.start,row.endDate,row.endTime,itemId);
      const lane=[0,1].find(l=>slots.every(s=>!existingLocks.has(s.key+"_"+l)));
      if(lane===undefined){
        console.warn("Cannot import active legacy reservation because both lanes conflict:",row.key);
        continue;
      }
      const code=randomCode();
      const lockIds=slots.map(s=>s.key+"_"+lane);
      const startAt=new Date(row.date+"T"+row.start+":00+08:00").getTime();
      const endAt=new Date(row.endDate+"T"+row.endTime+":00+08:00").getTime();
      const bookingRef=sdk.doc(db,"bookings",code);
      batch.set(bookingRef,{
        name:row.name,className:"原站匯入紀錄（班級未提供）",phone:"原站未提供電話",
        borrowType:row.borrowType,type:"booking",itemId,item:row.area+"區",
        areaCode:row.area,date:row.date,start:row.start,hours:Math.round((endAt-startAt)/3600000),
        endDate:row.endDate,endTime:row.endTime,startAt,endAt,
        purpose:"依使用者提供的原站畫面匯入；原畫面未提供電話及查詢碼。",
        status:"approved",displayStatus:"預約中",importedOriginal:true,
        sourceSeedKey:"original_booking_"+row.key,lockIds,photoIds:[],
        createdAt:serverTime,checkedInAt:null,checkedOutAt:null
      });
      bookingWrites++;
      slots.forEach((slot,i)=>{
        const lockId=lockIds[i];
        const lockRef=sdk.doc(db,"reservationLocks",lockId);
        batch.set(lockRef,{
          bookingId:code,lockId,itemId,date:slot.date,time:slot.time,
          lane,status:"active",createdAt:serverTime,sourceSeedKey:"original_booking_"+row.key
        });
        existingLocks.add(lockId);
        lockWrites++;
      });
    }

    const existingPublic=settingsSnap.exists()?settingsSnap.data():{};
    const oldSettings=existingPublic.settings||{};
    const oldRules=existingPublic.rules||{};
    const sourceNotice="原站規則：起始時間每 30 分鐘一格；借用時間以 3 小時為倍數，可跨日，建議不超過 6 小時。夜間 19:00 至翌日 08:00 須於 19:00 前登記；寒暑假不開放。每區最多兩組，單組不得獨占。21:30 現場無人將鎖門，晚間留用請依規定事先到場確認。簽退前請清潔復原並依現場規定回報照片。";
    batch.set(sdk.doc(db,"settings","public"),{
      settings:{
        microOpen:oldSettings.microOpen===false?false:true,
        outputOpen:oldSettings.outputOpen===false?false:true,
        notice:oldSettings.notice||sourceNotice
      },
      rules:{
        ...defaultRules,
        booking:oldRules.booking||"每區最多兩組，單組不得獨占。起始時間每 30 分鐘一格；借用時間以 3 小時為倍數，建議不超過 6 小時。夜間留用須依原站規定提前登記。使用後請清潔復原並完成簽退。",
        borrowing:oldRules.borrowing||defaultRules.borrowing,
        micro:oldRules.micro||defaultRules.micro,
        output:oldRules.output||defaultRules.output
      },
      baselineSeedVersion:"2026-10-24-v1",baselineSeededAt:serverTime
    },{merge:true});

    await batch.commit();
    await loadConfig();
    await adminSection("seed");
    render();
    feedback("seedMessage","匯入完成：區域 "+itemWrites+" 筆、課表 "+courseWrites+" 筆；新增原站有效借用 "+bookingWrites+" 筆、時段鎖 "+lockWrites+" 格。再次執行會沿用相同資料，不會刪除其他設定。");
    toast("空間與課表已寫入 Firebase");
  }catch(e){
    feedback("seedMessage","匯入失敗："+friendlyError(e)+"。若顯示 permission-denied，表示 Firestore Rules 尚未允許初始管理員寫入；請先發布 Repository 的 firestore.rules。",true);
  }finally{
    if(button){button.disabled=false;button.textContent=original}
  }
}

function parseLegacyDateTime(raw,fallbackDate){
  const value=String(raw??"").trim();
  if(!value)return null;
  if(typeof raw==="number"&&raw>100000000000){
    const d=new Date(raw);return Number.isNaN(d.getTime())?null:d;
  }
  if(/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}[T\s]/.test(value)){
    const direct=new Date(value);if(!Number.isNaN(direct.getTime()))return direct;
  }
  const dateMatch=value.match(/(\d{2,4}\s*[-/.年]\s*\d{1,2}\s*[-/.月]\s*\d{1,2}\s*日?)/);
  if(dateMatch){
    const date=importDate(dateMatch[1],fallbackDate);
    const rest=value.slice(dateMatch.index+dateMatch[1].length).replace(/^[T\s,]+/,"");
    const time=importTime(rest);
    if(date&&time)return dateTime(date,time);
  }
  const time=importTime(value);
  return time&&fallbackDate?dateTime(fallbackDate,time):null;
}
async function importLegacySnapshot(){
  const button=$("#importLegacyBtn"),original=button?.textContent||"匯入舊系統資料";
  if(button){button.disabled=true;button.textContent="正在解析與匯入…"}
  feedback("legacyImportMessage","正在檢查舊資料格式…");
  try{
    let raw=$("#legacyJson")?.value?.trim()||"";
    const file=$("#legacyJsonFile")?.files?.[0];
    if(!raw&&file)raw=await file.text();
    if(!raw)throw new Error("請選擇 JSON 檔案，或貼上舊系統資料。");
    if(/<\s*!doctype html|google\.script\.run|userCodeAppPanel/i.test(raw.slice(0,10000))&&!raw.trim().startsWith("{")&&!raw.trim().startsWith("[")){
      throw new Error("你選到的是舊網站「輸出程式碼 HTML」，裡面只有 getBoard() 呼叫方式，不含即時課表／借用資料。請從舊網站取得 getBoard() 回傳的 JSON（需含 spaces、courses、bookings），再匯入這裡。");
    }
    let parsed;
    try{parsed=JSON.parse(raw)}catch(e){throw new Error("JSON 格式錯誤。請匯入舊系統 getBoard() 的資料 JSON，不是整份 HTML 原始碼。"+e.message)}
    const root=Array.isArray(parsed)?parsed:unwrapLegacyPayload(parsed);
    const fallbackDate=$("#legacyImportDate")?.value||today();
    const defaultDate=importDate(legacyValue(parsed,["date","selectedDate","day","today","dateFrom","fromDate"])||root.date,fallbackDate)||fallbackDate;
    const spaces=Array.isArray(root)?[]:legacyArray(parsed,["spaces","areas","rooms","locations"]);
    const topRows=Array.isArray(root)?root:null;
    const topLooksLikeBookings=!!(topRows&&topRows.some(row=>row&&("borrowType" in row||("status" in row&&"name" in row))));
    const courses=topRows&&!topLooksLikeBookings?topRows:legacyArray(parsed,["courses","schedule","classes","lessons","timetable"]);
    const bookings=topRows&&topLooksLikeBookings?topRows:legacyArray(parsed,["bookings","reservations","appointments","records"]);
    if(!spaces.length&&!courses.length&&!bookings.length)throw new Error("JSON 內找不到 spaces、courses、bookings 或 reservations 陣列。");
    await loadConfig();
    const initialItems=config.items.slice(),oldToNew=new Map(),spaceOps=[];
    for(const space of spaces){
      const name=String(space.name||space.label||space.title||space.areaName||"").trim();
      if(!name)continue;
      const oldId=String(space.id??space.areaCode??space.code??name).trim();
      const code=String(space.areaCode??space.code??oldId).trim();
      const found=initialItems.find(i=>i.name===name||String(i.areaCode||"").toUpperCase()===areaKey(code)||String(i.id)===oldId);
      const safeOldId=oldId.replace(/[^A-Za-z0-9_-]/g,"_").slice(0,90)||stableHash(name);
      const itemId=found?.id||("legacy_space_"+safeOldId);
      oldToNew.set(oldId,itemId);oldToNew.set(code,itemId);oldToNew.set(name,itemId);oldToNew.set(areaKey(name),itemId);
      spaceOps.push({id:itemId,data:{
        name,category:space.category||"booking",areaCode:space.areaCode||space.code||areaKey(name)||oldId,
        description:space.description||"從舊系統資料匯入",available:found?.available===false?false:space.available!==false,
        legacySourceId:oldId,legacyImportKey:"space_"+stableHash(oldId+"|"+name),updatedAt:sdk.serverTimestamp()
      }});
    }
    for(let offset=0;offset<spaceOps.length;offset+=400){
      const batch=sdk.writeBatch(db);
      spaceOps.slice(offset,offset+400).forEach(op=>batch.set(sdk.doc(db,"items",op.id),op.data,{merge:true}));
      await batch.commit();
    }
    if(spaceOps.length)await loadConfig();
    const mapLegacyArea=rawArea=>{
      const key=String(rawArea??"").trim();
      return oldToNew.get(key)||findAreaItem(key)?.id||"";
    };
    let courseWrites=0,bookingWrites=0,lockWrites=0,skippedBookings=0,importedInlinePhotos=0,skippedLegacyPhotos=0;
    const scheduleSnap=await sdk.getDocs(sdk.collection(db,"schedule"));
    const currentCourses=scheduleSnap.docs.map(d=>({id:d.id,...d.data()}));
    const courseOps=[];
    for(const row of courses){
      const date=importDate(row.date||row.courseDate||row.classDate,defaultDate);
      const start=importTime(row.start||row.startTime||row.begin);
      const end=importTime(row.end||row.endTime||row.finish);
      const title=String(row.title||row.label||row.courseName||row.course||row.subject||"課表占用").trim();
      const areaRaw=row.areaCode??row.area_code??row.area??row.areaName??row.area_name??row.space??row.spaceName??row.space_id??row.room??row.roomId??row.itemId??"";
      const itemId=mapLegacyArea(areaRaw);
      if(!date||!start||!end||start>=end)throw new Error("課表「"+title+"」日期或時間格式不正確；日期："+String(row.date||defaultDate)+"，時間："+String(row.start||row.startTime)+"–"+String(row.end||row.endTime));
      if(areaRaw&&!itemId)throw new Error("課表「"+title+"」使用未知區域："+String(areaRaw)+"。請確認 spaces 裡有相同區域 ID／名稱。");
      const areaItem=config.items.find(i=>i.id===itemId);
      const key="legacy_course_"+stableHash([date,itemId,start,end,title].join("|"));
      const same=currentCourses.find(c=>c.id===key||(c.date===date&&c.start===start&&c.end===end&&(c.itemId||"")===(itemId||"")&&(c.title||c.label||"")===title));
      courseOps.push({id:same?.id||key,data:{
        date,start,end,title,itemId:itemId||"",areaCode:areaItem?.areaCode||(areaItem?areaKey(areaItem.name):String(areaRaw||"")),
        type:"course",source:"舊系統 JSON 匯入",sourceLegacyKey:key,updatedAt:sdk.serverTimestamp()
      }});
    }
    for(let offset=0;offset<courseOps.length;offset+=400){
      const batch=sdk.writeBatch(db);
      courseOps.slice(offset,offset+400).forEach(op=>batch.set(sdk.doc(db,"schedule",op.id),op.data,{merge:true}));
      await batch.commit();courseWrites+=courseOps.slice(offset,offset+400).length;
    }

    const bookingsSnap=await sdk.getDocs(sdk.collection(db,"bookings"));
    const currentBookings=bookingsSnap.docs.map(d=>({id:d.id,...d.data()}));
    const locksSnap=await sdk.getDocs(sdk.collection(db,"reservationLocks"));
    const usedLocks=new Set(locksSnap.docs.map(d=>d.id));
    for(let index=0;index<bookings.length;index++){
      const row=bookings[index]||{};
      const areaRaw=row.areaCode??row.area??row.space??row.room??row.itemId??"";
      const itemId=mapLegacyArea(areaRaw);
      const rawStart=row.start??row.startTime??row.start_time??row.timeStart??row.startAt??row.startDateTime??row.start_datetime??row.beginTime??row.from;
      const rawEnd=row.end??row.endTime??row.end_time??row.timeEnd??row.endAt??row.endDateTime??row.end_datetime??row.finishTime??row.to;
      const hintedDate=importDate(row.date||row.bookingDate||row.booking_date||row.reservationDate||row.dateString||row.startDate||row.start_date,defaultDate)||defaultDate;
      const startDateTime=parseLegacyDateTime(rawStart,hintedDate);
      let endDateTime=parseLegacyDateTime(rawEnd,importDate(row.endDate,localDate(startDateTime||new Date()))||localDate(startDateTime||new Date()));
      if(!startDateTime||!endDateTime)throw new Error("第 "+(index+1)+" 筆舊借用資料日期／時間無法辨識。請確認 start/end 欄位。");
      if(endDateTime.getTime()<=startDateTime.getTime()&&importTime(rawEnd)){
        endDateTime=new Date(endDateTime.getTime()+24*60*60*1000);
      }
      if(endDateTime.getTime()<=startDateTime.getTime())throw new Error("第 "+(index+1)+" 筆舊借用的結束時間早於開始時間。");
      const name=String(row.name||row.owner||row.student||"舊系統借用者").trim();
      const borrowType=String(row.borrowType||row.borrow_type||"單人借用");
      const originalStatus=String(row.status||"預約中").trim();
      const rowKey="legacy_booking_"+stableHash([row.id||row.key||"",localDate(startDateTime),itemId||areaRaw,fmt(startDateTime),localDate(endDateTime),fmt(endDateTime),name,borrowType,row.phone||row.className||""].join("|"));
      if(currentBookings.some(b=>b.sourceLegacyKey===rowKey||(b.importedOriginal&&b.name===name&&b.itemId===itemId&&b.date===localDate(startDateTime)&&b.start===fmt(startDateTime)&&b.endDate===localDate(endDateTime)&&b.endTime===fmt(endDateTime)))){continue}
      const lowStatus=originalStatus.toLowerCase();
      const cancelled=/取消|拒絕|未核准|cancel|reject/.test(lowStatus);
      const completed=/完成|已簽退|已結束|finished|complete|closed/.test(lowStatus);
      const isPast=endDateTime.getTime()<=Date.now();
      const status=cancelled?"cancelled":(completed||isPast)?"finished":"approved";
      const legacyCheckedOut=/已簽退|已完成|完成|finished|complete|closed/.test(lowStatus);
      const legacyCheckedIn=legacyCheckedOut||/已簽到|逾時未簽退|checked.?in/.test(lowStatus);
      let slots=[];
      if(status==="approved"&&itemId){
        const half=30*60*1000;
        let cursor=Math.floor(startDateTime.getTime()/half)*half;
        if(cursor<Date.now())cursor=Math.floor(Date.now()/half)*half;
        const finish=Math.ceil(endDateTime.getTime()/half)*half;
        for(;cursor<finish;cursor+=half){
          const d=new Date(cursor),date=localDate(d),time=fmt(d);
          slots.push({date,time,key:date+"_"+itemId+"_"+time.replace(":","")});
        }
      }
      const lane=slots.length?[0,1].find(l=>slots.every(slot=>!usedLocks.has(slot.key+"_"+l))):undefined;
      const conflicted=slots.length>0&&lane===undefined;
      if(conflicted)skippedBookings++;
      const code=randomCode();
      const lockIds=lane===undefined?[]:slots.map(slot=>slot.key+"_"+lane);
      const durationHours=(endDateTime.getTime()-startDateTime.getTime())/3600000;
      const endAreaName=config.items.find(i=>i.id===itemId)?.name||String(areaRaw||"舊系統區域");
      const photoSources=[];
      for(const candidate of [row.photos,row.photoUrls,row.photoURLs,row.photo_urls,row.images,row.checkoutPhotos,row.checkOutPhotos,row.returnPhotos,row.returnPhotoUrls,row.attachments]){
        if(Array.isArray(candidate))photoSources.push(...candidate);
        else if(typeof candidate==="string"&&candidate)photoSources.push(candidate);
      }
      for(const candidate of [row.photo,row.photoUrl,row.photoURL,row.photo_url,row.checkoutPhoto,row.returnPhoto]){
        if(candidate)photoSources.push(candidate);
      }
      const photos=[],inlinePhotoRecords=[];
      for(const [photoIndex,entry] of photoSources.slice(0,5).entries()){
        let source=typeof entry==="string"?entry:(entry?.dataUrl||entry?.dataURL||entry?.url||entry?.src||entry?.base64||"");
        if(!source){skippedLegacyPhotos++;continue}
        if(/^https?:\/\//i.test(source)){photos.push(source);continue}
        if(/^data:image\//i.test(source)||/^[A-Za-z0-9+/]+=*$/.test(source)){
          try{
            let dataUrl=source.startsWith("data:image/")?source:"data:image/jpeg;base64,"+source;
            if(!dataUrl.startsWith("data:image/jpeg;base64,")||dataUrl.length>=650000){
              const response=await fetch(dataUrl);
              const blob=await response.blob();
              const file=new File([blob],String(entry?.name||("legacy-photo-"+(photoIndex+1)+".jpg")),{type:blob.type||"image/jpeg"});
              dataUrl=await compressImage(file);
            }
            if(dataUrl.startsWith("data:image/jpeg;base64,")&&dataUrl.length<650000){
              inlinePhotoRecords.push({name:String(entry?.name||("舊照片"+(photoIndex+1)+".jpg")).slice(0,100),dataUrl});
            }else skippedLegacyPhotos++;
          }catch(e){skippedLegacyPhotos++}
        }else skippedLegacyPhotos++;
      }
      const photoRefs=inlinePhotoRecords.map(()=>sdk.doc(sdk.collection(db,"bookings",code,"photos")));
      const legacyRecord={
        name,className:String(row.className||row.class||"舊系統匯入（班級未提供）"),
        phone:String(row.phone||"原站未提供電話"),borrowType,type:"booking",itemId:itemId||"",
        item:endAreaName,date:localDate(startDateTime),start:fmt(startDateTime),
        hours:Math.max(1,Math.min(1000,Math.round(durationHours))),
        endDate:localDate(endDateTime),endTime:fmt(endDateTime),
        startAt:startDateTime.getTime(),endAt:endDateTime.getTime(),
        purpose:String(row.purpose||"從舊系統資料匯入；原系統可能未提供電話／查詢碼。"),
        status,displayStatus:originalStatus,legacyImportConflict:conflicted,
        importedOriginal:true,sourceLegacyKey:rowKey,lockIds,
        photoIds:photoRefs.map(ref=>ref.id),photos,photoPaths:[],
        createdAt:sdk.serverTimestamp(),checkedInAt:legacyCheckedIn?sdk.serverTimestamp():null,checkedOutAt:legacyCheckedOut?sdk.serverTimestamp():null
      };
      // Each active booking plus its time locks is committed as a single batch.
      // If a conflicting slot exists, preserve the booking but mark it for admin review.
      const batch=sdk.writeBatch(db);
      const bookingRef=sdk.doc(db,"bookings",code);
      batch.set(bookingRef,legacyRecord);
      inlinePhotoRecords.forEach((photo,i)=>batch.set(photoRefs[i],{
        dataUrl:photo.dataUrl,name:photo.name,contentType:"image/jpeg",createdAt:sdk.serverTimestamp(),importedLegacyPhoto:true
      }));
      if(lane!==undefined){
        slots.forEach(slot=>{
          const lockId=slot.key+"_"+lane;
          batch.set(sdk.doc(db,"reservationLocks",lockId),{
            bookingId:code,lockId,itemId,date:slot.date,time:slot.time,lane,status:"active",
            createdAt:sdk.serverTimestamp(),sourceLegacyKey:rowKey
          });
          usedLocks.add(lockId);lockWrites++;
        });
      }
      await batch.commit();
      currentBookings.push({id:code,...legacyRecord});
      bookingWrites++;importedInlinePhotos+=inlinePhotoRecords.length;
    }
    await loadConfig();
    await adminSection("seed");
    feedback("legacyImportMessage","舊資料匯入完成：空間 "+spaceOps.length+" 筆、課表 "+courseWrites+" 筆、借用紀錄 "+bookingWrites+" 筆、時段鎖 "+lockWrites+" 格、內嵌照片 "+importedInlinePhotos+" 張。"+(skippedLegacyPhotos?"有 "+skippedLegacyPhotos+" 個照片項目無法匯入（格式不支援、網址不可存取或超過限制）。":"")+(skippedBookings?"有 "+skippedBookings+" 筆仍在使用但時段已衝突，已標記供管理員確認。":"")+"重複匯入會略過已匯入紀錄。");
    toast("舊系統資料匯入完成");
  }catch(e){
    const message=friendlyError(e);
    if(message==="請選擇 JSON 檔案，或貼上舊系統資料。"){
      feedback("legacyImportMessage","尚未開始匯入：請先選擇舊網站匯出的 JSON 檔，或貼上 JSON 內容。本次沒有寫入資料。",true);
    }else{
      feedback("legacyImportMessage","舊資料匯入失敗："+message+"。匯入途中可能已有部分資料成功寫入；修正來源後可安全重試，已匯入資料會略過重複項目。",true);
    }
  }finally{if(button){button.disabled=false;button.textContent=original}}
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
  if(which==="seed"){
    c.innerHTML='<h3>匯入原站舊資料</h3>'+
      '<p>若有從舊網站取得的 getBoard() 資料 JSON，請使用下方匯入器。它會匯入 spaces、courses、bookings（含原有 photos 陣列），並把舊區域 ID 對應到目前 Firebase 的空間 ID。</p>'+
      '<label class="field">舊資料日期（JSON 沒有日期時使用）<input id="legacyImportDate" type="date" value="'+today()+'"></label>'+
      '<label class="field">選擇舊資料 JSON 檔<input id="legacyJsonFile" type="file" accept=".json,application/json"></label>'+
      '<label class="field">JSON 內容（可直接貼上）<textarea id="legacyJson" rows="8" placeholder=\'{"spaces":[{"id":"A","name":"A區"}],"courses":[{"area":"A","start":"13:00","end":"13:45","label":"基本設計"}],"bookings":[]}\'></textarea></label>'+
      '<button id="importLegacyBtn" class="primary">匯入舊網站資料 JSON</button>'+
      '<p id="legacyImportMessage" class="feedback" role="status" aria-live="polite"></p>'+
      '<h3>先從舊網站匯出實際資料</h3><p>開啟舊網站，在 Chrome 按 F12 → Console，將下面指令貼到舊網站的 Google Apps Script 網頁框架執行。它會逐日讀取 getBoard()，最多 31 天，並下載包含 spaces、courses、bookings 的 JSON。</p>'+
      '<label class="field">舊網站匯出指令（複製後到舊網站 Console 執行）<textarea id="legacyExportCode" rows="9" readonly>'+esc(LEGACY_EXPORT_SNIPPET)+'</textarea></label>'+
      '<button id="copyLegacyExportBtn" class="secondary">複製舊網站匯出指令</button><p id="legacyExportCopyMessage" class="feedback" role="status"></p>'+
      '<div class="notice"><b>重要：</b>你先前提供的「輸出代碼 HTML」只有呼叫 getBoard() 的前端程式，不含後端即時資料。先用上方指令從原站下載 JSON，再在這裡選擇下載的 JSON 檔匯入。</div>'+
      '<hr><h3>一鍵預載已確認的原站資料</h3>'+
      '<p>只匯入你已提供並能確認的資料，不會清空既有紀錄：10 個區域、17 筆 2026/10/24 正課，以及兩筆舊借用紀錄。</p>'+
      '<button id="seedBaselineBtn" class="secondary">匯入已確認的空間／課表／借用紀錄</button>'+
      '<p id="seedMessage" class="feedback" role="status" aria-live="polite"></p>';
    $("#legacyJsonFile").onchange=async()=>{
      const file=$("#legacyJsonFile").files?.[0];if(!file)return;
      try{$("#legacyJson").value=await file.text();feedback("legacyImportMessage","已讀取 "+file.name+"，請確認後按「匯入舊網站資料 JSON」。")}
      catch(e){feedback("legacyImportMessage","讀取檔案失敗："+friendlyError(e),true)}
    };
    $("#importLegacyBtn").onclick=importLegacySnapshot;
    $("#seedBaselineBtn").onclick=seedBaselineData;
    $("#copyLegacyExportBtn").onclick=async()=>{
      try{await navigator.clipboard.writeText(LEGACY_EXPORT_SNIPPET);feedback("legacyExportCopyMessage","已複製。切回舊網站，在 F12 → Console 貼上執行即可。")}
      catch(e){$("#legacyExportCode").focus();$("#legacyExportCode").select();feedback("legacyExportCopyMessage","瀏覽器未允許自動複製，已選取指令，請按 Ctrl+C。")}
    };
  }
  if(which==="settings"){
    const s=config.settings||{},r=config.rules||{};
    c.innerHTML='<h3>開放狀態／公告</h3><p class="muted">修改後按「儲存設定」。若 Firestore 規則不允許寫入，錯誤會直接顯示在此處。</p>'+
      '<label class="check"><input id="microOpen" type="checkbox" '+(s.microOpen===false?"":"checked")+'>開放正修微工坊</label>'+
      '<label class="check"><input id="outputOpen" type="checkbox" '+(s.outputOpen===false?"":"checked")+'>開放出圖室</label>'+
      '<label class="field">公告／提醒<textarea id="siteNotice">'+esc(s.notice||"")+'</textarea></label>'+
      ["booking","micro","output"].map(k=>'<label class="field">'+labels[k]+'規範<textarea id="rule_'+k+'">'+esc(r[k]||defaultRules[k])+'</textarea></label>').join("")+
      '<button id="saveSettings" class="primary">儲存設定</button>'+
      '<p id="settingsMessage" class="feedback" role="status" aria-live="polite"></p>';
    $("#saveSettings").onclick=async()=>{
      const button=$("#saveSettings");button.disabled=true;
      try{
        await sdk.setDoc(sdk.doc(db,"settings","public"),{
          settings:{microOpen:$("#microOpen").checked,outputOpen:$("#outputOpen").checked,notice:$("#siteNotice").value},
          rules:Object.fromEntries(["booking","micro","output"].map(k=>[k,$("#rule_"+k).value]))
        },{merge:true});
        await loadConfig();
        feedback("settingsMessage","設定已成功儲存至 Firebase。");
        toast("設定已儲存");
      }catch(e){
        feedback("settingsMessage","儲存失敗："+friendlyError(e)+"。如果是 permission-denied，請確認已發布最新版 firestore.rules。",true);
      }finally{button.disabled=false}
    };
  }
  if(which==="items"){
    c.innerHTML='<h3>新增空間／設備</h3><div class="grid"><label class="field">名稱<input id="newName"></label><label class="field">分類<select id="newCategory"><option value="booking">設計教室</option><option value="micro">正修微工坊</option><option value="output">出圖室</option><option value="all">全部分類</option></select></label></div><label class="field">說明／用途<input id="newDesc"></label><label class="check"><input id="newAvailable" type="checkbox" checked>目前可用</label><button id="addItem" class="primary">新增項目</button><h3>既有項目（可編輯）</h3><div class="table-wrap"><table><thead><tr><th>名稱／說明</th><th>分類</th><th>狀態</th><th>操作</th></tr></thead><tbody>'+
      config.items.map(i=>'<tr><td><input data-name="'+esc(i.id)+'" value="'+esc(i.name)+'"><input data-desc="'+esc(i.id)+'" value="'+esc(i.description||"")+'" placeholder="說明"></td><td><select data-cat="'+esc(i.id)+'">'+["booking","borrowing","micro","output","all"].map(k=>'<option value="'+k+'" '+(i.category===k?"selected":"")+'">'+({booking:"設計教室",borrowing:"舊雙向借用（停用）",micro:"正修微工坊",output:"出圖室",all:"全部分類"}[k])+'</option>').join("")+'</select></td><td><input data-avail="'+esc(i.id)+'" type="checkbox" '+(i.available===false?"":"checked")+'></td><td><button class="secondary" data-saveitem="'+esc(i.id)+'">儲存</button><button class="danger" data-delitem="'+esc(i.id)+'">刪除</button></td></tr>').join("")+
      '</tbody></table></div>'+(config.items.length?'<p class="muted">請依實際空間與設備維護上方清單。</p>':'<div class="notice"><b>目前尚無空間／設備。</b><p>請使用上方「新增空間／設備」表單逐項建立。</p></div>') ;
    $("#addItem").onclick=async()=>{const name=$("#newName").value.trim();if(!name)return toast("請輸入名稱");try{await sdk.addDoc(sdk.collection(db,"items"),{name,category:$("#newCategory").value,description:$("#newDesc").value,available:$("#newAvailable").checked,updatedAt:sdk.serverTimestamp()});await loadConfig();await adminSection("items");render();toast("項目已新增")}catch(e){toast("新增失敗："+friendlyError(e))}};
    $$("[data-saveitem]").forEach(b=>b.onclick=async()=>{const id=b.dataset.saveitem;try{await sdk.updateDoc(sdk.doc(db,"items",id),{name:$("[data-name='"+id+"']",c).value.trim(),description:$("[data-desc='"+id+"']",c).value,category:$("[data-cat='"+id+"']",c).value,available:$("[data-avail='"+id+"']",c).checked,updatedAt:sdk.serverTimestamp()});await loadConfig();await adminSection("items");render();toast("項目已更新")}catch(e){toast("更新失敗："+friendlyError(e))}});
    $$("[data-delitem]").forEach(b=>b.onclick=async()=>{if(!confirm("確定刪除此項目？"))return;try{await sdk.deleteDoc(sdk.doc(db,"items",b.dataset.delitem));await loadConfig();await adminSection("items");render();toast("項目已刪除")}catch(e){toast("刪除失敗："+friendlyError(e))}});
  }
  if(which==="schedule"){
    const allSnap=await withFirestoreTimeout(sdk.getDocs(sdk.collection(db,"schedule")),"固定課表讀取",12000);
    const rows=allSnap.docs.map(normalizeCourseDocument).filter(Boolean).sort((a,b)=>{
      const rank=w=>w===0?7:w;
      return rank(a.weekday)-rank(b.weekday)||String(a.start).localeCompare(String(b.start))||String(a.areaCode).localeCompare(String(b.areaCode));
    });
    const weekdays=weekDays();
    const roomOptions='<option value="">請選擇區域</option>'+config.items.filter(i=>i.category==="booking"||i.category==="all").map(i=>'<option value="'+esc(i.id)+'">'+esc(i.name)+'</option>').join("");
    c.innerHTML='<h3>每週固定課表</h3><p class="muted">每學期設定一次即可，不需要輸入日期，也不用每週重複新增。可以拖曳課程卡片到其他星期，或複製一格後修改。</p>'+
      '<div class="weekly-editor">'+
      '<input type="hidden" id="weeklyEditId" value="">'+
      '<label class="field">星期<select id="weeklyDay">'+weekdays.map(d=>'<option value="'+d.value+'">'+d.label+'</option>').join("")+'</select></label>'+
      '<label class="field">區域<select id="weeklyRoom">'+roomOptions+'</select></label>'+
      '<div class="grid"><label class="field">開始時間<input id="weeklyStart" type="time" value="13:00" required></label><label class="field">結束時間<input id="weeklyEnd" type="time" value="13:45" required></label></div>'+
      '<label class="field">課程<textarea id="weeklyTitle" rows="2" maxlength="180" placeholder="例如：建築與室內設計（一）／教師姓名"></textarea></label>'+
      '<div class="button-row"><button type="button" id="weeklySave" class="primary">新增課程格</button><button type="button" id="weeklyReset" class="secondary">清空</button><span id="weeklyMessage" class="feedback" role="status"></span></div></div>'+
      '<h3>整週課表（'+rows.length+' 格）</h3><div class="weekly-admin-grid">'+weekdays.map(day=>{
        const dayRows=rows.filter(r=>r.weekday===day.value);
        return '<section class="week-day-column" data-drop-weekday="'+day.value+'"><h4>'+day.label+' <span>'+dayRows.length+' 格</span></h4>'+
          (dayRows.length?dayRows.map(row=>'<article class="weekly-course-card" draggable="true" data-weekly-card="'+esc(row.id)+'"><div class="drag-handle" title="拖曳到其他星期">⠿</div><div class="weekly-course-fields"><b>'+esc(config.items.find(i=>i.id===row.itemId)?.name||row.areaCode||"未指定區域")+'</b><span>'+esc(row.start)+'–'+esc(row.end)+'</span><span>'+esc(row.title||"（未填課程）")+'</span></div><div class="weekly-course-actions"><button type="button" class="secondary" data-weekly-edit="'+esc(row.id)+'">編輯</button><button type="button" class="secondary" data-weekly-copy="'+esc(row.id)+'">複製</button><button type="button" class="danger" data-weekly-delete="'+esc(row.id)+'">刪除</button></div></article>').join(""):'<p class="week-day-empty">拖曳課程到這裡，或從上方新增。</p>')+'</section>';
      }).join("")+'</div>';
    const resetWeekly=()=>{
      $("#weeklyEditId").value="";$("#weeklyDay").value="1";$("#weeklyRoom").value=config.items.find(i=>i.category==="booking"||i.category==="all")?.id||"";
      $("#weeklyStart").value="13:00";$("#weeklyEnd").value="13:45";$("#weeklyTitle").value="";
      $("#weeklySave").textContent="新增課程格";feedback("weeklyMessage","");
    };
    $("#weeklyReset").onclick=resetWeekly;
    $("#weeklySave").onclick=async()=>{
      const id=$("#weeklyEditId").value,weekday=Number($("#weeklyDay").value),itemId=$("#weeklyRoom").value,start=$("#weeklyStart").value,end=$("#weeklyEnd").value,title=$("#weeklyTitle").value.trim();
      if(!itemId||!config.items.some(i=>i.id===itemId))return feedback("weeklyMessage","請先選擇區域。",true);
      if(!start||!end||start>=end)return feedback("weeklyMessage","請確認開始與結束時間，結束時間必須晚於開始時間。",true);
      if(!title)return feedback("weeklyMessage","請填寫課程名稱。",true);
      const room=config.items.find(i=>i.id===itemId);
      const data={weekday,dayName:weekdays.find(d=>d.value===weekday)?.label||"",itemId,areaCode:room?.areaCode||areaKey(room?.name||""),start,end,title,type:"weeklyCourse",date:null,updatedAt:sdk.serverTimestamp()};
      try{
        $("#weeklySave").disabled=true;$("#weeklySave").textContent="儲存中…";
        if(id)await sdk.setDoc(sdk.doc(db,"schedule",id),data,{merge:true});
        else await sdk.addDoc(sdk.collection(db,"schedule"),{...data,createdAt:sdk.serverTimestamp()});
        await adminSection("schedule");toast(id?"課表已更新":"課程格已新增");
      }catch(e){feedback("weeklyMessage","儲存失敗："+friendlyError(e),true);$("#weeklySave").disabled=false;$("#weeklySave").textContent=id?"儲存修改":"新增課程格"}
    };
    $$( "[data-weekly-edit]" ).forEach(button=>button.onclick=()=>{
      const row=rows.find(r=>r.id===button.dataset.weeklyEdit);if(!row)return;
      $("#weeklyEditId").value=row.id;$("#weeklyDay").value=String(row.weekday);$("#weeklyRoom").value=row.itemId;
      $("#weeklyStart").value=row.start;$("#weeklyEnd").value=row.end;$("#weeklyTitle").value=row.title;
      $("#weeklySave").textContent="儲存修改";feedback("weeklyMessage","正在編輯課程格；儲存後會套用到每週。");
      $("#weeklyTitle").focus();c.scrollIntoView({behavior:"smooth",block:"start"});
    });
    $$( "[data-weekly-copy]" ).forEach(button=>button.onclick=()=>{
      const row=rows.find(r=>r.id===button.dataset.weeklyCopy);if(!row)return;
      $("#weeklyEditId").value="";$("#weeklyDay").value=String(row.weekday);$("#weeklyRoom").value=row.itemId;
      $("#weeklyStart").value=row.start;$("#weeklyEnd").value=row.end;$("#weeklyTitle").value=row.title+"（複製）";
      $("#weeklySave").textContent="儲存複製格";feedback("weeklyMessage","已複製到新增表單。修改星期、區域、時段或課程，再儲存即可。");
      $("#weeklyTitle").focus();c.scrollIntoView({behavior:"smooth",block:"start"});
    });
    $$( "[data-weekly-delete]" ).forEach(button=>button.onclick=async()=>{
      const row=rows.find(r=>r.id===button.dataset.weeklyDelete);if(!row||!confirm("確定刪除這個每週固定課程格？"))return;
      try{await sdk.deleteDoc(sdk.doc(db,"schedule",row.id));await adminSection("schedule");toast("課程格已刪除")}
      catch(e){toast("刪除失敗："+friendlyError(e))}
    });
    $$( "[data-weekly-card]" ).forEach(card=>{
      card.addEventListener("dragstart",event=>{event.dataTransfer.setData("text/plain",card.dataset.weeklyCard);event.dataTransfer.effectAllowed="move";card.classList.add("dragging")});
      card.addEventListener("dragend",()=>card.classList.remove("dragging"));
    });
    $$( "[data-drop-weekday]" ).forEach(column=>{
      column.addEventListener("dragover",event=>{event.preventDefault();column.classList.add("drag-over");event.dataTransfer.dropEffect="move"});
      column.addEventListener("dragleave",event=>{if(!column.contains(event.relatedTarget))column.classList.remove("drag-over")});
      column.addEventListener("drop",async event=>{
        event.preventDefault();column.classList.remove("drag-over");
        const id=event.dataTransfer.getData("text/plain"),row=rows.find(r=>r.id===id),weekday=Number(column.dataset.dropWeekday);
        if(!row||row.weekday===weekday)return;
        try{await sdk.setDoc(sdk.doc(db,"schedule",id),{weekday,dayName:weekdays.find(d=>d.value===weekday)?.label||"",date:null,updatedAt:sdk.serverTimestamp()},{merge:true});await adminSection("schedule");toast("已移到"+(weekdays.find(d=>d.value===weekday)?.label||"指定星期"))}
        catch(e){toast("移動失敗："+friendlyError(e))}
      });
    });
  }
  if(which==="bookings"){
    c.innerHTML='<div class="notice" role="status">正在讀取申請與照片資料…（若 12 秒內無回應，會顯示原因）</div>';
    const snap=await withFirestoreTimeout(sdk.getDocs(sdk.collection(db,"bookings")),"申請／照片資料讀取",12000),rows=snap.docs.map(d=>({id:d.id,...d.data()}));
    const createdMillis=value=>value?.toDate?value.toDate().getTime():(value?new Date(value).getTime():0);
    rows.sort((a,b)=>createdMillis(b.createdAt)-createdMillis(a.createdAt));
    c.innerHTML='<h3>申請／照片管理</h3><div class="table-wrap"><table><thead><tr><th>申請人／手機</th><th>項目／時間</th><th>狀態</th><th>簽到／照片</th><th>審核</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.name)+'<br>'+esc(r.className)+'<br>'+esc(r.phone)+'</td><td>'+esc(r.item)+'<br>'+esc(r.date)+' '+esc(r.start)+'–'+esc(r.endDate&&r.endDate!==r.date?r.endDate+' ':'')+esc(r.endTime)+'<br><small>'+esc(r.purpose||"")+'</small></td><td>'+esc(r.displayStatus||statusLabel(r.status))+(r.legacyImportConflict?'<br><b style="color:#b45309">⚠ 匯入時段衝突，未佔用時段</b>':"")+'</td><td>'+(r.checkedInAt?"已簽到":"未簽到")+'／'+(r.checkedOutAt?"已簽退":"未簽退")+'<br>'+((r.photoIds||[]).map((p,i)=>'<button class="secondary" data-openphoto="'+esc(r.id)+'" data-photoid="'+esc(p)+'">照片'+(i+1)+'</button>').concat((Array.isArray(r.photos)?r.photos:[]).map((p,i)=>'<button class="secondary" data-openlegacy="'+esc(r.id)+'" data-legacyidx="'+i+'">舊照片'+(i+1)+'</button>')).join(" ")||"無照片")+'</td><td><select data-status="'+esc(r.id)+'">'+["pending","approved","rejected","cancelled","finished"].map(k=>'<option value="'+k+'" '+(r.status===k?"selected":"")+'>'+statusLabel(k)+'</option>').join("")+'</select><button class="secondary" data-savebooking="'+esc(r.id)+'">儲存</button></td></tr>').join("")+'</tbody></table></div>';
    $$("[data-savebooking]").forEach(b=>b.onclick=async()=>{const id=b.dataset.savebooking,status=$("[data-status='"+id+"']",c).value;try{await sdk.updateDoc(sdk.doc(db,"bookings",id),{status,reviewedAt:sdk.serverTimestamp()});if(["rejected","cancelled","finished"].includes(status)){const locks=await sdk.getDocs(sdk.query(sdk.collection(db,"reservationLocks"),sdk.where("bookingId","==",id)));for(const l of locks.docs)await sdk.deleteDoc(sdk.doc(db,"reservationLocks",l.id))}toast("申請狀態已更新");await adminSection("bookings")}catch(e){toast("更新失敗："+friendlyError(e))}});
    $$("[data-openphoto]").forEach(b=>b.onclick=async()=>{
      const w=window.open("","_blank");if(!w)return toast("瀏覽器阻擋新視窗，請允許彈出視窗後重試");
      try{
        const d=await withFirestoreTimeout(sdk.getDoc(sdk.doc(db,"bookings",b.dataset.openphoto,"photos",b.dataset.photoid)),"簽退照片讀取",12000);
        if(!d.exists())throw new Error("照片已清除或超過保留期限。");
        w.document.open();
        w.document.write('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>簽退照片</title><style>body{margin:0;background:#111;color:#fff;font:16px Arial,sans-serif;text-align:center}img{display:block;max-width:96vw;max-height:88vh;margin:12px auto;object-fit:contain}p{padding:0 12px}</style><p>簽退照片</p><img id="photoPreview" alt="簽退照片"><p id="photoError" hidden>圖片無法顯示，可能已損毀或已清理。</p></html>');
        w.document.close();
        const img=w.document.getElementById("photoPreview"),error=w.document.getElementById("photoError");
        img.onerror=()=>{img.hidden=true;error.hidden=false};
        img.src=d.data().dataUrl;
      }catch(e){w.close();toast("無法開啟照片："+friendlyError(e))}
    });
    $$("[data-openlegacy]").forEach(b=>b.onclick=async()=>{
      const w=window.open("","_blank");if(!w)return toast("瀏覽器阻擋新視窗，請允許彈出視窗後重試");
      try{
        const snap=await withFirestoreTimeout(sdk.getDoc(sdk.doc(db,"bookings",b.dataset.openlegacy)),"舊申請照片讀取",12000);
        if(!snap.exists())throw new Error("找不到這筆舊申請。");
        const photos=Array.isArray(snap.data().photos)?snap.data().photos:[];
        const entry=photos[Number(b.dataset.legacyidx)];
        const src=typeof entry==="string"?entry:(entry?.dataUrl||entry?.url||entry?.src||"");
        if(typeof src!=="string"||!src)throw new Error("舊照片欄位不是有效的圖片網址或 data URL。");
        w.document.open();
        w.document.write('<!doctype html><meta charset="utf-8"><title>舊簽退照片</title><style>body{margin:0;padding:12px;background:#111;color:#fff;display:grid;place-items:center;min-height:100vh}img{max-width:100%;max-height:90vh;object-fit:contain}a{color:#9dd0ff}</style><img id="legacyPhoto" alt="舊簽退照片"><p id="legacyPhotoFallback" hidden>瀏覽器無法直接顯示這個舊連結，<a id="legacyPhotoLink" target="_blank" rel="noopener">點此開啟原始照片</a></p>');
        w.document.close();
        const photoElement=w.document.getElementById("legacyPhoto"),fallbackElement=w.document.getElementById("legacyPhotoFallback"),linkElement=w.document.getElementById("legacyPhotoLink");
        linkElement.href=src;
        photoElement.onerror=()=>{photoElement.hidden=true;fallbackElement.hidden=false};
        photoElement.src=src;
      }catch(e){w.close();toast("無法開啟舊照片："+friendlyError(e))}
    });
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
// Compat adapter：依照可正常運作的個人網站後台，統一改用 Firebase 10.12.2 compat API。
// 保留目前預約系統使用的介面，避免重寫交易、借用、課表匯入及照片流程。
function createModularSdk(appSdk,authSdk,firestoreSdk){
  const restMeta=new WeakMap();
  const api=Object.assign({},appSdk,authSdk,firestoreSdk);
  const wrapRestSnapshot=(docData,path)=>{
    const ref=firestoreSdk.doc(db,path);
    const exists=!!docData;
    const data=exists?decodeFields(docData.fields||{}):undefined;
    return {id:ref.id,ref,exists:()=>exists,data:()=>data,get:field=>data?.[field],metadata:{fromCache:false,hasPendingWrites:false}};
  };
  const encodeValue=value=>{
    if(value===null)return {nullValue:null};
    if(typeof value==="string")return {stringValue:value};
    if(typeof value==="boolean")return {booleanValue:value};
    if(typeof value==="number")return Number.isInteger(value)?{integerValue:String(value)}:{doubleValue:value};
    if(value instanceof Date)return {timestampValue:value.toISOString()};
    if(value&&typeof value.toDate==="function")return {timestampValue:value.toDate().toISOString()};
    if(Array.isArray(value))return {arrayValue:{values:value.map(encodeValue)}};
    if(value&&typeof value==="object")return {mapValue:{fields:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encodeValue(v)]))}};
    return {stringValue:String(value)};
  };
  const decodeValue=value=>{
    if(!value||typeof value!=="object")return value;
    if("nullValue" in value)return null;
    if("stringValue" in value)return value.stringValue;
    if("booleanValue" in value)return value.booleanValue;
    if("integerValue" in value)return Number(value.integerValue);
    if("doubleValue" in value)return Number(value.doubleValue);
    if("timestampValue" in value)return firebaseSdkTimestamp(value.timestampValue);
    if("referenceValue" in value){
      const marker="/documents/",i=value.referenceValue.indexOf(marker);
      return i>=0?firestoreSdk.doc(db,value.referenceValue.slice(i+marker.length)):value.referenceValue;
    }
    if("bytesValue" in value)return value.bytesValue;
    if("arrayValue" in value)return (value.arrayValue.values||[]).map(decodeValue);
    if("mapValue" in value)return decodeFields(value.mapValue.fields||{});
    return value;
  };
  function firebaseSdkTimestamp(value){
    return api.Timestamp?api.Timestamp.fromDate(new Date(value)):new Date(value);
  }
  function decodeFields(fields){
    return Object.fromEntries(Object.entries(fields||{}).map(([k,v])=>[k,decodeValue(v)]));
  }
  function addApiKey(url){
    const parsed=new URL(url);
    if(firebaseConfig?.apiKey&&!parsed.searchParams.has("key"))parsed.searchParams.set("key",firebaseConfig.apiKey);
    return parsed.toString();
  }
  async function restRequest(url,init={},allowDocNotFound=false){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),8000);
    try{
      const headers={...(init.headers||{})};
      if(auth?.currentUser)headers.Authorization="Bearer "+await auth.currentUser.getIdToken();
      headers["Content-Type"]="application/json";
      const response=await fetch(addApiKey(url),{...init,headers,signal:controller.signal});
      const body=await response.text();
      let parsed={};
      try{parsed=body?JSON.parse(body):{}}catch(_){}
      if(!response.ok){
        const apiError=parsed?.error||{};
        const detail=apiError.message||body||response.statusText;
        if(allowDocNotFound&&response.status===404&&/document not found/i.test(String(detail))&&!/database .* does not exist/i.test(String(detail)))return {__notFound:true};
        const error=new Error("Firestore REST API HTTP "+response.status+"："+String(detail).slice(0,700));
        error.code="firestore-rest-http-"+response.status;
        throw error;
      }
      return parsed;
    }catch(e){
      if(e?.name==="AbortError"){
        const error=new Error("Firestore REST API 連線在 8 秒內沒有回應。請檢查網站到 firestore.googleapis.com 的連線。");
        error.code="firestore-rest-timeout";
        throw error;
      }
      throw e;
    }finally{clearTimeout(timer)}
  }
  function restRoot(){
    if(!firebaseConfig?.projectId||!firebaseConfig?.apiKey)throw new Error("Firebase 專案 ID 或 API Key 尚未載入。");
    return "https://firestore.googleapis.com/v1/projects/"+encodeURIComponent(firebaseConfig.projectId)+"/databases/"+encodeURIComponent(FIRESTORE_DATABASE_ID)+"/documents";
  }
  async function restGetDoc(ref){
    const path=String(ref.path||"");
    const result=await restRequest(restRoot()+"/"+path.split("/").map(encodeURIComponent).join("/"),{},true);
    if(result.__notFound)return wrapRestSnapshot(null,path);
    return wrapRestSnapshot(result,path);
  }
  async function restGetDocs(ref){
    const meta=restMeta.get(ref)||{path:String(ref.path||""),constraints:[]};
    const path=meta.path;
    if(!path)throw new Error("無法取得 Firestore 集合路徑。");
    const constraints=meta.constraints||[];
    const docs=[];
    if(constraints.length){
      const parts=path.split("/"),collectionId=parts.pop(),parentDocPath=parts.join("/");
      const endpoint=restRoot()+(parentDocPath?"/"+parentDocPath.split("/").map(encodeURIComponent).join("/"): "")+":runQuery";
      const filters=constraints.map(c=>({fieldFilter:{field:{fieldPath:c.field},op:({"==":"EQUAL","!=":"NOT_EQUAL","<":"LESS_THAN","<=":"LESS_THAN_OR_EQUAL",">":"GREATER_THAN",">=":"GREATER_THAN_OR_EQUAL"}[c.op]||"EQUAL"),value:encodeValue(c.value)}}));
      const where=filters.length===1?filters[0]:{compositeFilter:{op:"AND",filters}};
      const result=await restRequest(endpoint,{method:"POST",body:JSON.stringify({structuredQuery:{from:[{collectionId}],where,limit:1000}})});
      for(const row of (Array.isArray(result)?result:[])){
        if(!row.document)continue;
        const marker="/documents/",idx=row.document.name.indexOf(marker);
        if(idx>=0)docs.push(wrapRestSnapshot(row.document,row.document.name.slice(idx+marker.length)));
      }
    }else{
      let token="";
      do{
        const url=restRoot()+"/"+path.split("/").map(encodeURIComponent).join("/")+"?pageSize=1000"+(token?"&pageToken="+encodeURIComponent(token):"");
        const result=await restRequest(url);
        for(const item of result.documents||[]){
          const marker="/documents/",idx=item.name.indexOf(marker);
          if(idx>=0)docs.push(wrapRestSnapshot(item,item.name.slice(idx+marker.length)));
        }
        token=result.nextPageToken||"";
      }while(token);
    }
    return {docs,empty:docs.length===0,size:docs.length,metadata:{fromCache:false,hasPendingWrites:false},forEach:fn=>docs.forEach(fn)};
  }
  function readTimeout(promise,ms){
    let timer;
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{
      const error=new Error("Firebase SDK 讀取在 "+ms+"ms 內沒有回應。");error.code="csu/sdk-read-timeout";reject(error);
    },ms)});
    return Promise.race([Promise.resolve(promise),timeout]).finally(()=>clearTimeout(timer));
  }
  async function resilientRead(kind,ref){
    try{
      return await readTimeout(kind==="doc"?firestoreSdk.getDoc(ref):firestoreSdk.getDocs(ref),2500);
    }catch(sdkError){
      if(sdkError?.code==="permission-denied")throw sdkError;
      console.warn("Firestore SDK read failed; trying REST fallback",kind,sdkError?.code||"",sdkError?.message||sdkError);
      try{return kind==="doc"?await restGetDoc(ref):await restGetDocs(ref)}
      catch(restError){
        const error=new Error("Firestore SDK 讀取失敗（"+(sdkError?.code||"no-code")+"："+(sdkError?.message||sdkError)+"）；REST 備援也失敗（"+(restError?.code||"no-code")+"："+(restError?.message||restError)+"）。");
        error.code=restError?.code||"firestore-read-failed";
        error.sdkError=sdkError;error.restError=restError;
        throw error;
      }
    }
  }
  api.collection=(dbRef,...path)=>{
    const ref=firestoreSdk.collection(dbRef,...path);
    restMeta.set(ref,{path:path.join("/"),constraints:[]});
    return ref;
  };
  api.doc=(refOrDb,...path)=>{
    const ref=firestoreSdk.doc(refOrDb,...path);
    const refPath=String(ref.path||"");
    if(refPath)restMeta.set(ref,{path:refPath,constraints:[]});
    return ref;
  };
  api.where=(field,op,value)=>({native:firestoreSdk.where(field,op,value),descriptor:{field,op,value}});
  api.query=(base,...constraints)=>{
    const previous=restMeta.get(base)||{path:String(base.path||""),constraints:[]};
    const result=firestoreSdk.query(base,...constraints.map(c=>c.native||c));
    const descriptors=constraints.map(c=>c.descriptor).filter(Boolean);
    restMeta.set(result,{path:previous.path,constraints:[...(previous.constraints||[]),...descriptors]});
    return result;
  };
  api.getDoc=ref=>resilientRead("doc",ref);
  api.getDocs=ref=>resilientRead("docs",ref);
  return api;
}
// Use the explicitly named database visible in Firebase Console: /firestore/databases/default/...
// This is different from Firestore's reserved database ID "(default)".
async function boot(){
  try{
    const [appSdk,authSdk,firestoreSdk,configModule]=await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"),
      import("./firebase-config.js")
    ]);
    sdk=createModularSdk(appSdk,authSdk,firestoreSdk);
    firebaseConfig=configModule.firebaseConfig;
    app=sdk.initializeApp(firebaseConfig);
    auth=sdk.getAuth(app);
    // The console route showed database ID "default"; target it explicitly.
    db=sdk.initializeFirestore(app,{experimentalForceLongPolling:true},FIRESTORE_DATABASE_ID);
    try{
      await loadConfig();
      render();
    }catch(e){
      console.error("Firestore 初始化讀取失敗",e);
      const n=document.createElement("div");n.className="notice";
      n.textContent="表單已載入，但 Firestore 讀取失敗："+friendlyError(e);
      $("#view").prepend(n);
    }
  }catch(e){
    console.error("網站啟動失敗",e);
    const n=document.createElement("div");n.className="notice";
    n.textContent="網站介面可用，但 Firebase SDK／設定載入失敗："+friendlyError(e);
    $("#view").prepend(n);
  }
}
bindShell();
boot();
