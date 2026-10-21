const API="https://asia-east1-csu-order-system-af6bb.cloudfunctions.net";
const $=s=>document.querySelector(s), $$=(s,root=document)=>[...root.querySelectorAll(s)];
let sdk={},app=null,auth=null,db=null,storage=null,adminUser=null;
let config={items:[],rules:{},settings:{}},currentView="booking",lastLookup=null;
const labels={booking:"空間預約",borrowing:"雙向借用",micro:"借用正修微工坊",output:"借用出圖室",records:"我的申請／簽到簽退"};
const defaults={
booking:"每區最多兩組，單組不得獨占。請愛惜空間與設備，使用後清潔復原。",
borrowing:"借出及歸還時請確認物品狀況，並依管理員公告辦理。",
micro:"使用前確認機器狀態並遵守操作規範，操作時請配戴必要防護具。",
output:"使用前確認設備與檔案設定；離開前整理環境並帶走個人物品。"
};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const today=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)};
function toast(s){const n=$("#toast");if(!n)return;n.textContent=s;n.classList.add("show");setTimeout(()=>n.classList.remove("show"),3200)}
function feedback(id,s,error=false){const n=$("#"+id);if(n){n.textContent=s||"";n.classList.toggle("error",!!error)}}
async function callApi(action,body){
 const r=await fetch(API+"/publicBookingApi",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.assign({action},body||{}))});
 const result=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(result.error||result.message||"操作失敗，請稍後重試。");
 return result;
}
function items(type){return config.items.filter(i=>i.category===type||i.category==="all")}
function timeOptions(){let s="";for(let h=0;h<24;h++)for(const m of ["00","30"]){const t=String(h).padStart(2,"0")+":"+m;s+='<option value="'+t+'">'+t+"</option>"}return s}
function itemOptions(type){const a=items(type);return '<option value="">請選擇空間／設備</option>'+a.map(i=>'<option value="'+esc(i.id)+'" '+(i.available===false?"disabled":"")+'>'+esc(i.name)+(i.available===false?"（暫停借用）":"")+"</option>").join("")}
function requestForm(type,title){
 const list=items(type),isWorkshop=["micro","output"].includes(type);
 return '<h2>'+esc(title)+'</h2><p class="muted">學生免登入，填寫資料即可申請。送出後請保存查詢碼，之後以手機號碼＋查詢碼查詢、簽到及簽退。</p>'+
 (list.length?"":'<div class="notice">目前尚未設定此分類的空間／設備。管理員需先新增項目，否則無法送出申請。</div>')+
 '<form id="requestForm"><div class="grid">'+
 '<label class="field">姓名 *<input id="personName" required maxlength="60" autocomplete="name"></label>'+
 '<label class="field">班級／單位 *<input id="className" required maxlength="80" placeholder="例如：建築四甲"></label>'+
 '<label class="field">手機號碼 *<input id="phone" type="tel" required maxlength="30" placeholder="09xxxxxxxx"></label>'+
 '<label class="field">借用方式<select id="borrowType"><option value="單人借用">單人借用</option><option value="小組借用">小組借用</option></select></label>'+
 '<label class="field">空間／設備 *<select id="item" required>'+itemOptions(type)+'</select></label>'+
 '<label class="field">開始日期 *<input id="date" type="date" value="'+today()+'" min="'+today()+'" required></label>'+
 '<label class="field">開始時間 *<select id="start" required>'+timeOptions()+'</select></label>'+
 '<label class="field">借用時數 *<select id="hours"><option value="3">3 小時</option><option value="6">6 小時</option></select></label></div>'+
 '<label class="field">用途／備註<textarea id="purpose" maxlength="1000" placeholder="簡述使用目的、加工材料或設備需求"></textarea></label>'+
 (isWorkshop?'<h3>使用規範與注意事項</h3><div class="rule">'+esc(config.rules[type]||defaults[type])+'</div><label class="check"><input id="agreeRules" type="checkbox"><span>我已閱讀並同意遵守上述規範。</span></label>':"")+
 '<label class="check"><input id="agree" type="checkbox"><span>我會對本人／全組使用負責，離場前清潔復原、完成簽退並上傳現況照片。</span></label>'+
 '<div class="notice">'+esc(config.settings.notice||"原站規則：起始時間每 30 分鐘一格；借用時數以 3 小時為倍數，建議不超過 6 小時。夜間 19:00 至翌日 08:00 須在 19:00 前登記；寒暑假開放情況依管理員公告。21:30 現場無人將鎖門。")+'</div>'+
 '<p id="requestMessage" class="feedback" role="status" aria-live="polite"></p><div id="receipt" class="notice hidden"></div>'+
 '<button class="primary full" type="submit" '+(list.length?"":"disabled")+'>送出申請</button></form>';
}
function render(){
 $$(".tab").forEach(b=>b.classList.toggle("active",b.dataset.view===currentView));
 const v=$("#view");if(!v)return;
 if(currentView==="booking")v.innerHTML=requestForm("booking","正修建築圖科九樓設計教室空間預約");
 else if(currentView==="borrowing")v.innerHTML=requestForm("borrowing","雙向借用／設備及物品借還登記");
 else if(currentView==="micro"||currentView==="output"){
  const isClosed=config.settings[currentView+"Open"]===false;
  const cards=items(currentView).map(i=>'<article class="item"><h3>'+esc(i.name)+'</h3><span class="status '+(i.available===false?"off":"")+'">'+(i.available===false?"目前不可用":"可用")+'</span><p>'+esc(i.description||"請依現場公告與管理員指示使用。")+'</p></article>').join("");
  v.innerHTML='<div class="notice">'+labels[currentView]+'目前：<b>'+(isClosed?"暫停開放":"開放申請")+'</b></div>'+(isClosed?"<p>目前暫停申請，請留意管理員公告。</p>":'<div class="cards">'+(cards||'<p class="muted">目前尚未建立機器或設備清單。</p>')+'</div>'+requestForm(currentView,labels[currentView]));
 }else{
  v.innerHTML='<h2>我的申請／簽到簽退</h2><p class="muted">學生免登入。請使用送出申請時取得的查詢碼與原本填寫的手機號碼。</p><div class="grid">'+
  '<label class="field">申請時的手機號碼<input id="lookupPhone" type="tel" required></label><label class="field">申請查詢碼<input id="lookupCode" maxlength="32" required placeholder="送出申請後取得的查詢碼"></label></div>'+
  '<button id="lookupBtn" class="primary">查詢我的申請</button><p id="lookupMessage" class="feedback" role="status"></p><div id="myRecords"></div>';
  $("#lookupBtn").onclick=loadMine;
 }
 const f=$("#requestForm");if(f)f.onsubmit=submitRequest;
}
async function submitRequest(e){
 e.preventDefault();const val=id=>$("#"+id)?.value?.trim()||"",type=currentView;
 try{
  feedback("requestMessage","");
  const itemId=val("item"),item=config.items.find(x=>x.id===itemId),hours=Number(val("hours"));
  if(!val("personName")||!val("className")||!val("phone")||!itemId||!val("date"))throw Error("請完整填寫姓名、班級、手機、空間／設備及日期。");
  if(!item||item.available===false)throw Error("此空間／設備目前不可借用。");
  if(type==="micro"&&config.settings.microOpen===false||type==="output"&&config.settings.outputOpen===false)throw Error("此空間目前暫停開放。");
  if(["micro","output"].includes(type)&&!$("#agreeRules").checked)throw Error("請先閱讀並同意使用規範。");
  if(!$("#agree").checked)throw Error("請先勾選使用責任與簽退規範。");
  const result=await callApi("create",{name:val("personName"),className:val("className"),phone:val("phone"),borrowType:val("borrowType"),type,itemId,date:val("date"),start:val("start"),hours,purpose:val("purpose"),agreed:true,agreedRules:!!$("#agreeRules")?.checked});
  const box=$("#receipt");box.classList.remove("hidden");box.innerHTML='<b>申請已送出，狀態：待審核</b><p>申請編號：'+esc(result.bookingId)+'</p><p>你的查詢碼：<strong style="font-size:22px;letter-spacing:.08em">'+esc(result.code)+'</strong></p><p>請立即保存此查詢碼；之後需使用「手機號碼＋查詢碼」查詢與簽到簽退。查詢碼只顯示這一次。</p><button type="button" id="copyCode" class="secondary">複製查詢碼</button>';
  $("#copyCode").onclick=async()=>{try{await navigator.clipboard.writeText(result.code);toast("查詢碼已複製")}catch{toast("請手動抄下查詢碼："+result.code)}};
  feedback("requestMessage","申請已送出。請保存上方查詢碼。");e.target.reset();$("#date").value=today();toast("申請已送出");
 }catch(err){feedback("requestMessage",err.message||"送出失敗，請稍後重試。",true)}
}
const statusLabel=s=>({pending:"待審核",approved:"已核准",rejected:"未核准",cancelled:"已取消",finished:"已完成"})[s]||s||"未知";
function recordCard(r){
 return '<article class="item"><h3>'+esc(r.item)+'</h3><p>申請人：'+esc(r.name)+'（'+esc(r.className)+'）</p><p>日期：'+esc(r.date)+'　時段：'+esc(r.start)+'–'+esc(r.endTime)+'（'+esc(r.hours)+' 小時）</p><p>狀態：<b>'+esc(statusLabel(r.status))+'</b></p><p>簽到：'+(r.checkedIn?"已完成":"尚未簽到")+'；簽退：'+(r.checkedOut?"已完成":"尚未簽退")+'</p>'+
 (r.status==="approved"&&!r.checkedIn?'<button id="checkinBtn" class="primary">到場簽到</button>':"")+
 (r.checkedIn&&!r.checkedOut?'<button id="checkoutBtn" class="primary">簽退並上傳照片</button>':"")+
 (r.status==="pending"?'<p class="muted">申請正在等待管理員核准。</p>':"")+
 ((r.status==="rejected"||r.status==="cancelled")?'<p class="muted">此申請未核准或已取消。</p>':"")+'</article>';
}
async function loadMine(){
 const phone=$("#lookupPhone").value.trim(),code=$("#lookupCode").value.trim().toUpperCase();
 if(!phone||!code){feedback("lookupMessage","請輸入手機號碼與查詢碼。",true);return}
 try{
  const result=await callApi("lookup",{phone,code});lastLookup={phone,code,booking:result.booking};
  $("#myRecords").innerHTML=recordCard(result.booking);feedback("lookupMessage","查詢成功。");
  if($("#checkinBtn"))$("#checkinBtn").onclick=async()=>{try{await callApi("checkin",{phone,code});toast("簽到成功");await loadMine()}catch(e){feedback("lookupMessage",e.message,true)}};
  if($("#checkoutBtn"))$("#checkoutBtn").onclick=()=>checkout(phone,code);
 }catch(e){$("#myRecords").innerHTML="";feedback("lookupMessage",e.message||"查詢失敗。",true)}
}
async function checkout(phone,code){
 const picker=document.createElement("input");picker.type="file";picker.accept="image/jpeg,image/png,image/webp,image/heic";picker.multiple=true;
 picker.onchange=async()=>{
  const files=[...(picker.files||[])];if(files.length<1||files.length>5){toast("請選擇 1 至 5 張照片");return}
  try{
   if(files.some(f=>f.size>8*1024*1024))throw Error("單張照片不可超過 8 MB。");
   const signed=await callApi("photoUploadUrls",{phone,code,files:files.map(f=>({name:f.name,type:f.type,size:f.size}))});
   for(let i=0;i<files.length;i++){const up=await fetch(signed.upload[i].url,{method:"PUT",headers:{"Content-Type":signed.upload[i].contentType},body:files[i]});if(!up.ok)throw Error("照片上傳失敗，請確認 Storage CORS 設定後重試。")}
   await callApi("checkout",{phone,code,paths:signed.upload.map(x=>x.path)});toast("簽退完成，照片已回傳");await loadMine();
  }catch(e){feedback("lookupMessage",e.message||"照片上傳失敗。",true)}
 };
 picker.click();
}
function bindShell(){
 $("#adminOpen").onclick=()=>$("#adminModal").classList.remove("hidden");
 $("#adminClose").onclick=()=>$("#adminModal").classList.add("hidden");
 $("#loginBtn").onclick=loginAdmin;
 $$(".tab").forEach(b=>b.onclick=()=>{currentView=b.dataset.view;render()});
 render();
}
async function loginAdmin(){
 const username=$("#adminEmail").value.trim(),password=$("#adminPassword").value,button=$("#loginBtn"),label=button.textContent;
 if(!username||!password){feedback("loginError","請輸入管理員帳號與密碼。",true);return}
 button.disabled=true;button.textContent="驗證中…";
 try{
  const r=await fetch(API+"/adminLogin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})}),data=await r.json().catch(()=>({}));
  if(!r.ok||!data.token)throw Error(data.message||"登入失敗，請確認後端登入服務已部署。");
  const c=await sdk.signInWithCustomToken(auth,data.token);adminUser=c.user;$("#adminPassword").value="";feedback("loginError","");await showAdmin();
 }catch(e){feedback("loginError",e.message||"登入失敗。",true)}
 finally{button.disabled=false;button.textContent=label}
}
async function showAdmin(){
 const p=$("#adminPanel");p.classList.remove("hidden");
 p.innerHTML='<div class="admin-tools"><h2>管理員設定中心</h2><div class="admin-nav"><button data-admin="settings">公告／開放設定</button><button data-admin="items">空間／設備</button><button data-admin="schedule">課表</button><button data-admin="bookings">申請與照片</button><button id="logoutBtn">登出</button></div><div id="adminContent"></div></div>';
 $$("[data-admin]").forEach(b=>b.onclick=()=>adminSection(b.dataset.admin));
 $("#logoutBtn").onclick=async()=>{await sdk.signOut(auth);adminUser=null;p.classList.add("hidden");toast("已登出管理員")};
 await adminSection("settings");
}
async function adminSection(which){
 const c=$("#adminContent");
 if(which==="settings"){
  const s=config.settings||{},r=config.rules||{};
  c.innerHTML='<h3>開放狀態／公告與規範</h3><label class="check"><input id="microOpen" type="checkbox" '+(s.microOpen===false?"":"checked")+'>開放正修微工坊</label><label class="check"><input id="outputOpen" type="checkbox" '+(s.outputOpen===false?"":"checked")+'>開放出圖室</label><label class="field">網站公告<textarea id="siteNotice">'+esc(s.notice||"")+'</textarea></label>'+
  ["booking","borrowing","micro","output"].map(k=>'<label class="field">'+labels[k]+'規範<textarea id="rule_'+k+'">'+esc(r[k]||defaults[k])+'</textarea></label>').join("")+'<button class="primary" id="saveSettings">儲存設定</button>';
  $("#saveSettings").onclick=async()=>{try{await sdk.setDoc(sdk.doc(db,"settings","public"),{settings:{microOpen:$("#microOpen").checked,outputOpen:$("#outputOpen").checked,notice:$("#siteNotice").value},rules:Object.fromEntries(["booking","borrowing","micro","output"].map(k=>[k,$("#rule_"+k).value]))},{merge:true});await loadConfig();render();toast("設定已儲存")}catch(e){toast("儲存失敗："+e.message)}};
 }
 if(which==="items"){
  c.innerHTML='<h3>新增空間／設備</h3><div class="grid"><label class="field">名稱<input id="newName"></label><label class="field">分類<select id="newCategory"><option value="booking">設計教室</option><option value="borrowing">雙向借用</option><option value="micro">正修微工坊</option><option value="output">出圖室</option><option value="all">全部分類</option></select></label></div><label class="field">說明／設備用途<input id="newDesc"></label><label class="check"><input id="newAvailable" type="checkbox" checked>目前可用</label><button class="primary" id="addItem">新增項目</button><h3>既有項目（可編輯）</h3><div class="table-wrap"><table><thead><tr><th>名稱／說明</th><th>分類</th><th>狀態</th><th>操作</th></tr></thead><tbody>'+
  config.items.map(i=>'<tr><td><input data-name="'+esc(i.id)+'" value="'+esc(i.name)+'"><input data-desc="'+esc(i.id)+'" value="'+esc(i.description||"")+'" placeholder="說明"></td><td><select data-cat="'+esc(i.id)+'">'+["booking","borrowing","micro","output","all"].map(k=>'<option value="'+k+'" '+(i.category===k?"selected":"")+'>'+k+'</option>').join("")+'</select></td><td><input data-avail="'+esc(i.id)+'" type="checkbox" '+(i.available===false?"":"checked")+'></td><td><button class="secondary" data-saveitem="'+esc(i.id)+'">儲存</button><button class="danger" data-delitem="'+esc(i.id)+'">刪除</button></td></tr>').join("")+
  '</tbody></table></div><p class="muted">原始匯出碼沒有動態空間清單，需依原站實際資料建立項目。</p>';
  $("#addItem").onclick=async()=>{const name=$("#newName").value.trim();if(!name)return toast("請輸入名稱");try{await sdk.addDoc(sdk.collection(db,"items"),{name,category:$("#newCategory").value,description:$("#newDesc").value,available:$("#newAvailable").checked,updatedAt:sdk.serverTimestamp()});await loadConfig();await adminSection("items");toast("項目已新增")}catch(e){toast("新增失敗："+e.message)}};
  $$("[data-saveitem]").forEach(b=>b.onclick=async()=>{const id=b.dataset.saveitem;try{await sdk.updateDoc(sdk.doc(db,"items",id),{name:$("[data-name='"+id+"']",c).value.trim(),description:$("[data-desc='"+id+"']",c).value,category:$("[data-cat='"+id+"']",c).value,available:$("[data-avail='"+id+"']",c).checked,updatedAt:sdk.serverTimestamp()});await loadConfig();await adminSection("items");toast("項目已更新")}catch(e){toast("更新失敗："+e.message)}});
  $$("[data-delitem]").forEach(b=>b.onclick=async()=>{if(!confirm("確定刪除此項目？"))return;try{await sdk.deleteDoc(sdk.doc(db,"items",b.dataset.delitem));await loadConfig();await adminSection("items");toast("項目已刪除")}catch(e){toast("刪除失敗："+e.message)}});
 }
 if(which==="schedule"){
  const snap=await sdk.getDocs(sdk.query(sdk.collection(db,"schedule"),sdk.orderBy("date","asc"))).catch(()=>null),rows=snap?snap.docs.map(d=>Object.assign({id:d.id},d.data())):[];
  c.innerHTML='<h3>課表管理</h3><p class="muted">每行：日期,開始時間,結束時間,課程名稱,項目 ID（最後欄可省略，省略表示全域占用）。</p><label class="field">課表 CSV<textarea id="csv" rows="6" placeholder="2026-10-22,09:00,12:00,建築設計課"></textarea></label><label class="check"><input id="replaceSchedule" type="checkbox">匯入前清除全部現有課表（慎用）</label><button id="importSchedule" class="primary">匯入課表</button><h3>已匯入 '+rows.length+' 筆</h3><div class="table-wrap"><table><thead><tr><th>日期</th><th>時段</th><th>課程</th><th>操作</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.date)+'</td><td>'+esc(r.start)+'–'+esc(r.end)+'</td><td>'+esc(r.title||"課表占用")+'</td><td><button class="danger" data-sdel="'+esc(r.id)+'">刪除</button></td></tr>').join("")+'</tbody></table></div>';
  $("#importSchedule").onclick=async()=>{const parsed=[];for(const line of $("#csv").value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)){const p=line.split(",").map(x=>x.trim());if(p.length<3||!/^\d{4}-\d{2}-\d{2}$/.test(p[0])||!/^([01]\d|2[0-3]):[0-5]\d$/.test(p[1])||!/^([01]\d|2[0-3]):[0-5]\d$/.test(p[2])||p[1]>=p[2])return toast("格式錯誤："+line);parsed.push({date:p[0],start:p[1],end:p[2],title:p[3]||"課表占用",itemId:p[4]||"",createdAt:sdk.serverTimestamp()})}try{if($("#replaceSchedule").checked){const old=await sdk.getDocs(sdk.collection(db,"schedule"));for(const d of old.docs)await sdk.deleteDoc(sdk.doc(db,"schedule",d.id))}for(const row of parsed)await sdk.addDoc(sdk.collection(db,"schedule"),row);await adminSection("schedule");toast("已匯入 "+parsed.length+" 筆")}catch(e){toast("匯入失敗："+e.message)}};
  $$("[data-sdel]").forEach(b=>b.onclick=async()=>{if(!confirm("確定刪除此課表？"))return;try{await sdk.deleteDoc(sdk.doc(db,"schedule",b.dataset.sdel));await adminSection("schedule")}catch(e){toast("刪除失敗")}});
 }
 if(which==="bookings"){
  const snap=await sdk.getDocs(sdk.query(sdk.collection(db,"bookings"),sdk.orderBy("createdAt","desc"))),rows=snap.docs.map(d=>Object.assign({id:d.id},d.data()));
  c.innerHTML='<h3>申請／照片管理</h3><div class="table-wrap"><table><thead><tr><th>申請人／手機</th><th>項目／時間</th><th>狀態</th><th>照片</th><th>審核</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.name)+'<br>'+esc(r.className)+'<br>'+esc(r.phone)+'</td><td>'+esc(r.item)+'<br>'+esc(r.date)+' '+esc(r.start)+'–'+esc(r.endTime)+'</td><td>'+esc(statusLabel(r.status))+'</td><td>'+(r.photos||[]).map((p,i)=>'<a href="'+esc(p)+'" target="_blank" rel="noopener">照片'+(i+1)+'</a>').join(" ")+'</td><td><select data-status="'+esc(r.id)+'">'+["pending","approved","rejected","cancelled","finished"].map(k=>'<option value="'+k+'" '+(r.status===k?"selected":"")+'>'+statusLabel(k)+'</option>').join("")+'</select><button class="secondary" data-savebooking="'+esc(r.id)+'">儲存</button></td></tr>').join("")+'</tbody></table></div>';
  $$("[data-savebooking]").forEach(b=>b.onclick=async()=>{const id=b.dataset.savebooking,status=$("[data-status='"+id+"']",c).value;try{await sdk.updateDoc(sdk.doc(db,"bookings",id),{status,reviewedAt:sdk.serverTimestamp()});if(["rejected","cancelled","finished"].includes(status)){const locks=await sdk.getDocs(sdk.query(sdk.collection(db,"reservationLocks"),sdk.where("bookingId","==",id)));for(const l of locks.docs)await sdk.deleteDoc(sdk.doc(db,"reservationLocks",l.id))}toast("申請狀態已更新");await adminSection("bookings")}catch(e){toast("更新失敗："+e.message)}});
 }
}

async function boot(){
 bindShell();
 try{
  const [a,u,f,s,c]=await Promise.all([
   import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
   import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"),
   import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"),
   import("https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js"),
   import("./firebase-config.js")
  ]);
  sdk=Object.assign({},a,u,f,s);app=sdk.initializeApp(c.firebaseConfig);auth=sdk.getAuth(app);db=sdk.getFirestore(app);storage=sdk.getStorage(app);
  try{await loadConfig();render()}catch(e){console.error(e);const n=document.createElement("div");n.className="notice";n.textContent="表單可操作，但 Firebase 資料讀取失敗。請確認 Firestore 已建立且已發布讀取規則。"+(e.message||"");$("#view").prepend(n)}
 }catch(e){console.error("Firebase load failed",e);const n=document.createElement("div");n.className="notice";n.textContent="網頁按鈕可使用，但資料服務尚未連線。請確認 Firebase SDK 網路可用及設定檔正確。"+(e.message||"");$("#view").prepend(n)}
}
function bindShell(){
 $("#adminOpen")?.addEventListener("click",()=>$("#adminModal").classList.remove("hidden"));
 $("#adminClose")?.addEventListener("click",()=>$("#adminModal").classList.add("hidden"));
 $("#loginBtn")?.addEventListener("click",loginAdmin);
 $$(".tab").forEach(b=>b.addEventListener("click",()=>{currentView=b.dataset.view;render()}));
 render();
}
boot();
