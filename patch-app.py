from pathlib import Path
import sys

p = Path(sys.argv[1] if len(sys.argv) > 1 else "app.js")
s = p.read_text(encoding="utf-8")

old_import = 'import { getAuth, signInAnonymously, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";'
new_import = 'import { getAuth, signInAnonymously, signInWithCustomToken, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";'
if old_import not in s:
    raise SystemExit("Cannot find expected Firebase Auth import in app source.")
s = s.replace(old_import, new_import, 1)

start = s.find('$("#loginBtn").onclick=async()=>{')
end = s.find('\nasync function showAdmin()', start)
if start < 0 or end < 0:
    raise SystemExit("Cannot find expected admin login handler in app source.")

login = r'''$("#loginBtn").onclick=async()=>{
  const username=$("#adminEmail").value.trim(), password=$("#adminPassword").value, button=$("#loginBtn"), original=button.textContent;
  if(!username||!password){feedback("loginError","請輸入管理員帳號與密碼。",true);return;}
  button.disabled=true;button.textContent="驗證中…";
  try{
    const response=await fetch("https://asia-east1-csu-order-system-af6bb.cloudfunctions.net/adminLogin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok||!result.token)throw Error(result.message||"帳號或密碼錯誤，或後端登入功能尚未部署。");
    const c=await signInWithCustomToken(auth,result.token);
    currentUser=adminUser=c.user;await showAdmin();feedback("loginError","");
  }catch(e){feedback("loginError",e.message||"登入失敗。",true);}
  finally{button.disabled=false;button.textContent=original;}
};'''
s = s[:start] + login + s[end:]
p.write_text(s, encoding="utf-8")
