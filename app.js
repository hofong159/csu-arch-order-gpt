// Bootstrap loader for GitHub Pages branch publishing.
// It keeps navigation responsive, then decompresses and patches the full app bundle.
const view = document.querySelector("#view");
const labels = {
  booking: "空間預約",
  borrowing: "雙向借用",
  micro: "借用正修微工坊",
  output: "借用出圖室",
  records: "我的申請／簽到簽退"
};
document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x === button));
    if (view) view.innerHTML = "<h2>" + labels[button.dataset.view] + "</h2><p>正在載入預約系統…</p>";
  });
});
document.querySelector("#adminOpen")?.addEventListener("click", () => document.querySelector("#adminModal")?.classList.remove("hidden"));
document.querySelector("#adminClose")?.addEventListener("click", () => document.querySelector("#adminModal")?.classList.add("hidden"));

async function boot() {
  try {
    const response = await fetch(new URL("./app.js.gz.b64", import.meta.url), { cache: "no-store" });
    if (!response.ok) throw new Error("無法讀取主程式套件（HTTP " + response.status + "）");
    const encoded = (await response.text()).trim();
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    if (!("DecompressionStream" in window)) throw new Error("此瀏覽器不支援 gzip 解壓縮，請改用最新版 Chrome 或 Edge。");
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    let source = await new Response(stream).text();

    const marker = 'let currentView = "booking", currentUser = auth.currentUser, adminUser = null;';
    const endTop = source.indexOf(marker);
    if (endTop < 0) throw new Error("主程式版本不符合預期（初始化區塊不存在）");
    const startTop = source.indexOf('import { initializeApp }');
    if (startTop < 0 || startTop > endTop) throw new Error("主程式初始化區塊不完整");
    const afterTop = endTop + marker.length;
    const newTop = [
      "// Firebase is loaded dynamically so failures do not disable navigation.",
      "let initializeApp, getAuth, signInAnonymously, signInWithEmailAndPassword, signOut;",
      "let getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, runTransaction;",
      "let getStorage, ref, uploadBytes, getDownloadURL, deleteObject, firebaseConfig;",
      "let app, auth, db, storage;",
      "const $ = s => document.querySelector(s), $$ = (s, root=document) => [...root.querySelectorAll(s)];",
      'let currentView = "booking", currentUser = null, adminUser = null;'
    ].join("\n");
    source = source.slice(0, startTop) + newTop + source.slice(afterTop);

    const oldTail = '$$(".tab").forEach(b=>b.onclick=()=>{currentView=b.dataset.view;render();});';
    const tailAt = source.lastIndexOf(oldTail);
    if (tailAt < 0) throw new Error("主程式初始化區塊不完整（事件綁定不存在）");
    const newTail = [
      '$("#adminOpen").onclick=()=>$("#adminModal").classList.remove("hidden");',
      '$("#adminClose").onclick=()=>$("#adminModal").classList.add("hidden");',
      '$$(".tab").forEach(b=>b.onclick=()=>{currentView=b.dataset.view;render();});',
      "render();",
      "(async()=>{",
      " const problems=[];",
      " try {",
      "  const [a,u,f,s,c]=await Promise.all([",
      '   import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),',
      '   import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"),',
      '   import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"),',
      '   import("https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js"),',
      '   import(' + JSON.stringify(new URL("./firebase-config.js", import.meta.url).href) + ')',
      "  ]);",
      "  ({initializeApp}=a);",
      "  ({getAuth,signInAnonymously,signInWithEmailAndPassword,signOut}=u);",
      "  ({getFirestore,collection,doc,getDoc,getDocs,setDoc,addDoc,updateDoc,deleteDoc,query,where,orderBy,serverTimestamp,runTransaction}=f);",
      "  ({getStorage,ref,uploadBytes,getDownloadURL,deleteObject}=s);",
      "  ({firebaseConfig}=c);",
      "  app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);storage=getStorage(app);",
      '  try { await loadConfig(); } catch(e) { console.error(e); problems.push("無法讀取 Firestore，請確認資料庫和讀取規則。"); }',
      "  render();",
      '  try { await ensureAnonymous(); } catch(e) { console.error(e); problems.push("請在 Firebase Authentication 啟用 Anonymous 登入，否則無法送出或查詢申請。"); }',
      "  render();",
      " } catch(e) {",
      '  console.error("Firebase modules/config failed",e);',
      '  problems.push("Firebase 模組或設定載入失敗；請確認網路與 firebase-config.js。");',
      " }",
      ' if(problems.length){const n=document.createElement("div");n.className="notice";n.textContent=problems.join("\\n");$("#view").prepend(n);}',
      "})();"
    ].join("\n");
    source = source.slice(0, tailAt) + newTail;
    const configUrl = new URL("./firebase-config.js", import.meta.url).href;
    source = source.replaceAll('"./firebase-config.js"', JSON.stringify(configUrl));
    const blobUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    try {
      await import(blobUrl);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  } catch (error) {
    console.error("Reservation site bootstrap failed", error);
    if (view) {
      const note = document.createElement("div");
      note.className = "notice";
      note.textContent = "介面已載入，但主程式啟動失敗：" + (error?.message || String(error)) + "。可先切換上方分頁；請查看 GitHub Actions 的部署紀錄。";
      view.prepend(note);
    }
  }
}
boot();
