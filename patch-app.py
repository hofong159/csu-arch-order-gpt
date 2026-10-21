from pathlib import Path
import sys
p = Path(sys.argv[1] if len(sys.argv)>1 else "app.js")
s = p.read_text(encoding="utf-8")
old_top = '''import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app), db = getFirestore(app), storage = getStorage(app);
const $ = s => document.querySelector(s), $$ = (s, root=document) => [...root.querySelectorAll(s)];
let currentView = "booking", currentUser = auth.currentUser, adminUser = null;
'''
new_top = '''let initializeApp, getAuth, signInAnonymously, signInWithEmailAndPassword, signOut;
let getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, runTransaction;
let getStorage, ref, uploadBytes, getDownloadURL, deleteObject, firebaseConfig;
let app, auth, db, storage;
const $ = s => document.querySelector(s), $$ = (s, root=document) => [...root.querySelectorAll(s)];
let currentView = "booking", currentUser = null, adminUser = null;
'''
old_tail = '''$$(".tab").forEach(b=>b.onclick=()=>{currentView=b.dataset.view;render();});
(async()=>{try{await ensureAnonymous();await loadConfig();render();}catch(e){console.error(e);$("#view").innerHTML='<div class="notice">Firebase 尚未就緒。請確認 firebase-config.js、已啟用匿名登入、Firestore／Storage 與 Rules 設定。</div>';}})();
'''
new_tail = '''$("#adminOpen").onclick=()=>$("#adminModal").classList.remove("hidden");
$("#adminClose").onclick=()=>$("#adminModal").classList.add("hidden");
$$(".tab").forEach(b=>b.onclick=()=>{currentView=b.dataset.view;render();});
render();
(async()=>{
 const problems=[];
 try {
  const [a,u,f,s,c]=await Promise.all([
   import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
   import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"),
   import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"),
   import("https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js"),
   import("./firebase-config.js")
  ]);
  ({initializeApp}=a);
  ({getAuth,signInAnonymously,signInWithEmailAndPassword,signOut}=u);
  ({getFirestore,collection,doc,getDoc,getDocs,setDoc,addDoc,updateDoc,deleteDoc,query,where,orderBy,serverTimestamp,runTransaction}=f);
  ({getStorage,ref,uploadBytes,getDownloadURL,deleteObject}=s);
  ({firebaseConfig}=c);
  app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);storage=getStorage(app);
  try { await loadConfig(); } catch(e) { console.error(e); problems.push("無法讀取 Firestore，請確認資料庫和讀取規則。"); }
  render();
  try { await ensureAnonymous(); } catch(e) { console.error(e); problems.push("請在 Firebase Authentication 啟用 Anonymous 登入，否則無法送出或查詢申請。"); }
  render();
 } catch(e) {
  console.error("Firebase modules/config failed",e);
  problems.push("Firebase 模組或設定載入失敗；請確認網路與 firebase-config.js。");
 }
 if(problems.length){const n=document.createElement("div");n.className="notice";n.textContent=problems.join("\\n");$("#view").prepend(n);}
})();
'''
