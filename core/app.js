let STORE=null; // set per-user after login
const _DATA_PREFIX='lews_tracker_v82_data_';
function dataKey(u){return _DATA_PREFIX+u}

// ── Local-only storage mode ─────────────────────────────────────────────────
// Local-only removed: all account data is saved locally in this browser via localStorage.
const TZ=[['Doha, Qatar','Asia/Qatar'],['Manila, Philippines','Asia/Manila'],['Dubai, UAE','Asia/Dubai'],['Riyadh, Saudi Arabia','Asia/Riyadh'],['UTC / GMT','UTC'],['London, UK','Europe/London'],['Paris, France','Europe/Paris'],['New York, USA','America/New_York'],['Los Angeles, USA','America/Los_Angeles'],['Toronto, Canada','America/Toronto'],['Tokyo, Japan','Asia/Tokyo'],['Singapore','Asia/Singapore'],['Hong Kong','Asia/Hong_Kong'],['Sydney, Australia','Australia/Sydney'],['Auckland, NZ','Pacific/Auckland']];
const CURRENCIES={USD:'$',EUR:'€',GBP:'£',AUD:'A$',QAR:'QR ',AED:'AED ',PHP:'₱',SGD:'S$',JPY:'¥',CAD:'C$'};
const defaultTemplates={'Model Review':['Confirm latest model version','Check coordinates / levels / grids','Review linked models','Run clash / QA check','Export issue screenshots','Update comments and status'],'Shop Drawing Check':['Confirm latest drawing revision','Check title block and references','Review dimensions and levels','Compare against model / specs','Mark comments','Prepare response or submission'],'Clash Coordination':['Load latest discipline models','Run clash test','Group issues by zone/system','Assign owner','Export screenshots/report','Follow up blockers'],'RFI Preparation':['Define question clearly','Attach screenshots/drawings','Reference grid/level/location','Propose recommendation','Assign recipient','Track response']};
const DEF={tasks:[],notes:[],budgets:[],trash:[],templates:defaultTemplates,settings:{theme:'dark',scale:1,tabScale:1,financeScale:1,compact:false,glass:false,reduceMotion:false,autoTheme:false,accent:'#d8b76d',accent2:'#ff9655',radius:22,focusDefault:45,introAlways:false,backupHint:true,defaultView:'dashboard',font:'Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif',mode:'list',sort:'dueAsc',world:['Asia/Qatar','Asia/Manila'],financePass:'',financeUnlocked:true,petEnabled:true,petMode:'gamepad',petScale:1,petOpacity:1,petAutoShow:false,clockStyle:0,petX:null,petY:null},openBudget:null};
let data=null,selected=dateKey(new Date()),current=new Date(),openTaskId=null,timer=null,remaining=45*60,timerTotal=45*60,worldSlot=0;
let activeTimerTask=null,activeTimerStart=null,undoTimeout=null;
const views={dashboard:['Dashboard','Your day at a glance — KPIs, activity, today’s tasks.'],focus:['Focus','Ring timer. Tap time for fullscreen 3D screensaver.'],tasks:['To Do List','Priority stripes, subtask progress, time log, recurring, undo.'],templates:['Templates','BIM task templates.'],insights:['Insights','Workload health and action signals.'],calendar:['Calendar','Task calendar view.'],notes:['Notes','Decision logs and notes.'],finance:['Finance','Currency-aware budgets with paid tracking.'],settings:['Settings','Theme, projects, skills, backup, account.']};
const icons={dashboard:'⌂',focus:'◎',tasks:'□',templates:'▧',insights:'◬',calendar:'◇',notes:'✎',finance:'◈',settings:'⚙'};
// Skill tabs (QA/QC, Register, TIDP, Delegation …) are added from the SKILL LIST in index.html
if(window.LT&&LT.injectViews)LT.injectViews(views,icons);
const MOBILE_MAIN=['dashboard','tasks','focus','calendar'];

function load(){try{let x=Object.assign(structuredClone(DEF),JSON.parse(localStorage.getItem(STORE)||'{}'));x.templates=x.templates||structuredClone(defaultTemplates);x.settings=Object.assign(structuredClone(DEF.settings),x.settings||{});x.trash=x.trash||[];return x}catch{return structuredClone(DEF)}}
function save(){
  // Browser storage is now a lightweight working cache.
  if(STORE&&data)localStorage.setItem(STORE,JSON.stringify(lightweightDataCopy(data)));
  try{stats();storage();}catch(e){console.warn('post-save UI refresh skipped:',e);}
  scheduleFolderSave();
}
function dateKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function today(){return dateKey(new Date())}
function esc(s){return String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
function uid(){return Date.now()+Math.floor(Math.random()*1e6)}
function moneyFmt(n,curr){const sym=CURRENCIES[curr]||curr+' ';return sym+Number(n||0).toLocaleString(undefined,{maximumFractionDigits:0})}
function ensure(t){t.files=t.files||[];t.tags=t.tags||[];t.refs=t.refs||'';t.status=t.status||'todo';if(t.status==='new')t.status='todo';if(t.status==='inprogress')t.status='progress';t.priority=t.priority||'medium';t.checklist=t.checklist||[];t.checklist.forEach(c=>{if(c.done===undefined)c.done=false;if(c.state===undefined)c.state=c.done?'done':'todo';if(c.note===undefined)c.note='';if(c.due===undefined)c.due='';if(c.who===undefined)c.who='';if(c.section===undefined)c.section='';if(c.colour===undefined)c.colour='';if(c.doneAt===undefined)c.doneAt='';if(c.file===undefined)c.file=null;});t.checkCollapsed=t.checkCollapsed||false;t.source=t.source||'task';t.createdAt=t.createdAt||Date.now();t.timeLog=t.timeLog||[];t.recurring=t.recurring||'none';return t}

// ── Folder-primary storage: one folder per task + external attachments ───────
// Browser storage is only a lightweight cache. The selected folder stores:
// - lews-tracker-data.json
// - tasks/<task name>/task-details.txt
// - tasks/<task name>/<attached files>
let trackerDirHandle = null;
let trackerFolderSaveTimer = null;
const TRACKER_FOLDER_DB = 'lews_tracker_folder_db';
const TRACKER_FOLDER_STORE = 'handles';
const TRACKER_FOLDER_KEY = 'tracker-folder';
const TRACKER_FOLDER_FILENAME = 'lews-tracker-data.json';
const TAB_FOLDERS={dashboard:'Dashboard',tasks:'To Do List',templates:'Templates',insights:'Insights',calendar:'Calendar',notes:'Notes',finance:'Finance',focus:'Focus',settings:'Settings'};
const TRACKER_TASKS_DIR = TAB_FOLDERS.tasks;
const TASK_DETAILS_FILENAME = 'task-details.txt';

function setFolderSaveStatus(msg){const el=document.getElementById('folderSaveStatus');if(el)el.textContent=msg;}
function supportsFolderSave(){return 'showDirectoryPicker' in window && 'indexedDB' in window;}
function safeFileName(name){return String(name||'Untitled Task').replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,' ').trim().slice(0,120)||'Untitled Task';}
function dataUrlToBlob(dataUrl){const parts=String(dataUrl||'').split(',');const meta=parts[0]||'';const b64=parts[1]||'';const type=(meta.match(/data:([^;]+)/)||[])[1]||'application/octet-stream';const bin=atob(b64);const arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);return new Blob([arr],{type});}
function openFolderDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(TRACKER_FOLDER_DB,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(TRACKER_FOLDER_STORE))db.createObjectStore(TRACKER_FOLDER_STORE);};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function saveFolderHandle(handle){const db=await openFolderDb();return new Promise((resolve,reject)=>{const tx=db.transaction(TRACKER_FOLDER_STORE,'readwrite');tx.objectStore(TRACKER_FOLDER_STORE).put(handle,TRACKER_FOLDER_KEY);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
async function getSavedFolderHandle(){const db=await openFolderDb();return new Promise((resolve,reject)=>{const tx=db.transaction(TRACKER_FOLDER_STORE,'readonly');const req=tx.objectStore(TRACKER_FOLDER_STORE).get(TRACKER_FOLDER_KEY);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});}
async function verifyFolderPermission(handle,requestWrite){if(!handle)return false;const opts={mode:'readwrite'};if((await handle.queryPermission(opts))==='granted')return true;if(requestWrite&&(await handle.requestPermission(opts))==='granted')return true;return false;}
function lightweightDataCopy(src){const copy=structuredClone(src||{});(copy.tasks||[]).forEach(t=>(t.files||[]).forEach(f=>{if(f.external||f.folderFileName)delete f.data;}));return copy;}
function fullDataCopyForFolder(src){const copy=structuredClone(src||{});(copy.tasks||[]).forEach(t=>(t.files||[]).forEach(f=>{if(f.external||f.folderFileName)delete f.data;}));return copy;}
function taskFolderName(t){return safeFileName((t&&t.title)||'Untitled Task');}
async function getTasksRoot(create){if(!trackerDirHandle)return null;return await trackerDirHandle.getDirectoryHandle(TRACKER_TASKS_DIR,{create:!!create});}
async function getTaskFolder(t,create){const root=await getTasksRoot(create);if(!root)return null;const name=taskFolderName(t);return await root.getDirectoryHandle(name,{create:!!create});}
function taskDetailsText(t){t=ensure(t);const files=(t.files||[]).map(f=>'- '+(f.name||f.folderFileName||'file')+(f.size?' ('+bytesFmt(f.size)+')':'')).join('\n')||'- No files';const checks=(t.checklist||[]).map(c=>(c.done?'[x] ':'[ ] ')+c.text).join('\n')||'- No checklist';return [
"Lew's Tracker - Task Details",
'Generated: '+new Date().toLocaleString(),
'',
'Tab Folder: '+TAB_FOLDERS.tasks,
'Task Folder: '+taskFolderName(t),
'Title: '+(t.title||''),
'Status: '+statusName(t.status),
'Priority: '+(t.priority||''),
'Due: '+(t.due||''),
'Recurring: '+(t.recurring||'none'),
'Tags: '+((t.tags||[]).join(', ')||'-'),
'Time Logged: '+fmtSecs(totalSecs(t)),
'',
'Description / Details / References:',
(t.refs||'-'),
'',
'Checklist:',
checks,
'',
'Files:',
files,
''
].join('\n');}
async function writeTaskDetailsFile(t){if(!trackerDirHandle||!t)return;const folder=await getTaskFolder(t,true);const fh=await folder.getFileHandle(TASK_DETAILS_FILENAME,{create:true});const writable=await fh.createWritable();await writable.write(taskDetailsText(t));await writable.close();t.taskFolder=taskFolderName(t);}
async function writeAllTaskDetails(){if(!trackerDirHandle||!data)return;for(const t of data.tasks||[])await writeTaskDetailsFile(t);}
async function getTabFolder(tabKey,create){if(!trackerDirHandle)return null;const folderName=TAB_FOLDERS[tabKey]||safeFileName(tabKey);return await trackerDirHandle.getDirectoryHandle(folderName,{create:!!create});}
async function writeTextFile(folder,fileName,content){if(!folder)return;const fh=await folder.getFileHandle(safeFileName(fileName),{create:true});const writable=await fh.createWritable();await writable.write(String(content||''));await writable.close();}
async function writeJsonFile(folder,fileName,obj){await writeTextFile(folder,fileName,JSON.stringify(obj,null,2));}
function dashboardSummaryText(){const tasks=(data.tasks||[]).map(ensure);const open=tasks.filter(t=>t.status!=='done').length;const done=tasks.filter(t=>t.status==='done').length;const overdue=tasks.filter(t=>t.status!=='done'&&t.due&&t.due<today()).length;const todayCnt=tasks.filter(t=>t.status!=='done'&&t.due===today()).length;return ["Lew's Tracker - Dashboard Summary",'Generated: '+new Date().toLocaleString(),'','Open To Do: '+open,'Done: '+done,'Overdue: '+overdue,'Today: '+todayCnt,'Notes: '+(data.notes||[]).length,'Budgets: '+(data.budgets||[]).length].join('\n');}
function insightsSummaryText(){const tasks=(data.tasks||[]).map(ensure);const open=tasks.filter(t=>t.status!=='done').length;const high=tasks.filter(t=>t.status!=='done'&&t.priority==='high').length;const overdue=tasks.filter(t=>t.status!=='done'&&t.due&&t.due<today()).length;const totalTime=tasks.reduce((a,t)=>a+totalSecs(t),0);return ["Lew's Tracker - Insights",'Generated: '+new Date().toLocaleString(),'','Open items: '+open,'High priority open: '+high,'Overdue: '+overdue,'Total logged time: '+fmtSecs(totalTime),'','Top open tasks:',...(tasks.filter(t=>t.status!=='done').slice(0,15).map(t=>'- '+t.title+' | '+t.priority+' | '+(t.due||'No due date')))].join('\n');}
function calendarSummaryText(){const tasks=(data.tasks||[]).map(ensure).filter(t=>t.due).sort((a,b)=>(a.due||'').localeCompare(b.due||''));return ["Lew's Tracker - Calendar",'Generated: '+new Date().toLocaleString(),'',...tasks.map(t=>'- '+t.due+' | '+statusName(t.status)+' | '+t.title)].join('\n');}
function focusSummaryText(){const tasks=(data.tasks||[]).map(ensure);const logged=tasks.filter(t=>totalSecs(t)>0).sort((a,b)=>totalSecs(b)-totalSecs(a));return ["Lew's Tracker - Focus",'Generated: '+new Date().toLocaleString(),'','Default focus minutes: '+((data.settings&&data.settings.focusDefault)||45),'','Time logged by task:',...(logged.length?logged.map(t=>'- '+t.title+' | '+fmtSecs(totalSecs(t))):['- No logged time yet'])].join('\n');}
function noteText(n){const linked=(data.tasks||[]).find(t=>t.id===n.taskId);return ["Lew's Tracker - Note",'Generated: '+new Date().toLocaleString(),'','Title: '+(n.title||'Untitled'),'Created: '+(n.created||''),'Linked Task: '+(linked?linked.title:'-'),'','Body:',n.body||''].join('\n');}
function templateText(name,lines){return ["Lew's Tracker - Template",'Generated: '+new Date().toLocaleString(),'','Template: '+name,'','Checklist Lines:',...(lines||[]).map(x=>'- '+x)].join('\n');}
function budgetText(b){const t=totals(b);return ["Lew's Tracker - Finance Budget",'Generated: '+new Date().toLocaleString(),'','Budget: '+(b.name||'Budget'),'Type: '+(b.type||''),'Currency: '+(b.currency||''),'Income: '+moneyFmt(t.inc,b.currency),'Expense: '+moneyFmt(t.exp,b.currency),'Balance: '+moneyFmt(t.bal,b.currency),'Paid: '+moneyFmt(t.paid,b.currency),'Pending: '+moneyFmt(t.unpaid,b.currency),'','Categories:',...(b.categories||[]).map(c=>'- '+c.name+' | '+c.type+' | '+moneyFmt(c.amount,b.currency)+' | '+(c.paid?'Paid':'Pending'))].join('\n');}
async function writeTabFolderFiles(){
  if(!trackerDirHandle||!data)return;
  // Create all main tab folders first.
  const dashboardFolder=await getTabFolder('dashboard',true);
  const tasksFolder=await getTabFolder('tasks',true);
  const templatesFolder=await getTabFolder('templates',true);
  const insightsFolder=await getTabFolder('insights',true);
  const calendarFolder=await getTabFolder('calendar',true);
  const notesFolder=await getTabFolder('notes',true);
  const financeFolder=await getTabFolder('finance',true);
  const focusFolder=await getTabFolder('focus',true);
  const settingsFolder=await getTabFolder('settings',true);

  await writeTextFile(dashboardFolder,'dashboard-summary.txt',dashboardSummaryText());
  await writeJsonFile(dashboardFolder,'dashboard-data.json',{tasks:(data.tasks||[]).length,notes:(data.notes||[]).length,budgets:(data.budgets||[]).length,generatedAt:new Date().toISOString()});

  // To Do List tab: one folder per task, using task name.
  await writeAllTaskDetails();
  await writeJsonFile(tasksFolder,'to-do-list.json',(data.tasks||[]).map(ensure));

  await writeJsonFile(templatesFolder,'templates.json',data.templates||{});
  for(const [name,lines] of Object.entries(data.templates||{}))await writeTextFile(templatesFolder,safeFileName(name)+'.txt',templateText(name,lines));

  await writeTextFile(insightsFolder,'insights-summary.txt',insightsSummaryText());
  await writeJsonFile(insightsFolder,'insights-data.json',{generatedAt:new Date().toISOString(),tasks:(data.tasks||[]).map(ensure)});

  await writeTextFile(calendarFolder,'calendar-tasks.txt',calendarSummaryText());
  await writeJsonFile(calendarFolder,'calendar-tasks.json',(data.tasks||[]).map(ensure).filter(t=>t.due));

  await writeJsonFile(notesFolder,'notes.json',data.notes||[]);
  for(const n of (data.notes||[]))await writeTextFile(notesFolder,safeFileName((n.title||'Untitled Note')+'-'+n.id)+'.txt',noteText(n));

  await writeJsonFile(financeFolder,'finance.json',data.budgets||[]);
  for(const b of (data.budgets||[])){const bf=await financeFolder.getDirectoryHandle(safeFileName((b.name||'Budget')+'-'+b.id),{create:true});await writeTextFile(bf,'budget-details.txt',budgetText(b));}

  await writeTextFile(focusFolder,'focus-summary.txt',focusSummaryText());
  await writeJsonFile(settingsFolder,'settings.json',data.settings||{});
}

async function persistBlobToTaskFolder(blob,name,type,size,task){if(!trackerDirHandle||!task)return null;const ok=await verifyFolderPermission(trackerDirHandle,true);if(!ok)return null;const folder=await getTaskFolder(task,true);const fileName=safeFileName(name||'attachment');let finalName=fileName;try{await folder.getFileHandle(finalName,{create:false});finalName=Date.now()+'-'+Math.floor(Math.random()*1e6)+'-'+fileName;}catch(_){/* filename is free */}const fh=await folder.getFileHandle(finalName,{create:true});const writable=await fh.createWritable();await writable.write(blob);await writable.close();task.taskFolder=taskFolderName(task);return{folderFileName:finalName,taskFolder:task.taskFolder,external:true,type:type||blob.type||'application/octet-stream',size:size||blob.size||0};}
async function persistFileToTaskFolder(file,task){const meta=await persistBlobToTaskFolder(file,file.name,file.type,file.size,task);if(!meta)return null;return{id:uid(),name:file.name,type:meta.type,size:meta.size,added:new Date().toISOString(),folderFileName:meta.folderFileName,taskFolder:meta.taskFolder,external:true};}
async function migrateEmbeddedFilesToTaskFolders(){if(!trackerDirHandle||!data)return 0;let count=0;for(const t of data.tasks||[]){for(const f of t.files||[]){if(f.data&&!f.folderFileName){const blob=dataUrlToBlob(f.data);const meta=await persistBlobToTaskFolder(blob,f.name,f.type,f.size,t);if(meta){f.folderFileName=meta.folderFileName;f.taskFolder=meta.taskFolder;f.external=true;f.type=f.type||meta.type;f.size=f.size||meta.size;delete f.data;count++;}}}await writeTaskDetailsFile(t);}return count;}
function trackerBackupPayload(){return{app:"Lew's Tracker",format:'folder-primary-tab-folders',version:'v8.10-tab-folder-storage',savedAt:new Date().toISOString(),user:typeof currentUser!=='undefined'&&currentUser?currentUser:'local',data:fullDataCopyForFolder(data)};}
async function chooseSaveFolder(){if(!supportsFolderSave()){alert('Folder storage is not supported in this browser. Please use Chrome or Edge on your HTTPS/GitHub Pages site.');setFolderSaveStatus('Folder storage unavailable in this browser');return;}try{trackerDirHandle=await window.showDirectoryPicker({mode:'readwrite'});const ok=await verifyFolderPermission(trackerDirHandle,true);if(!ok){setFolderSaveStatus('Folder permission denied');return;}await saveFolderHandle(trackerDirHandle);setFolderSaveStatus('Folder selected ✓');let loaded=false;try{const fh=await trackerDirHandle.getFileHandle(TRACKER_FOLDER_FILENAME,{create:false});if(fh&&confirm('A tracker data file already exists in this folder. Load it now?'))loaded=await loadFromSelectedFolder(false);}catch(_){ }if(!loaded){const migrated=await migrateEmbeddedFilesToTaskFolders();await saveToSelectedFolder(true);if(migrated)toastMsg('Moved '+migrated+' attachment(s) into task folders ✓');}}catch(err){if(err&&err.name==='AbortError')return;console.error('Folder selection failed:',err);setFolderSaveStatus('Folder selection failed');alert('Folder selection failed. Check the browser console for details.');}}
async function restoreSaveFolder(){if(!supportsFolderSave()){setFolderSaveStatus('Folder storage unavailable in this browser');return;}try{const handle=await getSavedFolderHandle();if(!handle){setFolderSaveStatus('No folder selected — using browser cache only');return;}trackerDirHandle=handle;const ok=await verifyFolderPermission(trackerDirHandle,false);setFolderSaveStatus(ok?'Folder ready ✓':'Folder permission needed — click Save Now or Select Storage Folder');}catch(err){console.warn('Could not restore folder access:',err);setFolderSaveStatus('No folder selected — using browser cache only');}}
async function saveToSelectedFolder(manual){if(!trackerDirHandle){if(manual)alert('Please select a storage folder first.');setFolderSaveStatus('No folder selected — using browser cache only');return false;}try{const ok=await verifyFolderPermission(trackerDirHandle,!!manual);if(!ok){setFolderSaveStatus('Folder permission needed — click Save Now');if(manual)alert('Permission is required before saving to the selected folder.');return false;}await migrateEmbeddedFilesToTaskFolders();await writeTabFolderFiles();const fileHandle=await trackerDirHandle.getFileHandle(TRACKER_FOLDER_FILENAME,{create:true});const writable=await fileHandle.createWritable();await writable.write(JSON.stringify(trackerBackupPayload(),null,2));await writable.close();if(STORE&&data)localStorage.setItem(STORE,JSON.stringify(lightweightDataCopy(data)));const stamp=new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});setFolderSaveStatus('Saved to folder ✓ '+stamp+' — tab folders updated');if(manual)toastMsg('Saved tab folders ✓');return true;}catch(err){console.error('Folder save failed:',err);setFolderSaveStatus('Folder save failed');if(manual)alert('Folder save failed. Check the browser console for details.');return false;}}
async function loadFromSelectedFolder(manual){if(!trackerDirHandle){if(manual)alert('Please select a storage folder first.');return false;}try{const ok=await verifyFolderPermission(trackerDirHandle,!!manual);if(!ok){setFolderSaveStatus('Folder permission needed — click Load From Folder');return false;}const fh=await trackerDirHandle.getFileHandle(TRACKER_FOLDER_FILENAME,{create:false});const file=await fh.getFile();const json=JSON.parse(await file.text());const incoming=json.data||json;data=Object.assign(structuredClone(DEF),incoming);data.templates=data.templates||structuredClone(defaultTemplates);data.settings=Object.assign(structuredClone(DEF.settings),data.settings||{});data.trash=data.trash||[];if(STORE)localStorage.setItem(STORE,JSON.stringify(lightweightDataCopy(data)));applySettings();renderAll();const stamp=new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});setFolderSaveStatus('Loaded from folder ✓ '+stamp);if(manual)toastMsg('Loaded from selected folder ✓');return true;}catch(err){console.error('Folder load failed:',err);setFolderSaveStatus('Could not load folder data');if(manual)alert('Could not load lews-tracker-data.json from the selected folder.');return false;}}
function scheduleFolderSave(){if(!trackerDirHandle)return;clearTimeout(trackerFolderSaveTimer);trackerFolderSaveTimer=setTimeout(()=>saveToSelectedFolder(false),900);}

// ── Task reference files ─────────────────────────────────────────────────────
function bytesFmt(bytes){bytes=Number(bytes||0);if(bytes<1024)return bytes+' B';if(bytes<1024*1024)return(bytes/1024).toFixed(1)+' KB';return(bytes/1024/1024).toFixed(1)+' MB';}
function taskFileIcon(type,name){const n=(name||'').toLowerCase(),t=(type||'').toLowerCase();if(t.includes('image')||/\.(png|jpg|jpeg|gif|webp|svg)$/.test(n))return'🖼';if(t.includes('pdf')||n.endsWith('.pdf'))return'📄';if(/\.(doc|docx)$/.test(n))return'📝';if(/\.(xls|xlsx|csv)$/.test(n))return'📊';if(/\.(dwg|dxf|rvt|ifc|nwc|nwd|skp)$/.test(n))return'🏗';if(/\.(zip|rar|7z)$/.test(n))return'🗜';return'📎';}
function readFilesAsDataUrls(fileList,task){
  const files=Array.from(fileList||[]);
  return Promise.all(files.map(f=>new Promise(async (resolve,reject)=>{
    try{
      if(trackerDirHandle&&task){
        const external=await persistFileToTaskFolder(f,task);
        if(external){resolve(external);return;}
      }
      const r=new FileReader();
      r.onload=()=>resolve({id:uid(),name:f.name,type:f.type||'application/octet-stream',size:f.size||0,added:new Date().toISOString(),data:r.result});
      r.onerror=()=>reject(r.error||new Error('Could not read file'));
      r.readAsDataURL(f);
    }catch(err){reject(err);}
  })));
}
function renderTaskFiles(t){t=ensure(t);const files=t.files||[];return`<div class="task-files" style="display:grid;gap:6px"><div class="row" style="justify-content:space-between;align-items:center"><b class="small">Reference files (${files.length})</b><label class="btn" style="margin:0">+ Attach<input type="file" multiple hidden onchange="addFilesToTask(${t.id},this.files);this.value=''" /></label></div>`+(files.length?files.map(f=>`<div class="item" style="padding:6px 8px;border-left-width:1px"><div style="min-width:0"><span style="margin-right:6px">${taskFileIcon(f.type,f.name)}</span><b class="small" title="${esc(f.name)}">${esc(f.name)}</b><div class="small">${bytesFmt(f.size)} · ${f.added?new Date(f.added).toLocaleDateString():''}</div></div><div class="row" style="gap:4px"><button class="icon" title="Download" onclick="downloadTaskFile(${t.id},${f.id})">⬇</button><button class="icon danger" title="Remove" onclick="deleteTaskFile(${t.id},${f.id})">×</button></div></div>`).join(''):`<div class="empty" style="padding:8px;font-size:.72rem">No reference files attached.</div>`)+`</div>`;}
function renderTaskModalFiles(t){const el=document.getElementById('taskExistingFiles');if(!el)return;if(!t){el.innerHTML='<div class="empty" style="padding:8px;font-size:.72rem">Attach files after choosing them below.</div>';return;}el.innerHTML=renderTaskFiles(t);}
async function addFilesToTask(tid,fileList){const t=ensure(data.tasks.find(x=>x.id===tid));if(!t)return;const incoming=await readFilesAsDataUrls(fileList,t);if(!incoming.length)return;t.files=t.files||[];t.files.push(...incoming);save();renderTasks();toastMsg(incoming.length+' file(s) attached');}
async function downloadTaskFile(tid,fid){
  const t=ensure(data.tasks.find(x=>x.id===tid));
  const f=(t.files||[]).find(x=>x.id===fid);
  if(!f){toastMsg('File not found');return;}
  try{
    if(f.external&&f.folderFileName){
      if(!trackerDirHandle){toastMsg('Select the storage folder first');return;}
      const ok=await verifyFolderPermission(trackerDirHandle,true);
      if(!ok){toastMsg('Folder permission needed');return;}
      const folder=await getTaskFolder(t,false);
      const fh=await folder.getFileHandle(f.folderFileName,{create:false});
      const file=await fh.getFile();
      const url=URL.createObjectURL(file);
      const a=document.createElement('a');a.href=url;a.download=f.name||f.folderFileName;a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      return;
    }
    if(f.data){const a=document.createElement('a');a.href=f.data;a.download=f.name||'task-file';a.click();return;}
  }catch(err){console.error('Download failed:',err);}
  toastMsg('File not available. Select the original storage folder.');
}
function deleteTaskFile(tid,fid){const t=ensure(data.tasks.find(x=>x.id===tid));const f=(t.files||[]).find(x=>x.id===fid);t.files=(t.files||[]).filter(x=>x.id!==fid);if(f&&f.external&&f.folderFileName&&trackerDirHandle){getTaskFolder(t,false).then(dir=>dir.removeEntry(f.folderFileName).catch(()=>{})).catch(()=>{});}save();renderTasks();toastUndo('File removed',()=>{t.files=t.files||[];if(f)t.files.push(f);save();renderTasks();});}


// ── Toast ─────────────────────────────────────────────────────────────────────
function toastMsg(m,dur=2400){let d=document.createElement('div');d.innerHTML='<span>'+m+'</span>';toast.prepend(d);setTimeout(()=>{d.style.animation='toastOut .25s ease forwards';setTimeout(()=>d.remove(),260)},dur)}
function toastUndo(msg,onUndo){if(undoTimeout)clearTimeout(undoTimeout);let d=document.createElement('div');d.style.justifyContent='space-between';d.innerHTML='<span>'+msg+'</span><button class="btn" style="padding:3px 9px;font-size:.65rem;min-height:unset" onclick="this.closest(\'div\').remove();_doUndo()">Undo</button>';window._doUndo=()=>{if(onUndo){onUndo();window._doUndo=null;}};toast.prepend(d);undoTimeout=setTimeout(()=>{if(d.isConnected){d.style.animation='toastOut .25s ease forwards';setTimeout(()=>d.remove(),260);}window._doUndo=null;},5000)}

// ── DOM element references ────────────────────────────────────────────────────
const intro=document.getElementById('intro');
const toast=document.getElementById('toast');
const nav=document.getElementById('nav');
const mobileNav=document.getElementById('mobileNav');
const pageTitle=document.getElementById('pageTitle');
const pageSub=document.getElementById('pageSub');
const navIndicator=document.getElementById('navIndicator');
const quickInput=document.getElementById('quickInput');
const quickModalInput=document.getElementById('quickModalInput');
const globalSearchInput=document.getElementById('globalSearchInput');
// Tasks
const taskArea=document.getElementById('taskArea');
const taskSearch=document.getElementById('taskSearch');
const taskFilter=document.getElementById('taskFilter');
const taskSort=document.getElementById('taskSort');
const modeBtn=document.getElementById('modeBtn');
// Task modal
const taskId=document.getElementById('taskId');
const taskTitle=document.getElementById('taskTitle');
const taskPriority=document.getElementById('taskPriority');
const taskStatus=document.getElementById('taskStatus');
const taskDue=document.getElementById('taskDue');
const taskTags=document.getElementById('taskTags');
const taskRefs=document.getElementById('taskRefs');
const taskRecurring=document.getElementById('taskRecurring');
// Templates
const templateArea=document.getElementById('templateArea');
const templateName=document.getElementById('templateName');
const templateLines=document.getElementById('templateLines');
const templateId=document.getElementById('templateId');
// Notes
const noteList=document.getElementById('noteList');
const noteSearch=document.getElementById('noteSearch');
const noteTitle=document.getElementById('noteTitle');
const noteBody=document.getElementById('noteBody');
const noteId=document.getElementById('noteId');
const noteTask=document.getElementById('noteTask');
// Finance
const budgetList=document.getElementById('budgetList');
const financeLock=document.getElementById('financeLock');
// Calendar
const calendarGrid=document.getElementById('calendarGrid');
const monthLabel=document.getElementById('monthLabel');
const selectedTitle=document.getElementById('selectedTitle');
const dayList=document.getElementById('dayList');
// Focus
const focusTop=document.getElementById('focusTop');
// Insights
const insightHero=document.getElementById('insightHero');
const insightCards=document.getElementById('insightCards');
const duePressure=document.getElementById('duePressure');
const nextAction=document.getElementById('nextAction');
// Dashboard
const dashStats=document.getElementById('dashStats');
const dashCommand=document.getElementById('dashCommand');
// KPIs
const kOpen=document.getElementById('kOpen');
const kOverdue=document.getElementById('kOverdue');
const kToday=document.getElementById('kToday');
const kPendingPay=document.getElementById('kPendingPay');
const todayTxt=document.getElementById('todayTxt');
// Storage
const storageBar=document.getElementById('storageBar');
const storageTxt=document.getElementById('storageTxt');
// Settings inputs
const fontRange=document.getElementById('fontRange');
const fontLabel=document.getElementById('fontLabel');
const tabScaleRange=document.getElementById('tabScaleRange');
const tabScaleLabel=document.getElementById('tabScaleLabel');
const financeScaleRange=document.getElementById('financeScaleRange');
const financeScaleLabel=document.getElementById('financeScaleLabel');
const fontSelect=document.getElementById('fontSelect');
const accentSelect=document.getElementById('accentSelect');
const accentPicker=document.getElementById('accentPicker');
const radiusRange=document.getElementById('radiusRange');
const compactToggle=document.getElementById('compactToggle');
const glassToggle=document.getElementById('glassToggle');
const autoThemeToggle=document.getElementById('autoThemeToggle');
const reduceMotionToggle=document.getElementById('reduceMotionToggle');
const introToggle=document.getElementById('introToggle');
const autoBackupHint=document.getElementById('autoBackupHint');
const defaultView=document.getElementById('defaultView');
const focusDefault=document.getElementById('focusDefault');
const brandTitleInput=document.getElementById('brandTitleInput');
const brandSubInput=document.getElementById('brandSubInput');
const brandLogoInput=document.getElementById('brandLogoInput');
const financePassInput=document.getElementById('financePassInput');
const noteModalTitle=document.getElementById('noteModalTitle');
const taskModalTitle=document.getElementById('taskModalTitle');
// Robust DOM references — required because not all browsers reliably expose id="..." as global variables
const $id=(id)=>document.getElementById(id);
const eventInput=$id('eventInput');
const taskFiles=$id('taskFiles');
const taskExistingFiles=$id('taskExistingFiles');
const templateList=$id('templateList');
const templateTitle=$id('templateTitle');
const budgetName=$id('budgetName');
const budgetType=$id('budgetType');
const budgetCurrency=$id('budgetCurrency');
const doneBar=$id('doneBar');
const timerTxt=$id('timerTxt');
const timerRing=$id('timerRing');
const localClock=$id('localClock');
const localGmt=$id('localGmt');
const worldCards=$id('worldCards');
const worldModalTitle=$id('worldModalTitle');
const worldZone=$id('worldZone');
const noteEditorTitle=$id('noteEditorTitle');
const bgStyleSelect=$id('bgStyleSelect');
const densitySelect=$id('densitySelect');
const animLevelSelect=$id('animLevelSelect');
const rowStyleSelect=$id('rowStyleSelect');
const iconStyleSelect=$id('iconStyleSelect');
const customCssBox=$id('customCssBox');
// Make file-input globals explicit for inline onclick handlers like importFile.click()
window.importFile=$id('importFile');
window.themeImportFile=$id('themeImportFile');


// ── Navigation ────────────────────────────────────────────────────────────────
function initNav(){
  const html=Object.keys(views).map(id=>`<button data-view="${id}" onclick="show('${id}')"><span class="navicon">${icons[id]}</span><span>${views[id][0]}</span></button>`).join('');
  nav.innerHTML='<div class="nav-indicator" id="navIndicator"></div>'+html;
  // Mobile: 4 main + More
  const mobileHtml=MOBILE_MAIN.map(id=>`<button data-view="${id}" onclick="show('${id}')"><span class="navicon">${icons[id]}</span><span>${views[id][0]}</span></button>`).join('')+`<button onclick="openModal('moreSheet')"><span class="navicon">⋯</span><span>More</span></button>`;
  mobileNav.innerHTML=mobileHtml;
}
// v8.5: Smooth page transitions
function show(id){
  const next=document.getElementById(id);
  if(!next)return;
  // Update nav highlights
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
  pageTitle.textContent=views[id][0];
  pageSub.textContent=views[id][1];
  const activeNav=nav.querySelector(`[data-view="${id}"]`);
  // the menu is rebuilt after login, so look the indicator up fresh (the old reference pointed at a removed element)
  const ind=document.getElementById('navIndicator');
  if(activeNav&&ind){ind.style.top=activeNav.offsetTop+'px';ind.style.height=activeNav.offsetHeight+'px';}
  // Switch views
  document.querySelectorAll('.view').forEach(v=>{v.classList.remove('active','exiting-view');v.style.display='';});
  next.classList.add('active');
  // Lazy-load embedded QA/QC + Register apps on first open
  var fr=next.querySelector('iframe[data-src]');
  if(fr&&!fr.getAttribute('src')){if(window.LTStore&&LTStore.openFrame)LTStore.openFrame(fr);else fr.src=fr.getAttribute('data-src');}
  renderAll();
  if(typeof updateCalcFab==='function')updateCalcFab(id);
}
function closeIntro(){intro.classList.add('hide');if(data){data.settings.introSeen=true;save();}}
function openCommand(){openModal('commandModal')}
function openModal(id){document.getElementById(id).classList.add('show')}
function closeModal(id){document.getElementById(id).classList.remove('show')}
function openQuick(){quickModalInput.value='';openModal('quickModal');setTimeout(()=>quickModalInput.focus(),80)}
function openSearch(){openModal('searchModal');setTimeout(()=>globalSearchInput.focus(),80);renderSearchResults('')}

// Escape key closes modals
document.addEventListener('keydown',e=>{
  if(e.key==='Escape')document.querySelectorAll('.modal.show').forEach(m=>m.classList.remove('show'));
  if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();openSearch();}
});

// ── Global search ─────────────────────────────────────────────────────────────
function renderSearchResults(q){
  const el=document.getElementById('searchResults');
  if(!el)return;
  if(!q.trim()){el.innerHTML='<div class="empty">Type to search tasks, notes, templates…</div>';return;}
  const lq=q.toLowerCase();
  const tasks=data.tasks.map(ensure).filter(t=>(t.title+' '+t.refs+' '+t.tags.join(' ')+' '+(t.files||[]).map(f=>f.name).join(' ')).toLowerCase().includes(lq)).slice(0,8);
  const notes=data.notes.filter(n=>(n.title+' '+n.body).toLowerCase().includes(lq)).slice(0,4);
  const tmpl=Object.keys(data.templates).filter(k=>k.toLowerCase().includes(lq)).slice(0,4);
  let html='';
  if(tasks.length)html+=`<div class="label" style="margin-bottom:6px">Tasks</div>`+tasks.map(t=>`<div class="search-result" onclick="show('tasks');openTaskId=${t.id};renderTasks();closeModal('searchModal')">${esc(t.title)}<span class="pill ${t.priority}" style="margin-left:auto">${t.priority}</span></div>`).join('');
  if(notes.length)html+=`<div class="label" style="margin:10px 0 6px">Notes</div>`+notes.map(n=>`<div class="search-result" onclick="editNote(${n.id});closeModal('searchModal')">${esc(n.title)}</div>`).join('');
  if(tmpl.length)html+=`<div class="label" style="margin:10px 0 6px">Templates</div>`+tmpl.map(k=>`<div class="search-result" onclick="useTemplate('${esc(k)}');closeModal('searchModal')">${esc(k)}</div>`).join('');
  el.innerHTML=html||'<div class="empty">No results found.</div>';
}
document.getElementById('globalSearchInput')?.addEventListener('input',function(){renderSearchResults(this.value)});

// ── Date helpers ──────────────────────────────────────────────────────────────
function smartDate(text){let d=new Date(),s=text.toLowerCase();if(s.includes('tomorrow'))d.setDate(d.getDate()+1);else{let days=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];let hit=days.findIndex(x=>s.includes(x));if(hit>=0){let diff=(hit-d.getDay()+7)%7||7;d.setDate(d.getDate()+diff)}let m=s.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);if(m)return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`}return dateKey(d)}
function cleanText(text){return text.replace(/\b20\d{2}-\d{1,2}-\d{1,2}\b/g,'').replace(/\b(today|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday|high|medium|low|due)\b/gi,'').replace(/#\w+/g,'').replace(/\s+/g,' ').trim()}

// ── Tasks ─────────────────────────────────────────────────────────────────────
function createTask(o){data.tasks.unshift(Object.assign({id:uid(),title:'Untitled',priority:'medium',status:'todo',due:today(),tags:[],refs:'',files:[],checklist:[],timeLog:[],recurring:'none',source:'task',created:today(),createdAt:Date.now()},o));save();renderAll();return data.tasks[0]}
function quickAdd(){let raw=quickInput.value.trim();if(!raw)return;let first=(raw.split(/\s+/)[0]||'task').toLowerCase(),body=raw.replace(/^\w+\s*/,'').trim(),tags=[...raw.matchAll(/#(\w+)/g)].map(x=>x[1]),pr=/\bhigh\b/i.test(raw)?'high':/\blow\b/i.test(raw)?'low':'medium';if(first==='template'){let name=Object.keys(data.templates).find(k=>body.toLowerCase().includes(k.toLowerCase().split(' ')[0])||body.toLowerCase().includes(k.toLowerCase()));let list=data.templates[name||Object.keys(data.templates)[0]];createTask({title:name||Object.keys(data.templates)[0],priority:pr,due:smartDate(raw),tags:[...new Set([...tags,'BIM'])],checklist:list.map(x=>({id:uid(),text:x,done:false})),refs:list.map(x=>'□ '+x).join('\n')});toastMsg('Template task added')}else if(first==='note'){data.notes.unshift({id:uid(),title:body.split(' ').slice(0,5).join(' ')||'Quick Note',body,taskId:null,created:new Date().toLocaleDateString(),updated:Date.now()});toastMsg('Note added')}else if(first==='event'){addCalendarTask(cleanText(body)||body,smartDate(raw))}else{if(first!=='task')body=raw;createTask({title:cleanText(body)||body,priority:pr,due:smartDate(raw),tags});toastMsg('Task added')}quickInput.value='';save();renderAll()}
quickInput?.addEventListener('keydown',e=>{if(e.key==='Enter')quickAdd()});

function openTask(id){let t=id?ensure(data.tasks.find(x=>x.id===id)):null;taskModalTitle.textContent=t?'Edit Task':'New Task';taskId.value=t?.id||'';taskTitle.value=t?.title||'';taskPriority.value=t?.priority||'medium';taskStatus.value=t?.status||'todo';taskDue.value=t?.due||today();taskTags.value=(t?.tags||[]).join(', ');taskRefs.value=t?.refs||'';taskRecurring.value=t?.recurring||'none';if(taskFiles)taskFiles.value='';renderTaskModalFiles(t);openModal('taskModal')}
async function saveTask(){let title=taskTitle.value.trim();if(!title)return;let obj={title,priority:taskPriority.value,status:taskStatus.value,due:taskDue.value,tags:taskTags.value.split(',').map(x=>x.trim()).filter(Boolean),refs:taskRefs.value,recurring:taskRecurring.value,created:today()};let t;if(taskId.value){t=ensure(data.tasks.find(x=>x.id==taskId.value));Object.assign(t,obj)}else{t=createTask(obj)}try{const picked=document.getElementById('taskFiles');const incoming=await readFilesAsDataUrls(picked?picked.files:[],t);if(incoming.length){t.files=t.files||[];t.files.push(...incoming);}}catch(e){toastMsg('File attach error: '+(e.message||e));}closeModal('taskModal');save();renderAll();toastMsg('Saved')}
function toggleOpen(id){openTaskId=openTaskId===id?null:id;renderTasks()}
function duplicateTask(id){const src=ensure(data.tasks.find(x=>x.id===id));if(!src)return;const copy=JSON.parse(JSON.stringify(src));copy.id=uid();copy.title=src.title+' (copy)';copy.createdAt=Date.now();copy.status='todo';copy.timeLog=[];copy.checklist=(src.checklist||[]).map(c=>({id:uid(),text:c.text,done:false,state:'todo',note:c.note||'',due:c.due||'',who:c.who||'',section:c.section||''}));const i=data.tasks.findIndex(x=>x.id===id);data.tasks.splice(i+1,0,copy);save();renderAll();toastMsg('Task duplicated')}
function delTask(id){const t=data.tasks.find(x=>x.id===id);if(!t)return;data.trash=data.trash||[];data.trash.unshift({...ensure(t),deletedAt:Date.now()});data.tasks=data.tasks.filter(x=>x.id!==id);data.notes.forEach(n=>{if(n.taskId===id)n.taskId=null});save();renderAll();toastUndo('Task deleted',()=>{const tr=data.trash.find(x=>x.id===id);if(tr){data.tasks.unshift(tr);data.trash=data.trash.filter(x=>x.id!==id);save();renderAll();}})}
function toggleDone(id,evt){let t=ensure(data.tasks.find(x=>x.id===id));const wasDone=t.status==='done';t.status=wasDone?'todo':'done';if(!wasDone&&t.recurring&&t.recurring!=='none'){spawnNextRecurring(t);}save();renderAll();if(!wasDone&&evt){confettiBurst(evt);}}

function spawnNextRecurring(t){const d=new Date(t.due||today());const map={daily:1,weekly:7,fortnightly:14,monthly:30};const days=map[t.recurring]||7;d.setDate(d.getDate()+days);createTask({title:t.title,priority:t.priority,tags:t.tags,refs:t.refs,recurring:t.recurring,checklist:(t.checklist||[]).map(c=>({...c,done:false})),due:dateKey(d),source:'recurring'});toastMsg('Recurring task spawned →')}
// ── Checklist: cycle state todo → doing → done ────────────────────────────────
function cycleCheck(tid,cid){const t=ensure(data.tasks.find(x=>x.id===tid));const c=t.checklist.find(c=>c.id===cid);if(!c)return;c.state=c.state==='todo'?'doing':c.state==='doing'?'done':'todo';c.done=(c.state==='done');c.doneAt=c.done?new Date().toLocaleString():'';autoCompleteTask(t);save();renderTasks()}
// Feature 12: auto-mark whole task done when all items ticked
function autoCompleteTask(t){if(t.checklist.length&&t.checklist.every(c=>c.done)&&t.status!=='done'){t.status='done';toastMsg('All items done — task marked complete ✓')}}
// Add single item (supports bulk paste — Feature 1)
function addCheckItem(tid,inputEl){const raw=(inputEl.value||'');const lines=raw.split(/\n/).map(s=>s.trim()).filter(Boolean);if(!lines.length)return;const t=ensure(data.tasks.find(x=>x.id===tid));lines.forEach(text=>t.checklist.push({id:uid(),text,done:false,state:'todo',note:'',due:'',who:'',section:''}));inputEl.value='';save();renderTasks()}
function delCheckItem(tid,cid){const t=ensure(data.tasks.find(x=>x.id===tid));t.checklist=(t.checklist||[]).filter(c=>c.id!==cid);save();renderTasks()}
function checkKey(ev,tid){if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();addCheckItem(tid,ev.target)}}
function editCheckText(tid,cid,text){const t=ensure(data.tasks.find(x=>x.id===tid));const c=(t.checklist||[]).find(c=>c.id===cid);if(c){c.text=text;save()}}
function editCheckField(tid,cid,field,val){const t=ensure(data.tasks.find(x=>x.id===tid));const c=(t.checklist||[]).find(c=>c.id===cid);if(c){c[field]=val;save()}}
// Feature 6: mark all / clear all
function checkAllDone(tid){const t=ensure(data.tasks.find(x=>x.id===tid));t.checklist.forEach(c=>{c.done=true;c.state='done'});autoCompleteTask(t);save();renderTasks()}
function checkClearAll(tid){const t=ensure(data.tasks.find(x=>x.id===tid));t.checklist.forEach(c=>{c.done=false;c.state='todo'});save();renderTasks()}
// Feature 5: move item up / down
function moveCheck(tid,cid,dir){const t=ensure(data.tasks.find(x=>x.id===tid));const i=t.checklist.findIndex(c=>c.id===cid);const j=i+dir;if(i<0||j<0||j>=t.checklist.length)return;const tmp=t.checklist[i];t.checklist[i]=t.checklist[j];t.checklist[j]=tmp;save();renderTasks()}
// Feature 17: collapse / expand
function toggleCheckCollapse(tid){const t=ensure(data.tasks.find(x=>x.id===tid));t.checkCollapsed=!t.checkCollapsed;save();renderTasks()}
// Feature 2: load a template's checklist into an existing task
function loadTemplateInto(tid,name){if(!name)return;const t=ensure(data.tasks.find(x=>x.id===tid));const list=data.templates[name]||[];list.forEach(text=>t.checklist.push({id:uid(),text,done:false,state:'todo',note:'',due:'',who:'',section:name}));save();renderTasks();toastMsg('Added '+list.length+' items from "'+name+'"')}
// Feature 3: copy checklist from another task
function copyChecklistFrom(tid,fromId){if(!fromId)return;const t=ensure(data.tasks.find(x=>x.id===tid));const src=ensure(data.tasks.find(x=>x.id==fromId));if(!src)return;src.checklist.forEach(c=>t.checklist.push({id:uid(),text:c.text,done:false,state:'todo',note:c.note||'',due:'',who:c.who||'',section:c.section||''}));save();renderTasks();toastMsg('Copied '+src.checklist.length+' items')}
// Feature 4: favourites (quick-add common items)
function checkFavs(){data.checkFavs=data.checkFavs||['Model check','QA review','Clash test','Export to ACC','Coordinate'];return data.checkFavs}
function addFav(tid,text){if(!text)return;const t=ensure(data.tasks.find(x=>x.id===tid));t.checklist.push({id:uid(),text,done:false,state:'todo',note:'',due:'',who:'',section:''});save();renderTasks()}
function saveFav(tid,cid){const t=ensure(data.tasks.find(x=>x.id===tid));const c=t.checklist.find(c=>c.id===cid);if(!c)return;const favs=checkFavs();if(!favs.includes(c.text)){favs.push(c.text);save();toastMsg('Saved to favourites ★')}else toastMsg('Already a favourite')}
// Feature 19: toggle per-item note editor
function toggleCheckNote(tid,cid){const t=ensure(data.tasks.find(x=>x.id===tid));const c=t.checklist.find(c=>c.id===cid);if(c){c._noteOpen=!c._noteOpen;renderTasks()}}
// Feature 20: export single task's checklist to Excel
function loadXLSX(){return new Promise((res,rej)=>{if(typeof XLSX!=='undefined')return res();const s=document.createElement('script');s.src='lib/xlsx.full.min.js';s.onload=()=>res();s.onerror=()=>rej();document.head.appendChild(s)})}
async function exportChecklistXLSX(tid){const t=ensure(data.tasks.find(x=>x.id===tid));if(!t.checklist.length){toastMsg('No checklist items');return}try{await loadXLSX()}catch{toastMsg('Could not load Excel library (offline?)');return}const rows=[['Item','Section','Status','Assignee','Due','Note']];t.checklist.forEach(c=>rows.push([c.text,c.section||'',c.state||(c.done?'done':'todo'),c.who||'',c.due||'',c.note||'']));const ws=XLSX.utils.aoa_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Checklist');XLSX.writeFile(wb,safeFileName(t.title||'task')+'-checklist.xlsx');toastMsg('Checklist exported')}
// state → icon/colour
function checkStateIcon(s){return s==='done'?'☑':s==='doing'?'◐':'☐'}

// Time logging
function toggleTimeLog(id){if(activeTimerTask===id){const elapsed=Math.floor((Date.now()-activeTimerStart)/1000);const t=ensure(data.tasks.find(x=>x.id===id));t.timeLog.push({date:today(),seconds:elapsed});activeTimerTask=null;activeTimerStart=null;save();renderTasks();toastMsg('Logged '+fmtSecs(elapsed));}else{if(activeTimerTask){const t2=ensure(data.tasks.find(x=>x.id===activeTimerTask));t2.timeLog.push({date:today(),seconds:Math.floor((Date.now()-activeTimerStart)/1000)});save();}activeTimerTask=id;activeTimerStart=Date.now();renderTasks();toastMsg('Timer started ⏱');}}
function totalSecs(t){return(t.timeLog||[]).reduce((a,b)=>a+(b.seconds||0),0)}
function fmtSecs(s){if(s<60)return s+'s';if(s<3600)return Math.floor(s/60)+'m';return Math.floor(s/3600)+'h '+Math.floor((s%3600)/60)+'m'}

function subProgress(t){if(!t.checklist||!t.checklist.length)return'';const done=t.checklist.filter(c=>c.done).length,total=t.checklist.length,pct=Math.round(done/total*100);const col=pct>=100?'#4ecb71':pct>=50?'#e6b450':'#e07a5a';return`<span class="sub-prog"><span class="sub-prog-bar-wrap"><span class="sub-prog-bar" style="width:${pct}%;background:${col}"></span></span><span style="font-size:.58rem;color:var(--muted)">${done}/${total}</span></span>`}
// Feature 15: total open checklist items across all tasks
function openCheckCount(){return (data.tasks||[]).map(ensure).reduce((n,t)=>n+t.checklist.filter(c=>!c.done).length,0)}
// build the full checklist UI for a task
// Item colour tag (Feature: red/amber/green dot)
function cycleCheckColour(tid,cid){const t=ensure(data.tasks.find(x=>x.id===tid));const c=t.checklist.find(c=>c.id===cid);if(!c)return;const seq=['','#e07a5a','#e6b450','#4ecb71'];c.colour=seq[(seq.indexOf(c.colour)+1)%seq.length];save();renderTasks()}
// Filter items within a task (Feature: item search)
function setCheckFilter(tid,val){const t=ensure(data.tasks.find(x=>x.id===tid));t._checkFilter=val;renderTasks();const el=document.querySelector('#chkfilter'+tid);if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length);}}
// Is an item due soon / overdue (Feature: auto highlight)
function checkDueClass(c){if(!c.due||c.done)return'';if(c.due<today())return'overdue';if(c.due===today())return'today';return''}
// Move item to another task (Feature: move item)
function moveCheckToTask(tid,cid,toId){if(!toId)return;const t=ensure(data.tasks.find(x=>x.id===tid));const dest=ensure(data.tasks.find(x=>x.id==toId));const i=t.checklist.findIndex(c=>c.id===cid);if(i<0||!dest)return;const [item]=t.checklist.splice(i,1);dest.checklist.push(item);save();renderTasks();toastMsg('Moved to "'+dest.title+'"')}
// Attach a file reference to one item (Feature: link file)
function attachCheckFile(tid,cid,fileList){const f=fileList&&fileList[0];if(!f)return;const t=ensure(data.tasks.find(x=>x.id===tid));const c=t.checklist.find(c=>c.id===cid);if(!c)return;const r=new FileReader();r.onload=()=>{c.file={name:f.name,size:f.size,data:r.result};save();renderTasks();toastMsg('File attached to item')};r.readAsDataURL(f)}
function openCheckFile(tid,cid){const t=ensure(data.tasks.find(x=>x.id===tid));const c=t.checklist.find(c=>c.id===cid);if(c&&c.file){const a=document.createElement('a');a.href=c.file.data;a.download=c.file.name;a.click()}}
function delCheckFile(tid,cid){const t=ensure(data.tasks.find(x=>x.id===tid));const c=t.checklist.find(c=>c.id===cid);if(c){c.file=null;save();renderTasks()}}
// Import checklist from Excel (Feature: import) — pairs with export
function importChecklistXLSX(tid,fileList){const f=fileList&&fileList[0];if(!f)return;loadXLSX().then(()=>{const r=new FileReader();r.onload=e=>{const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(ws,{header:1});const t=ensure(data.tasks.find(x=>x.id===tid));let added=0;rows.slice(1).forEach(row=>{const text=(row[0]||'').toString().trim();if(!text)return;t.checklist.push({id:uid(),text,done:(row[2]==='done'),state:(row[2]||'todo'),note:(row[5]||'').toString(),due:(row[4]||'').toString(),who:(row[3]||'').toString(),section:(row[1]||'').toString(),colour:'',doneAt:'',file:null});added++});save();renderTasks();toastMsg('Imported '+added+' items')};r.readAsArrayBuffer(f)}).catch(()=>toastMsg('Could not load Excel library'))}
// PDF export (Feature: PDF)
function loadJsPDF(){return new Promise((res,rej)=>{if(window.jspdf)return res();const s=document.createElement('script');s.src='lib/jspdf.umd.min.js';s.onload=()=>res();s.onerror=()=>rej();document.head.appendChild(s)})}
async function exportChecklistPDF(tid){const t=ensure(data.tasks.find(x=>x.id===tid));if(!t.checklist.length){toastMsg('No checklist items');return}try{await loadJsPDF()}catch{toastMsg('Could not load PDF library (offline?)');return}const{jsPDF}=window.jspdf;const doc=new jsPDF();let y=18;doc.setFontSize(14);doc.text((t.title||'Checklist'),14,y);y+=8;doc.setFontSize(10);t.checklist.forEach(c=>{const box=c.done?'[x]':c.state==='doing'?'[~]':'[ ]';let line=box+' '+c.text+(c.who?' ('+c.who+')':'')+(c.due?' - '+c.due:'');doc.text(line.substring(0,90),14,y);y+=6;if(c.note){doc.setTextColor(120);doc.text('   '+c.note.substring(0,85),14,y);doc.setTextColor(0);y+=6}if(y>280){doc.addPage();y=18}});doc.save(safeFileName(t.title||'task')+'-checklist.pdf');toastMsg('Checklist PDF saved')}
// Print single checklist (Feature: print)
function printChecklist(tid){const t=ensure(data.tasks.find(x=>x.id===tid));const rows=t.checklist.map(c=>`<tr><td>${c.done?'☑':c.state==='doing'?'◐':'☐'}</td><td>${esc(c.text)}</td><td>${esc(c.who||'')}</td><td>${esc(c.due||'')}</td><td>${esc(c.note||'')}</td></tr>`).join('');const w=window.open('','_blank');w.document.write(`<html><head><title>${esc(t.title)}</title><style>body{font-family:Arial;padding:20px}h2{margin:0 0 10px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px;text-align:left;font-size:13px}th{background:#eee}</style></head><body><h2>${esc(t.title)}</h2><table><tr><th></th><th>Item</th><th>Who</th><th>Due</th><th>Note</th></tr>${rows}</table></body></html>`);w.document.close();w.print()}

function renderChecklist(t){t=ensure(t);let checks=t.checklist;const done=checks.filter(c=>c.done).length;
  const fq=(t._checkFilter||'').toLowerCase();
  const otherTasks=(data.tasks||[]).filter(x=>x.id!==t.id&&(x.checklist||[]).length).map(x=>`<option value="${x.id}">${esc(x.title)}</option>`).join('');
  const moveTasks=(data.tasks||[]).filter(x=>x.id!==t.id).map(x=>`<option value="${x.id}">${esc(x.title)}</option>`).join('');
  const tmplOpts=Object.keys(data.templates).map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');
  const favBtns=checkFavs().map(f=>`<button class="pill" style="cursor:pointer" onclick="addFav(${t.id},'${esc(f).replace(/'/g,"\\'")}')">+ ${esc(f)}</button>`).join('');
  let sections={};checks.forEach(c=>{const s=c.section||'';(sections[s]=sections[s]||[]).push(c)});
  const collapsed=t.checkCollapsed;
  let listHtml='';
  if(checks.length){
    if(collapsed){listHtml=`<div class="small" style="color:var(--muted);padding:4px 0">${done}/${checks.length} done — collapsed</div>`;}
    else{
      Object.keys(sections).forEach(sec=>{
        const secItems=sections[sec].filter(c=>!fq||(c.text+' '+(c.note||'')).toLowerCase().includes(fq));
        if(fq&&!secItems.length)return;
        const secDone=sections[sec].filter(c=>c.done).length;
        if(sec)listHtml+=`<div class="small" style="font-weight:600;margin:6px 0 2px;color:var(--muted)">▸ ${esc(sec)} <span style="opacity:.7">${secDone}/${sections[sec].length}</span></div>`;
        listHtml+=secItems.map(c=>{
          const stCol=c.state==='done'?'#4ecb71':c.state==='doing'?'#e6b450':'var(--muted)';
          const dueCls=checkDueClass(c);
          const dueBadge=dueCls==='overdue'?'<span class="pill overdue" style="font-size:.55rem">due</span>':dueCls==='today'?'<span class="pill today" style="font-size:.55rem">today</span>':'';
          return `<div class="row" style="align-items:center;gap:5px;flex-wrap:wrap">`+
            `<button class="icon" title="Colour tag" onclick="cycleCheckColour(${t.id},${c.id})" style="padding:0"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c.colour||'transparent'};border:1px solid var(--line)"></span></button>`+
            `<button class="icon" title="Cycle status" onclick="cycleCheck(${t.id},${c.id})" style="color:${stCol};font-size:1rem">${checkStateIcon(c.state)}</button>`+
            `<input type="text" class="small" value="${esc(c.text)}" style="flex:1;min-width:110px;background:transparent;border:1px solid transparent;${c.done?'text-decoration:line-through;opacity:.6':''}" oninput="editCheckText(${t.id},${c.id},this.value)" onfocus="this.style.border='1px solid var(--line)'" onblur="this.style.border='1px solid transparent'" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}">`+
            dueBadge+
            `<input type="text" class="small" title="Assignee initials" placeholder="—" value="${esc(c.who||'')}" style="width:38px;text-align:center" oninput="editCheckField(${t.id},${c.id},'who',this.value)">`+
            `<input type="date" class="small" title="Due date" value="${esc(c.due||'')}" style="width:130px" onchange="editCheckField(${t.id},${c.id},'due',this.value)">`+
            `<button class="icon" title="Move up" onclick="moveCheck(${t.id},${c.id},-1)">↑</button>`+
            `<button class="icon" title="Move down" onclick="moveCheck(${t.id},${c.id},1)">↓</button>`+
            `<button class="icon" title="Note" onclick="toggleCheckNote(${t.id},${c.id})">🗒</button>`+
            `<label class="icon" title="Attach file" style="cursor:pointer;margin:0">📎<input type="file" hidden onchange="attachCheckFile(${t.id},${c.id},this.files);this.value=''"></label>`+
            `<button class="icon" title="Save to favourites" onclick="saveFav(${t.id},${c.id})">★</button>`+
            (moveTasks?`<select class="small" title="Move to task" style="width:32px;height:32px;min-height:32px;border-radius:50%;padding:0;text-align:center;text-align-last:center;appearance:none;-webkit-appearance:none;-moz-appearance:none;line-height:1" onchange="moveCheckToTask(${t.id},${c.id},this.value);this.value=''"><option value="">⇄</option>${moveTasks}</select>`:'')+
            `<button class="icon danger" title="Remove" onclick="delCheckItem(${t.id},${c.id})">×</button>`+
            (c.doneAt?`<div class="small" style="width:100%;color:var(--muted);padding-left:30px;font-size:.6rem">✓ ${esc(c.doneAt)}</div>`:'')+
            (c.file?`<div class="small" style="width:100%;padding-left:30px">📎 <a href="#" onclick="openCheckFile(${t.id},${c.id});return false">${esc(c.file.name)}</a> <button class="icon danger" style="font-size:.6rem" onclick="delCheckFile(${t.id},${c.id})">×</button></div>`:'')+
            (c._noteOpen?`<textarea class="small" placeholder="Note for this item…" style="width:100%;margin-top:2px;min-height:40px" oninput="editCheckField(${t.id},${c.id},'note',this.value)">${esc(c.note||'')}</textarea>`:(c.note?`<div class="small" style="width:100%;color:var(--muted);padding-left:30px">🗒 ${esc(c.note)}</div>`:''))+
          `</div>`;
        }).join('');
      });
    }
  }
  return `<div class="checklist-block">`+
    (checks.length?`<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:2px"><b class="small">Checklist ${done}/${checks.length}</b><div class="row" style="gap:4px"><button class="icon" title="${collapsed?'Expand':'Collapse'}" onclick="toggleCheckCollapse(${t.id})">${collapsed?'▸':'▾'}</button><button class="icon" title="Mark all done" onclick="checkAllDone(${t.id})">✓✓</button><button class="icon" title="Clear all" onclick="checkClearAll(${t.id})">▢</button><button class="icon" title="Export to Excel" onclick="exportChecklistXLSX(${t.id})">⬇</button><button class="icon" title="Export to PDF" onclick="exportChecklistPDF(${t.id})">📄</button><button class="icon" title="Print" onclick="printChecklist(${t.id})">🖨</button><label class="icon" title="Import from Excel" style="cursor:pointer;margin:0">📥<input type="file" hidden accept=".xlsx,.xls,.csv" onchange="importChecklistXLSX(${t.id},this.files);this.value=''"></label></div></div>`:'')+
    (checks.length>4?`<input id="chkfilter${t.id}" type="text" class="small" placeholder="🔍 Filter items…" value="${esc(t._checkFilter||'')}" style="width:100%;margin-bottom:4px" oninput="setCheckFilter(${t.id},this.value)">`:'')+
    `<div class="list">${listHtml}</div>`+
    `<div class="row" style="gap:6px;margin:4px 0"><textarea class="small" placeholder="+ Add item (paste multiple lines for several)" style="flex:1;min-height:32px;resize:vertical" onkeydown="checkKey(event,${t.id})"></textarea><button class="icon" title="Add" onclick="addCheckItem(${t.id},this.previousElementSibling)">+</button></div>`+
    (favBtns?`<div class="row" style="gap:4px;flex-wrap:wrap;margin:2px 0">${favBtns}</div>`:'')+
    `<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:4px">`+
      `<select class="small" style="flex:1;min-width:130px" onchange="loadTemplateInto(${t.id},this.value);this.value=''"><option value="">＋ Load template…</option>${tmplOpts}</select>`+
      (otherTasks?`<select class="small" style="flex:1;min-width:130px" onchange="copyChecklistFrom(${t.id},this.value);this.value=''"><option value="">⧉ Copy from task…</option>${otherTasks}</select>`:'')+
    `</div>`+
  `</div>`;
}

// ── Task rendering ────────────────────────────────────────────────────────────
function taskRow(t,i){t=ensure(t);const open=openTaskId===t.id,checks=t.checklist||[],secs=totalSecs(t),isLogging=activeTimerTask===t.id;return`<div class="item todo pri-${t.priority} ${t.status==='done'?'done':''} ${open?'open':''}" data-tid="${t.id}"><div class="task-main" onclick="toggleOpen(${t.id})"><span class="task-num">${i+1}</span><span class="todo-text">${esc(t.title)}</span>${indicators(t)}${window.LTLinks?LTLinks.rowChips(t):''}${subProgress(t)}${secs>0?`<span class="timelog-badge">⏱${fmtSecs(secs)}</span>`:''}${t.recurring&&t.recurring!=='none'?'<span class="pill recurring">↺</span>':''}${(t.files&&t.files.length)?`<span class="pill">📎 ${t.files.length}</span>`:''}</div><div class="row" style="gap:4px"><button class="icon ${isLogging?'logging':''}" onclick="event.stopPropagation();toggleTimeLog(${t.id})" title="Log time">⏱</button><button class="icon" onclick="event.stopPropagation();openTask(${t.id})">✎</button><button class="icon" title="Duplicate" onclick="event.stopPropagation();duplicateTask(${t.id})">⧉</button><button class="icon" onclick="event.stopPropagation();toggleDone(${t.id},event)">✓</button><button class="icon danger" onclick="event.stopPropagation();delTask(${t.id})">×</button></div><div class="task-open" onclick="event.stopPropagation()">${window.LTLinks?LTLinks.openPanel(t):''}<div class="meta row">${[`<span class="pill ${t.priority}">${t.priority}</span>`,`<span class="pill">${statusName(t.status)}</span>`,t.due?`<span class="pill">${t.due}</span>`:'',t.recurring&&t.recurring!=='none'?`<span class="pill recurring">↺ ${t.recurring}</span>`:'',`<span class="pill">added ${new Date(t.createdAt).toLocaleString()}</span>`,...t.tags.map(x=>`<span class="pill">#${esc(x)}</span>`)].join('')}</div>${renderChecklist(t)}${renderTaskFiles(t)}<textarea placeholder="Details / references…" oninput="ensure(data.tasks.find(x=>x.id===${t.id})).refs=this.value;save()">${esc(t.refs)}</textarea></div></div>`}
function indicators(t){const td=t.due===today(),od=t.due&&t.due<today()&&t.status!=='done';return`${td?'<span class="pill today">Today</span>':''}${od?'<span class="pill overdue">Overdue</span>':''}`}
function statusName(s){return{todo:'To Do',progress:'In Progress',waiting:'Waiting',done:'Done'}[s]||s}
function filtered(){let q=(taskSearch?.value||'').toLowerCase(),f=taskFilter?.value||'all',sort=taskSort?.value||data.settings.sort||'dueAsc';data.settings.sort=sort;let arr=data.tasks.map(ensure).filter(t=>(!q||(t.title+t.priority+t.status+t.refs+t.tags.join(' ')).toLowerCase().includes(q))&&((f==='all'||t.status===f)||(f==='hasFiles'&&(t.files||[]).length>0)||(f==='noFiles'&&!(t.files||[]).length)||(f==='openChecks'&&(t.checklist||[]).some(c=>!c.done))));let active=arr.filter(t=>t.status!=='done'),done=arr.filter(t=>t.status==='done');let sorter=(a,b)=>{if(sort==='createdDesc')return(b.createdAt||0)-(a.createdAt||0);if(sort==='createdAsc')return(a.createdAt||0)-(b.createdAt||0);if(sort==='dueDesc')return(b.due||'').localeCompare(a.due||'');return(a.due||'9999').localeCompare(b.due||'9999')};active.sort(sorter);done.sort(sorter);return[...active,...done]}
function renderFilters(){if(taskSort)taskSort.value=data.settings.sort||'dueAsc'}
/* ══════════════════════════════════════════════════════════════
   QA/QC mirror — surfaces qaqc.html tasks in the to-do list.
   Source of truth stays in lews_qaqc_state_v1. We read it, render
   Project ▸ Task ▸ checklist, and write ticks straight back.
   ══════════════════════════════════════════════════════════════ */
var QAQC_KEY='lews_qaqc_state_v1';
var qaqcCollapsed = {};          // {projectId: true} when collapsed
try{ qaqcCollapsed = JSON.parse(localStorage.getItem('lews_qaqc_todo_collapsed')||'{}'); }catch(e){}

function qaqcRead(){
  try{ var raw=localStorage.getItem(QAQC_KEY); if(!raw) return null; var d=JSON.parse(raw); return (d&&d.projects)?d:null; }
  catch(e){ return null; }
}
function qaqcWrite(d){
  try{
    localStorage.setItem(QAQC_KEY, JSON.stringify(d));
    localStorage.setItem('lews_qaqc_updated', new Date().toISOString());
    // same bridge qaqc.html uses → triggers encrypted cloud push
    if(typeof window.__trackerEmbedSaved==='function') window.__trackerEmbedSaved('qaqc');
  }catch(e){}
}
// mirror of qaqc.html sheetStatus(): todo / prog / issue / ready / done
function qaqcStatus(s){
  var items=s.items||[], checks=s.checks||{};
  var vals=Object.keys(checks).map(function(k){return checks[k];});
  var passes=vals.filter(function(v){return v==='pass';}).length;
  var fails=vals.filter(function(v){return v==='fail';}).length;
  if(s.verified) return 'done';
  if(fails>0) return 'issue';
  if(items.length>0 && passes===items.length) return 'ready';
  if(passes>0||fails>0) return 'prog';
  return 'todo';
}
var QAQC_LBL={todo:'Not started',prog:'In progress',issue:'Has issues',ready:'Self-checked',done:'Verified'};

function qaqcSectionHTML(){
  var d=qaqcRead();
  if(!d||!d.projects||!d.projects.length) return '';
  var html='';
  d.projects.forEach(function(p){
    var sheets=(p.sheets||[]).filter(function(s){return !s.archived;});
    if(!sheets.length){
      html+='<div class="qaqc-group">'+
        '<div class="qaqc-ghead"><span class="qaqc-chip">QC</span>'+
        '<span class="qaqc-gtitle">'+esc(p.code? p.code+' — '+p.name : p.name)+'</span>'+
        '<span class="qaqc-gmeta">No tasks yet</span></div></div>';
      return;
    }
    var verified=sheets.filter(function(s){return qaqcStatus(s)==='done';}).length;
    var issues=sheets.filter(function(s){return Object.values(s.checks||{}).indexOf('fail')>=0;}).length;
    var collapsed=!!qaqcCollapsed[p.id];
    var label=esc(p.code? p.code+' — '+p.name : p.name);
    html+='<div class="qaqc-group">'+
      '<div class="qaqc-ghead" onclick="qaqcToggleGroup(\''+p.id+'\')">'+
        '<span class="qaqc-chev">'+(collapsed?'▸':'▾')+'</span>'+
        '<span class="qaqc-chip">QC</span>'+
        '<span class="qaqc-gtitle">'+label+'</span>'+
        '<span class="qaqc-gmeta">'+sheets.length+' tasks · '+verified+' verified'+(issues?' · <b style="color:#ff7474">'+issues+' issue'+(issues>1?'s':'')+'</b>':'')+'</span>'+
      '</div>';
    if(!collapsed){
      html+='<div class="qaqc-tasks">';
      sheets.forEach(function(s){ html+=qaqcTaskRow(p.id,s); });
      html+='</div>';
    }
    html+='</div>';
  });
  if(!html) return '';
  return '<div class="qaqc-section">'+html+'</div>';
}

function qaqcTaskRow(pid,s){
  var st=qaqcStatus(s);
  var items=s.items||[], checks=s.checks||{};
  var passes=Object.keys(checks).filter(function(k){return checks[k]==='pass';}).length;
  var fails=Object.keys(checks).filter(function(k){return checks[k]==='fail';}).length;
  var pct=items.length?Math.round(passes/items.length*100):0;
  var open=qaqcOpenId===s.id;
  var title=esc(s.number)+(s.title?' — '+esc(s.title):'');
  var sub=[];
  for(var i=0;i<items.length;i++){
    var v=checks[i]||'';
    var box=v==='pass'?'✓':v==='fail'?'✗':'';
    sub.push('<div class="qaqc-item '+(v||'')+'" onclick="qaqcCycle(\''+pid+'\',\''+s.id+'\','+i+')">'+
      '<span class="qaqc-box">'+box+'</span><span class="qaqc-itext">'+esc(items[i])+'</span></div>');
  }
  return '<div class="qaqc-task st-'+st+' '+(open?'open':'')+'" data-sid="'+s.id+'">'+
    '<div class="qaqc-main" onclick="qaqcToggleOpen(\''+s.id+'\')">'+
      '<span class="qaqc-status-dot '+st+'"></span>'+
      '<span class="qaqc-ttitle">'+title+'</span>'+
      '<span class="qaqc-prog"><span class="qaqc-prog-wrap"><span class="qaqc-prog-bar" style="width:'+pct+'%"></span></span>'+passes+'/'+items.length+'</span>'+
      (fails?'<span class="qaqc-issue">'+fails+' issue'+(fails>1?'s':'')+'</span>':'')+
      (st==='done'?'<span class="qaqc-verified">✓ Verified</span>':'')+
    '</div>'+
    '<div class="qaqc-open">'+
      (s.assignee?'<div class="qaqc-assignee">👤 '+esc(s.assignee)+' · '+esc(s.type||'')+'</div>':'')+
      '<div class="qaqc-hint">Tap an item: pass ✓ → issue ✗ → clear</div>'+
      (sub.join('')||'<div class="small" style="opacity:.6;padding:4px">No checklist items.</div>')+
      '<button class="btn ghost qaqc-openbtn" onclick="event.stopPropagation();qaqcJumpTo(\''+pid+'\',\''+s.id+'\')">Open in QA/QC ▸</button>'+
    '</div>'+
  '</div>';
}

var qaqcOpenId=null;
function qaqcToggleOpen(id){ qaqcOpenId = qaqcOpenId===id?null:id; renderTasks(); }
function qaqcToggleGroup(pid){
  qaqcCollapsed[pid]=!qaqcCollapsed[pid];
  try{ localStorage.setItem('lews_qaqc_todo_collapsed', JSON.stringify(qaqcCollapsed)); }catch(e){}
  renderTasks();
}
// cycle pass → fail → clear, then auto-verify when every item passes
function qaqcCycle(pid,sid,idx){
  var d=qaqcRead(); if(!d) return;
  var p=d.projects.find(function(x){return x.id===pid;}); if(!p) return;
  var s=(p.sheets||[]).find(function(x){return x.id===sid;}); if(!s) return;
  s.checks=s.checks||{};
  var cur=s.checks[idx]||'';
  var nv = cur===''?'pass' : cur==='pass'?'fail' : '';
  if(nv==='') delete s.checks[idx]; else s.checks[idx]=nv;
  // auto verify/unverify based on all-pass
  var items=s.items||[];
  var passes=Object.keys(s.checks).filter(function(k){return s.checks[k]==='pass';}).length;
  var allPass = items.length>0 && passes===items.length;
  if(allPass){ if(!s.verified){ s.verified=true; qaqcAddHist(s,'Verified (all items passed via to-do)'); } }
  else if(s.verified){ s.verified=false; qaqcAddHist(s,'Un-verified (item changed via to-do)'); }
  qaqcWrite(d);
  renderTasks();
  if(typeof stats==='function') try{stats();}catch(e){}
  if(typeof dashboard==='function') try{dashboard();}catch(e){}
}
function qaqcAddHist(s,text){ s.history=s.history||[]; s.history.push({date:new Date().toLocaleString(),text:text}); }

// jump into the QA/QC tab with this task open
function qaqcJumpTo(pid,sid){
  var d=qaqcRead(); if(d){ d.activeId=pid; try{ d._focusSheet=sid; }catch(e){} qaqcWrite(d); }
  if(typeof show==='function') show('qaqc');
}

function renderTasks(){if(!taskArea)return;if(window.LTLinks&&LTLinks.allOn()){taskArea.innerHTML=LTLinks.allView();return}renderFilters();let list=filtered();save();if(data.settings.mode==='board'){modeBtn.textContent='List';renderBoard(list)}else{modeBtn.textContent='Board';taskArea.innerHTML=qaqcSectionHTML()+'<div class="list">'+(list.map((t,i)=>taskRow(t,i)).join('')||'<div class="empty"><span class="e-ic">📋</span>No tasks yet — use Quick Add above to get started.</div>')+'</div>'}}
function renderBoard(list){const cols=['todo','progress','waiting','done'];taskArea.innerHTML='<div class="board">'+cols.map(c=>`<div class="board-col" data-status="${c}" ondragover="boardOver(event)" ondragleave="boardLeave(event)" ondrop="boardDrop(event,'${c}')"><h3>${statusName(c)} <span class="pill">${list.filter(t=>t.status===c).length}</span></h3>${list.filter(t=>t.status===c).map(t=>`<div class="board-card" draggable="true" ondragstart="boardDrag(event,${t.id})"><b>${esc(t.title)}</b><div class="small">${t.due||'No date'} · ${t.priority}</div></div>`).join('')||'<div class="empty">Drop here</div>'}</div>`).join('')+'</div>'}
function boardDrag(e,id){e.dataTransfer.setData('text/plain',id)}
function boardOver(e){e.preventDefault();e.currentTarget.classList.add('dragover')}
function boardLeave(e){e.currentTarget.classList.remove('dragover')}
function boardDrop(e,status){e.preventDefault();e.currentTarget.classList.remove('dragover');let id=Number(e.dataTransfer.getData('text/plain')),t=data.tasks.find(x=>x.id===id);if(t){ensure(t).status=status;save();renderAll();toastMsg('Moved to '+statusName(status))}}
function toggleMode(){data.settings.mode=data.settings.mode==='board'?'list':'board';save();renderTasks()}
['taskSearch','taskFilter'].forEach(id=>setTimeout(()=>document.getElementById(id)?.addEventListener('input',renderTasks),0));

// ── Templates ─────────────────────────────────────────────────────────────────
function openTemplate(name){templateId.value=name||'';templateTitle.textContent=name?'Edit Template':'New Template';templateName.value=name||'';templateLines.value=name?(data.templates[name]||[]).join('\n'):'';openModal('templateModal')}
function saveTemplate(){let name=templateName.value.trim(),old=templateId.value;if(!name)return;if(old&&old!==name)delete data.templates[old];data.templates[name]=templateLines.value.split(/\n/).map(x=>x.trim()).filter(Boolean);closeModal('templateModal');save();renderTemplates()}
function delTemplate(name){if(confirm('Delete template?')){delete data.templates[name];save();renderTemplates()}}
function useTemplate(name){let list=data.templates[name]||[];createTask({title:name,priority:'medium',due:today(),tags:['BIM'],checklist:list.map(x=>({id:uid(),text:x,done:false})),refs:list.map(x=>'□ '+x).join('\n')});toastMsg('Template task added')}
function renderTemplates(){if(!templateList)return;templateList.innerHTML=Object.keys(data.templates).map(name=>`<div class="template"><b>${esc(name)}</b><small>${(data.templates[name]||[]).slice(0,3).join(' · ')}</small><br><br><div class="row"><button class="btn primary" onclick="useTemplate('${esc(name)}')">Use</button><button class="btn" onclick="openTemplate('${esc(name)}')">Edit</button><button class="btn danger" onclick="delTemplate('${esc(name)}')">Delete</button></div></div>`).join('')||'<div class="empty">No templates.</div>'}

// ── Calendar ──────────────────────────────────────────────────────────────────
function due(k){return data.tasks.map(ensure).filter(t=>t.due===k)}
function addCalendarTask(title,k=selected){if(!title)return;createTask({title,priority:'medium',status:'todo',due:k,tags:['Calendar'],source:'calendar'});selected=k;toastMsg('Calendar task added')}
function addEvent(){const el=document.getElementById('eventInput');let v=(el?.value||'').trim();if(!v)return;if(el)el.value='';addCalendarTask(v,selected);save();renderAll()}
function moveMonth(n){current.setMonth(current.getMonth()+n);renderCalendar()}
function calendarTaskMarker(k){const items=due(k);if(!items.length)return '';const open=items.filter(t=>ensure(t).status!=='done').length;const label=open?open:items.length;const title=items.length+' task(s) on this day';return `<span class="cal-task-marker" title="${title}">${label}</span>`;}
function renderCalendar(){
  if(!calendarGrid)return;
  calendarGrid.innerHTML='';
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d=>calendarGrid.innerHTML+=`<div class="weekday">${d}</div>`);
  let y=current.getFullYear(),m=current.getMonth(),start=new Date(y,m,1);
  monthLabel.textContent=current.toLocaleDateString('en-US',{month:'long',year:'numeric'});
  start.setDate(start.getDate()-start.getDay());
  for(let i=0;i<42;i++){
    let d=new Date(start);
    d.setDate(start.getDate()+i);
    let k=dateKey(d);
    calendarGrid.innerHTML+=`<div class="day ${d.getMonth()!==m?'muted':''} ${k===today()?'today':''} ${k===selected?'selected':''}" onclick="selected='${k}';renderAll()"><b>${d.getDate()}</b>${calendarTaskMarker(k)}</div>`;
  }
}
function renderDay(){if(!dayList)return;selectedTitle.textContent='Tasks for '+selected;let arr=due(selected).map(t=>`<div class="item pri-${t.priority}"><div class="todo-text"><b>Task:</b> ${esc(t.title)}</div><button class="btn" onclick="show('tasks');openTaskId=${t.id};renderTasks()">Open</button></div>`);dayList.innerHTML=arr.join('')||'<div class="empty"><span class="e-ic">✅</span>Nothing due this day.</div>'}

// ── Notes ─────────────────────────────────────────────────────────────────────
function renderNoteTaskOptions(){if(!noteTask)return;noteTask.innerHTML='<option value="">No linked task</option>'+data.tasks.map(ensure).slice(0,200).map(t=>`<option value="${t.id}">${esc(t.title)}</option>`).join('')}
function saveNote(){let title=noteTitle.value.trim(),body=noteBody.value.trim();if(!title&&!body)return;let id=noteId.value;if(id){let n=data.notes.find(x=>x.id==id);if(n){n.title=title||'Untitled';n.body=body;n.taskId=noteTask.value?Number(noteTask.value):null;n.updated=Date.now()}}else data.notes.unshift({id:uid(),title:title||'Untitled',body,taskId:noteTask.value?Number(noteTask.value):null,created:new Date().toLocaleDateString(),updated:Date.now()});clearNoteEditor();save();renderNotes();toastMsg('Note saved')}
function editNote(id){let n=data.notes.find(x=>x.id===id);if(!n)return;noteEditorTitle.textContent='Edit Note';noteId.value=n.id;noteTitle.value=n.title;noteBody.value=n.body;noteTask.value=n.taskId||'';show('notes');setTimeout(()=>noteTitle.focus(),80)}
function clearNoteEditor(){noteEditorTitle.textContent='New Note';noteId.value='';noteTitle.value='';noteBody.value='';noteTask.value=''}
function delNote(id){data.notes=data.notes.filter(n=>n.id!==id);save();renderNotes()}
function renderNotes(){if(!noteList)return;renderNoteTaskOptions();let q=(noteSearch?.value||'').toLowerCase(),list=data.notes.filter(n=>(n.title+n.body).toLowerCase().includes(q));noteList.innerHTML=list.map(n=>{let t=data.tasks.find(x=>x.id===n.taskId);return`<div class="card note"><div class="row" style="justify-content:space-between"><b>${esc(n.title)}</b><div class="row"><button class="icon" onclick="editNote(${n.id})">✎</button><button class="icon danger" onclick="delNote(${n.id})">×</button></div></div><p>${esc(n.body)}</p><div class="meta row"><span class="pill">${n.created}</span>${t?`<span class="pill">linked: ${esc(t.title)}</span>`:''}</div></div>`}).join('')||'<div class="empty">No notes yet.</div>'}

// ── Finance ───────────────────────────────────────────────────────────────────
function newBudget(name,type,currency){const cats=type==='project'?['Project Income','Materials','Labor','Tools','Travel','Contingency','Profit']:['Income','Housing','Food','Transport','Utilities','Savings','Debt','Leisure'];return{id:uid(),name,type,currency:currency||'USD',categories:cats.map(c=>({id:uid(),name:c,amount:0,type:c.toLowerCase().includes('income')?'income':'expense',paid:false}))}}
function openBudget(){if(isFinanceLocked()){toastMsg('Unlock finance first');return}budgetName.value='Personal Budget';budgetType.value='personal';budgetCurrency.value='USD';openModal('budgetModal')}
function saveBudget(){data.budgets.unshift(newBudget(budgetName.value.trim()||'Budget',budgetType.value,budgetCurrency.value));closeModal('budgetModal');save();renderBudgets()}
function totals(b){let inc=0,exp=0,paid=0,unpaid=0;b.categories.forEach(c=>{c.paid=!!c.paid;if(c.type==='income')inc+=+c.amount||0;else{exp+=+c.amount||0;if(c.paid)paid+=+c.amount||0;else unpaid+=+c.amount||0}});return{inc,exp,bal:inc-exp,paid,unpaid}}
function renameBudget(id,val){let b=data.budgets.find(b=>b.id===id);if(b){b.name=val||'Budget';save()}}
function updateCat(bid,cid,k,v){let c=data.budgets.find(b=>b.id===bid).categories.find(c=>c.id===cid);c[k]=k==='amount'?Number(v||0):k==='paid'?!!v:v;save();renderBudgets()}
function addCat(bid){data.budgets.find(b=>b.id===bid).categories.push({id:uid(),name:'New Category',amount:0,type:'expense',paid:false});save();renderBudgets()}
function delBudget(id){data.budgets=data.budgets.filter(b=>b.id!==id);if(data.openBudget===id)data.openBudget=null;save();renderBudgets()}
function toggleBudget(id){data.openBudget=data.openBudget===id?null:id;save();renderBudgets()}
function isFinanceLocked(){return data.settings.financePass&&!data.settings.financeUnlocked}
function openFinancePass(){financePassInput.value='';openModal('financePassModal')}
function saveFinancePass(){data.settings.financePass=financePassInput.value;data.settings.financeUnlocked=!financePassInput.value;closeModal('financePassModal');save();renderBudgets()}
function unlockFinance(){let p=prompt('Finance password');if(p===data.settings.financePass){data.settings.financeUnlocked=true;save();renderBudgets()}else alert('Wrong password')}
function lockFinance(){data.settings.financeUnlocked=false;save();renderBudgets()}
function setFinanceScale(v){data.settings.financeScale=Number(v)/100;document.documentElement.style.setProperty('--finScale',data.settings.financeScale);financeScaleLabel.textContent=v+'%';save()}
function paidPendingCount(){return data.budgets.reduce((a,b)=>a+b.categories.filter(c=>c.type!=='income'&&!c.paid).length,0)}

function renderBudgets(){if(!budgetList)return;if(isFinanceLocked()){financeLock.innerHTML='<div class="empty">Finance is locked.<br><br><button class="btn primary" onclick="unlockFinance()">Unlock</button></div>';budgetList.innerHTML='';return}financeLock.innerHTML=data.settings.financePass?'<div class="row" style="margin-bottom:10px"><span class="pill">Password on</span><button class="btn" onclick="lockFinance()">Lock</button></div>':'';budgetList.innerHTML=data.budgets.map(b=>{const curr=b.currency||'USD';let t=totals(b),pct=t.inc?Math.min(100,t.exp/t.inc*100):0,paidPct=t.exp?Math.round(t.paid/t.exp*100):0,open=data.openBudget===b.id;const groceryMode=b.groceryMode;return`<div class="card budget-card ${open?'open':''}" data-bid="${b.id}"><div class="budget-header"><button class="budget-collapse-btn" onclick="toggleBudget(${b.id})">${open?'▾':'▸'}</button><input class="budget-title-input" value="${esc(b.name)}" onchange="renameBudget(${b.id},this.value)" style="flex:1;min-width:0"><span class="pill">${curr}</span><button class="btn" onclick="toggleGroceryMode(${b.id})" title="Switch to list view">${groceryMode?'Budget':'List View'}</button><button class="btn danger" onclick="delBudget(${b.id})">×</button></div><div class="budget-body">${groceryMode?renderGroceryView(b,curr):`<div class="grid auto finance-kpis"><div class="item"><div><div class="label">Income</div><div class="num">${moneyFmt(t.inc,curr)}</div></div></div><div class="item"><div><div class="label">Expense</div><div class="num">${moneyFmt(t.exp,curr)}</div></div></div><div class="item"><div><div class="label">Balance</div><div class="num">${moneyFmt(t.bal,curr)}</div></div></div><div class="item"><div><div class="label">Pending</div><div class="num">${moneyFmt(t.unpaid,curr)}</div></div></div></div><br><div class="small">Budget use</div><div class="progress"><span style="width:${pct}%"></span></div><br><div class="small">Paid ${paidPct}%</div><div class="progress"><span style="width:${paidPct}%"></span></div><br>${b.categories.map((c,ci)=>`<div class="budget-line ${c.paid?'paid':''}" draggable="true" data-bid="${b.id}" data-cid="${c.id}" data-cidx="${ci}" ondragstart="budgetDragStart(event)" ondragover="budgetDragOver(event)" ondrop="budgetDrop(event)" ondragend="budgetDragEnd(event)"><div class="cat-controls"><span class="budget-drag-handle" title="Drag to reorder">⠿</span><input type="checkbox" ${c.paid?'checked':''} onchange="updateCat(${b.id},${c.id},'paid',this.checked)" style="width:auto"></div><input class="cat-name" value="${esc(c.name)}" onchange="updateCat(${b.id},${c.id},'name',this.value)"><input class="cat-amount" type="number" value="${c.amount||''}" placeholder="0" onchange="updateCat(${b.id},${c.id},'amount',this.value)"><select class="cat-type" onchange="updateCat(${b.id},${c.id},'type',this.value)"><option value="expense" ${c.type==='expense'?'selected':''}>Expense</option><option value="income" ${c.type==='income'?'selected':''}>Income</option></select><button class="icon danger cat-del" onclick="data.budgets.find(x=>x.id===${b.id}).categories=data.budgets.find(x=>x.id===${b.id}).categories.filter(x=>x.id!==${c.id});save();renderBudgets()">×</button></div>`).join('')}<button class="btn" onclick="addCat(${b.id})">+ Category</button>`}</div></div>`}).join('')||'<div class="empty">No budgets. Click + Budget.</div>'}

function renderGroceryView(b,curr){
  const unpaid=b.categories.filter(c=>c.type!=='income'&&!c.paid);
  const paid=b.categories.filter(c=>c.type!=='income'&&c.paid);
  const totalUnpaid=unpaid.reduce((a,c)=>a+(+c.amount||0),0);
  return '<div class="grocery-list">'
    +'<div class="row" style="justify-content:space-between;margin-bottom:8px"><span class="small">'+unpaid.length+' items to buy</span><span class="pill">Total: '+moneyFmt(totalUnpaid,curr)+'</span></div>'
    +b.categories.filter(c=>c.type!=='income').map(c=>
      '<div class="grocery-item '+(c.paid?'checked':'')+'" onclick="updateCat('+b.id+','+c.id+',\'paid\','+(!c.paid)+')"><input type="checkbox" '+(c.paid?'checked':'')+' style="width:auto;flex:0 0 auto" onclick="event.stopPropagation();" onchange="updateCat('+b.id+','+c.id+',\'paid\',this.checked)"><span style="flex:1">'+esc(c.name)+'</span><span class="grocery-count">'+moneyFmt(+c.amount||0,curr)+'</span></div>'
    ).join('')
    +'</div><br><div class="small" style="color:var(--green)">Tap items to check them off</div>';
}

function toggleGroceryMode(bid){
  const b=data.budgets.find(x=>x.id===bid);
  if(b){b.groceryMode=!b.groceryMode;save();renderBudgets();}
}

// Budget drag-drop reorder
let _budgetDragBid=null,_budgetDragIdx=null;
function budgetDragStart(e){
  _budgetDragBid=+e.currentTarget.dataset.bid;
  _budgetDragIdx=+e.currentTarget.dataset.cidx;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed='move';
}
function budgetDragOver(e){
  e.preventDefault();
  e.dataTransfer.dropEffect='move';
  const el=e.currentTarget;
  document.querySelectorAll('.budget-line.drag-over').forEach(x=>x.classList.remove('drag-over'));
  if(+el.dataset.bid===_budgetDragBid)el.classList.add('drag-over');
}
function budgetDrop(e){
  e.preventDefault();
  const targetIdx=+e.currentTarget.dataset.cidx;
  const targetBid=+e.currentTarget.dataset.bid;
  if(targetBid!==_budgetDragBid||targetIdx===_budgetDragIdx)return;
  const b=data.budgets.find(x=>x.id===_budgetDragBid);
  if(!b)return;
  const item=b.categories.splice(_budgetDragIdx,1)[0];
  b.categories.splice(targetIdx,0,item);
  save();renderBudgets();
}
function budgetDragEnd(e){
  document.querySelectorAll('.budget-line.dragging,.budget-line.drag-over').forEach(x=>x.classList.remove('dragging','drag-over'));
  _budgetDragBid=null;_budgetDragIdx=null;
}

// ── Dashboard + Weekly strip ──────────────────────────────────────────────────
function countUp(el,target,dur=550){const start=Date.now(),init=parseInt(el.textContent)||0;const step=()=>{const p=Math.min((Date.now()-start)/dur,1),ease=1-Math.pow(1-p,3);el.textContent=Math.round(init+(target-init)*ease);if(p<1)requestAnimationFrame(step)};requestAnimationFrame(step)}

function renderWeekStrip(){const wrap=document.getElementById('weekStripWrap');if(!wrap)return;const now=new Date();const days=[];for(let i=0;i<7;i++){const d=new Date(now);d.setDate(now.getDate()-now.getDay()+i);days.push({key:dateKey(d),label:d.toLocaleDateString('en',{weekday:'short'}),date:d.getDate()});}wrap.innerHTML='<div class="week-strip">'+days.map(d=>{const cnt=due(d.key).filter(t=>ensure(t).status!=='done').length;const isTd=d.key===today();return`<div class="week-day ${isTd?'today':''}" onclick="selected='${d.key}';show('calendar')" title="${d.key}"><div class="small">${d.label}</div><b>${d.date}</b>${cnt?`<span class="week-cnt">${cnt}</span>`:''}</div>`}).join('')+'</div>'}

function dashboard(){const active=data.tasks.map(ensure).filter(t=>t.status!=='done'),done=data.tasks.filter(t=>ensure(t).status==='done').length,total=data.tasks.length,pct=total?Math.round(done/total*100):0;
  doneBar.style.width=pct+'%';
  dashStats.innerHTML=`<div class="item"><div><b>${pct}%</b><div class="small">complete</div></div></div><div class="item"><div><b>${openCheckCount()}</b><div class="small">open items</div></div></div><div class="item"><div><b>${data.notes.length}</b><div class="small">notes</div></div></div><div class="item"><div><b>${paidPendingCount()}</b><div class="small">unpaid items</div></div></div>`;
  dashCommand.innerHTML=active.slice(0,5).map((t,i)=>`<div class="item pri-${t.priority}"><div class="task-main"><span class="task-num">${i+1}</span><span class="todo-text">${esc(t.title)}</span>${indicators(t)}${window.LTLinks?LTLinks.rowChips(t):''}</div><button class="btn" onclick="show('tasks');openTaskId=${t.id};renderTasks()">Open</button></div>`).join('')||'<div class="empty">All clear. Add a task.</div>';
  renderWeekStrip();}

function renderInsights(){let tasks=data.tasks.map(ensure),open=tasks.filter(t=>t.status!=='done').length,done=tasks.filter(t=>t.status==='done').length,over=tasks.filter(t=>t.status!=='done'&&t.due<today()).length,todayCnt=tasks.filter(t=>t.status!=='done'&&t.due===today()).length,total=tasks.length,pct=total?Math.round(done/total*100):0;let health=over>0?'Attention needed':todayCnt>2?'Heavy today':open>0?'In progress':'Clear';insightHero.innerHTML=`<div class="label">Workload Health</div><div class="insight-big">${health}</div><div class="barline"><span style="width:${pct}%"></span></div><div class="small">${pct}% complete · ${open} open · ${over} overdue</div>`;insightCards.innerHTML=`<div class="item"><b>${open}</b><span class="small">open</span></div><div class="item"><b>${done}</b><span class="small">done</span></div><div class="item"><b>${paidPendingCount()}</b><span class="small">unpaid</span></div>`;duePressure.innerHTML=`<div class="item"><span>Today</span><span class="pill today">${todayCnt}</span></div><div class="barline"><span style="width:${Math.min(100,todayCnt*18)}%"></span></div><div class="item"><span>Overdue</span><span class="pill overdue">${over}</span></div><div class="barline"><span style="width:${Math.min(100,over*18)}%"></span></div>`;let next=over?tasks.find(t=>t.status!=='done'&&t.due<today()):tasks.find(t=>t.status!=='done'&&t.due===today())||tasks.find(t=>t.status!=='done');nextAction.innerHTML=next?`<div class="item"><div><b>${esc(next.title)}</b><div class="small">${next.due||'No date'} · ${next.priority}</div></div><button class="btn" onclick="show('tasks');openTaskId=${next.id};renderTasks()">Open</button></div>`:'<div class="empty">No active task.</div>'}
function focus(){let list=data.tasks.map(ensure).filter(t=>t.status!=='done'&&(t.due<=today()||!t.due)).slice(0,3);focusTop.innerHTML=list.map((t,i)=>taskRow(t,i)).join('')||'<div class="empty">No focus items.</div>'}
function stats(){let tasks=data.tasks.map(ensure),active=tasks.filter(t=>t.status!=='done'),overdue=tasks.filter(t=>t.status!=='done'&&t.due<today());countUp(kOpen,active.length);countUp(kOverdue,overdue.length);const todayAll=due(today()),todayDone=todayAll.filter(t=>t.status==='done').length;countUp(kToday,todayAll.length-todayDone);countUp(kPendingPay,paidPendingCount());todayTxt.textContent=new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});const totalExpense=data.budgets.reduce((a,b)=>a+b.categories.filter(c=>c.type!=='income').length,0),pendingPay=paidPendingCount();updateKpiRings(tasks.length?Math.round(active.length/tasks.length*100):0,active.length?Math.round(overdue.length/active.length*100):0,todayAll.length?Math.round(todayDone/todayAll.length*100):100,totalExpense?Math.round(pendingPay/totalExpense*100):0);if(todayAll.length&&todayDone===todayAll.length)celebrateIfNeeded();renderActivityHeatmap()}

// ── v9.3: KPI rings, celebration confetti, activity heatmap ───────────────────
function updateKpiRings(pOpen,pOverdue,pToday,pPending){
  const set=(id,p)=>{const el=document.getElementById(id);if(el)el.style.setProperty('--p',Math.max(0,Math.min(100,p)))};
  set('ringOpen',pOpen);set('ringOverdue',pOverdue);set('ringToday',pToday);set('ringPendingPay',pPending);
}
function celebrateIfNeeded(){
  const key='lt_celebrated_'+today()+'_'+((typeof currentUser!=='undefined'&&currentUser)||'guest');
  if(localStorage.getItem(key))return;
  localStorage.setItem(key,'1');
  fireConfetti();
}
function fireConfetti(){
  if(document.body.classList.contains('reduce-motion'))return;
  const colors=[getComputedStyle(document.documentElement).getPropertyValue('--accent'),getComputedStyle(document.documentElement).getPropertyValue('--accent2'),getComputedStyle(document.documentElement).getPropertyValue('--green')];
  for(let i=0;i<32;i++){
    const p=document.createElement('div');p.className='confetti-piece';
    p.style.left=Math.random()*100+'vw';
    p.style.background=colors[i%colors.length].trim()||'#d8b76d';
    p.style.setProperty('--rot',(Math.random()*360-180)+'deg');
    const dur=2.2+Math.random()*1.4;
    p.style.animationDuration=dur+'s';
    p.style.animationDelay=(Math.random()*0.4)+'s';
    document.body.appendChild(p);
    setTimeout(()=>p.remove(),(dur+0.5)*1000);
  }
  toastMsg('🎉 All done for today — nice work!');
}
function renderActivityHeatmap(){
  const wrap=document.getElementById('heatWrap'),rangeEl=document.getElementById('heatRange');
  if(!wrap)return;
  const days=84,counts={};
  (data.tasks||[]).forEach(t=>{if(t.completedAt)counts[t.completedAt]=(counts[t.completedAt]||0)+1});
  const end=new Date();end.setHours(0,0,0,0);
  const start=new Date(end);start.setDate(end.getDate()-(days-1));
  // align start to a Sunday so weeks form clean columns
  start.setDate(start.getDate()-start.getDay());
  const cols=[];let cur=new Date(start);
  while(cur<=end){
    const col=[];
    for(let i=0;i<7;i++){
      const k=dateKey(cur);
      const c=counts[k]||0;
      const lvl=c===0?0:c===1?1:c===2?2:c<=4?3:4;
      const fut=cur>end;
      col.push(`<span class="heat-cell" ${fut?'':`data-l="${lvl}"`} title="${k}: ${c} done"></span>`);
      cur.setDate(cur.getDate()+1);
    }
    cols.push(`<div class="heat-col">${col.join('')}</div>`);
  }
  wrap.innerHTML=cols.join('');
  if(rangeEl)rangeEl.textContent=start.toLocaleDateString('en-US',{month:'short',day:'numeric'})+' – '+end.toLocaleDateString('en-US',{month:'short',day:'numeric'});
}
function storage(){let bytes=new Blob([JSON.stringify(data)]).size;storageBar.style.width=Math.min(100,bytes/(5*1024*1024)*100)+'%';storageTxt.textContent='Browser cache: '+(bytes/1024).toFixed(1)+' KB'}
function renderAll(){if(!data)return;if(typeof updateWeekNum==="function")updateWeekNum();stats();storage();dashboard();focus();renderInsights();renderTasks();renderTemplates();renderCalendar();renderDay();renderNotes();renderBudgets();tickClock()}

// ── Focus timer (ring) ────────────────────────────────────────────────────────
function settingsFocus(){return Number(data.settings.focusDefault||45)}
const RING_CIRC=534; // 2π×85
function startTimer(min){pauseTimer();timerTotal=min*60;remaining=timerTotal;tickRing();timer=setInterval(()=>{remaining--;if(remaining<=0){pauseTimer();remaining=0;toastMsg('Focus complete! 🎉');}tickRing();},1000)}
function pauseTimer(){if(timer){clearInterval(timer);timer=null}}
function resetTimer(){pauseTimer();remaining=timerTotal||settingsFocus()*60;tickRing()}
function tickRing(){const m=Math.floor(remaining/60),s=remaining%60;timerTxt.textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');const pct=timerTotal>0?remaining/timerTotal:1;if(timerRing)timerRing.setAttribute('stroke-dashoffset',RING_CIRC*(1-pct))}

// ── World clock ───────────────────────────────────────────────────────────────
function zoneLabel(zone){return TZ.find(z=>z[1]===zone)?.[0]||zone}
function gmtOffset(zone){try{return new Intl.DateTimeFormat('en-US',{timeZone:zone,timeZoneName:'shortOffset'}).formatToParts(new Date()).find(x=>x.type==='timeZoneName')?.value||'GMT'}catch{return'GMT?'}}
function zoneTime(zone){try{return new Intl.DateTimeFormat([],{timeZone:zone,hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date())}catch{return'--:--'}}
function openWorldChoice(slot){worldSlot=slot;worldModalTitle.textContent='Set World Time '+(slot+1);worldZone.innerHTML=TZ.map(z=>`<option value="${z[1]}">${z[0]} — ${gmtOffset(z[1])}</option>`).join('');worldZone.value=data.settings.world?.[slot]||'Asia/Qatar';openModal('worldModal')}
function saveWorldChoice(){data.settings.world[worldSlot]=worldZone.value;closeModal('worldModal');save();tickClock()}
function tickClock(){const localZone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',now=new Date();if(localClock)localClock.textContent=now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});if(localGmt)localGmt.textContent=gmtOffset(localZone);const zones=(data&&data.settings&&data.settings.world)||['Asia/Qatar','Asia/Manila'];if(worldCards)worldCards.innerHTML=zones.map((z,i)=>`<div class="world-card" onclick="openWorldChoice(${i})"><span class="small">${esc(zoneLabel(z))}</span><b>${zoneTime(z)}</b><span class="pill">${gmtOffset(z)}</span></div>`).join('')}
setInterval(tickClock,1000);

// ── Settings ──────────────────────────────────────────────────────────────────
const themePacks={gold:{accent:'#d8b76d',accent2:'#ff9655'},ocean:{accent:'#4a9eff',accent2:'#00c9ff'},forest:{accent:'#6dcf7a',accent2:'#a8e6cf'},charcoal:{accent:'#b0b0b0',accent2:'#d0d0d0'}};
function applyThemePack(name){const t=themePacks[name];if(!t)return;data.settings.accent=t.accent;data.settings.accent2=t.accent2;document.documentElement.style.setProperty('--accent',t.accent);document.documentElement.style.setProperty('--accent2',t.accent2);if(accentPicker)accentPicker.value=t.accent;save();toastMsg('Theme: '+name)}
function setAccentCustom(v){data.settings.accent=v;document.documentElement.style.setProperty('--accent',v);save()}
function randomFocus(){let list=data.tasks.map(ensure).filter(t=>t.status!=='done');if(!list.length){toastMsg('No active tasks');return}let t=list[Math.floor(Math.random()*list.length)];show('tasks');openTaskId=t.id;renderTasks();toastMsg('Focus: '+t.title)}
function toggleTheme(){LTTheme.toggleMode()}
function setAutoTheme(v){LTTheme.set({auto:!!v})}
function setScale(v){data.settings.scale=Number(v)/100;document.documentElement.style.setProperty('--fs',data.settings.scale);fontLabel.textContent=v+'%';save()}
function setTabScale(v){data.settings.tabScale=Number(v)/100;document.documentElement.style.setProperty('--tabscale',data.settings.tabScale);tabScaleLabel.textContent=v+'%';save()}
function setFont(v){data.settings.font=v;document.documentElement.style.setProperty('--font',v);save()}
function setAccent(v){data.settings.accent=v;document.documentElement.style.setProperty('--accent',v);if(accentPicker)accentPicker.value=v;save()}
function setRadius(v){data.settings.radius=Number(v);document.documentElement.style.setProperty('--r',v+'px');save()}
function setCompact(v){data.settings.compact=!!v;document.documentElement.style.setProperty('--compact',v?1:0);save()}
function setGlass(v){data.settings.glass=!!v;document.body.classList.toggle('glass',!!v);document.documentElement.style.setProperty('--glass',v?1:0);save()}
function togglePastel(v){LTTheme.set({skin:v?'pastel':'gold'})}

function setReduceMotion(v){data.settings.reduceMotion=!!v;document.body.classList.toggle('reduce-motion',!!v);save()}
function setFocusDefault(v){data.settings.focusDefault=Math.max(5,Math.min(120,Number(v||45)));save();resetTimer()}
function setIntroReplay(v){data.settings.introAlways=!!v;save()}
function setBackupHint(v){data.settings.backupHint=!!v;save()}
function setDefaultView(v){data.settings.defaultView=v;save()}


// ── Per-tab Export / Import (v9.4) ────────────────────────────────────────────
// Each tab can export just its own slice and import/merge it back.
const TAB_EXPORT={
  tasks:    {key:'tasks',     kind:'array', label:'Tasks',     refresh:()=>{renderTasks&&renderTasks();stats&&stats();}},
  notes:    {key:'notes',     kind:'array', label:'Notes',     refresh:()=>renderNotes&&renderNotes()},
  finance:  {key:'budgets',   kind:'array', label:'Finance',   refresh:()=>renderBudgets&&renderBudgets()},
  templates:{key:'templates', kind:'object',label:'Templates', refresh:()=>renderTemplates&&renderTemplates()},
};
function exportTab(tab){
  const cfg=TAB_EXPORT[tab];if(!cfg)return;
  const payload={_tab:cfg.key,_label:cfg.label,_owner:currentUser,_exported:new Date().toISOString(),data:data[cfg.key]};
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  a.download='lews-'+cfg.key+'-'+(currentUser||'backup')+'-'+today()+'.json';
  a.click();URL.revokeObjectURL(a.href);
  toastMsg('Exported '+cfg.label);
}
function importTab(tab,e){
  const cfg=TAB_EXPORT[tab];if(!cfg)return;
  const f=e.target.files[0];if(!f){return;}
  const r=new FileReader();
  r.onload=()=>{
    try{
      const raw=JSON.parse(r.result);
      // Accept either a tab-export file ({_tab,data}) or a full backup (pull the slice out)
      let incoming = (raw && raw._tab===cfg.key && 'data' in raw) ? raw.data
                   : (raw && cfg.key in raw) ? raw[cfg.key]
                   : raw;
      if(cfg.kind==='array'){
        if(!Array.isArray(incoming)){alert('That file doesn\'t contain '+cfg.label+' data.');return;}
        const mode=confirm('Import '+cfg.label+': '+incoming.length+' item(s).\n\nOK = Merge with your current '+cfg.label+'\nCancel = Replace your current '+cfg.label);
        if(mode){
          // Merge, skipping duplicates by id when present
          const have=new Set((data[cfg.key]||[]).map(x=>x&&x.id).filter(Boolean));
          const add=incoming.filter(x=>!(x&&x.id&&have.has(x.id)));
          data[cfg.key]=(data[cfg.key]||[]).concat(add);
          toastMsg('Merged '+add.length+' new '+cfg.label.toLowerCase());
        }else{
          if(!confirm('Replace ALL your current '+cfg.label+'? This cannot be undone.')){e.target.value='';return;}
          data[cfg.key]=incoming;
          toastMsg(cfg.label+' replaced');
        }
      }else{ // object (templates)
        if(typeof incoming!=='object'||Array.isArray(incoming)||!incoming){alert('That file doesn\'t contain '+cfg.label+' data.');return;}
        const mode=confirm('Import '+cfg.label+': '+Object.keys(incoming).length+' item(s).\n\nOK = Merge (keep yours, add new)\nCancel = Replace all '+cfg.label);
        if(mode){
          let added=0;
          for(const k in incoming){if(!(k in data[cfg.key])){data[cfg.key][k]=incoming[k];added++;}}
          toastMsg('Merged '+added+' new '+cfg.label.toLowerCase());
        }else{
          if(!confirm('Replace ALL your current '+cfg.label+'? This cannot be undone.')){e.target.value='';return;}
          data[cfg.key]=incoming;
          toastMsg(cfg.label+' replaced');
        }
      }
      save();cfg.refresh&&cfg.refresh();
    }catch(err){alert('Invalid file — could not read '+cfg.label+'.');}
    e.target.value='';
  };
  r.readAsText(f);
}

// ── Export / Import ───────────────────────────────────────────────────────────
function exportData(){const exp=Object.assign({},data,{_owner:currentUser,_version:'v8.2',_exported:new Date().toISOString()});const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(exp,null,2)],{type:'application/json'}));a.download='lews-tracker-'+(currentUser||'backup')+'-'+today()+'.json';a.click();URL.revokeObjectURL(a.href);toastMsg('Downloaded backup for '+currentUser)}
function importData(e){let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{const raw=JSON.parse(r.result);const owner=raw._owner||null;const msg=owner&&owner!==currentUser?'Load setup from "'+owner+'"? Your current data will be replaced.':'Replace your current data with this backup?';if(!confirm(msg))return;const clean=Object.assign(structuredClone(DEF),raw);delete clean._owner;delete clean._version;delete clean._exported;data=clean;save();applySettings();renderAll();toastMsg(owner&&owner!==currentUser?'Loaded setup from '+owner:'Data restored');if(owner&&owner!==currentUser)toastMsg('Tip: templates and tasks from '+owner+' are now loaded');}catch{alert('Invalid backup file')}};r.readAsText(f)}
function resetAll(){if(confirm('Delete ALL your Lew\'s Tracker data on this device?')){data=structuredClone(DEF);save();applySettings();renderAll();toastMsg('Reset complete')}}
function exportTaskReport(){let rows=['Lew\'s Tracker Task Report','Generated: '+new Date().toLocaleString(),''];data.tasks.map(ensure).forEach((t,i)=>{const secs=totalSecs(t);rows.push(`${i+1}. ${t.title}`);rows.push(`   Status: ${statusName(t.status)} | Priority: ${t.priority} | Due: ${t.due||'-'} | Recurring: ${t.recurring}`);if(secs>0)rows.push(`   Time logged: ${fmtSecs(secs)}`);rows.push(`   Tags: ${(t.tags||[]).join(', ')||'-'}`);if(t.refs)rows.push('   Notes: '+t.refs.replace(/\n/g,' / '));if(t.files&&t.files.length)rows.push('   Files: '+t.files.map(f=>f.name).join(', '));rows.push('')});let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/plain'}));a.download='lews-tracker-tasks-'+today()+'.txt';a.click();URL.revokeObjectURL(a.href)}


// ── Excel Finance Export (ExcelJS lazy-loaded, xlsx skill standards) ──────
let _ejsReady = false;
function _loadEjs() {
  return new Promise((res, rej) => {
    if (window.ExcelJS) { res(); return; }
    const s = document.createElement('script');
    s.src = 'lib/exceljs.min.js';
    s.onload = () => { _ejsReady = true; res(); };
    s.onerror = () => rej(new Error('Could not load ExcelJS CDN'));
    document.head.appendChild(s);
  });
}

async function exportFinanceExcel() {
  if (!data.budgets.length) { toastMsg('No budgets to export'); return; }
  toastMsg('Building Excel…');
  try { await _loadEjs(); } catch(e) { toastMsg('No internet — Excel export needs CDN'); return; }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Lew's Tracker";
  wb.created = new Date();

  const GOLD_FILL = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFD8B76D' } };
  const BLUE_FILL = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFE8F4FF' } };
  const GREEN_FILL= { type:'pattern', pattern:'solid', fgColor:{ argb:'FFE8FFE8' } };
  const AMBER_FILL= { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFFF0E0' } };
  const SUMM_FILL = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFFF8E8' } };
  const HDR_FONT  = { name:'Arial', bold:true, size:10, color:{ argb:'FF0A0908' } };
  const BODY_FONT = { name:'Arial', size:10 };
  const bdr = { style:'thin', color:{ argb:'FFCCCCCC' } };
  const borders = { top:bdr, bottom:bdr, left:bdr, right:bdr };

  function applyHeader(row) {
    row.eachCell(c => { c.font = HDR_FONT; c.fill = GOLD_FILL; c.border = borders; c.alignment = { vertical:'middle' }; });
    row.height = 20;
  }
  function applyData(row, fill) {
    row.eachCell(c => { c.font = BODY_FONT; if (fill) c.fill = fill; c.border = borders; c.alignment = { vertical:'middle' }; });
  }

  // ─── Summary sheet ────────────────────────────────────────────────────────
  const ws = wb.addWorksheet('Summary');
  ws.columns = [
    { key:'n', width:28 },{ key:'c', width:8 },
    { key:'i', width:16 },{ key:'e', width:16 },
    { key:'b', width:16 },{ key:'p', width:16 },{ key:'u', width:16 },
  ];

  const tr = ws.addRow(["Lew's Tracker — Finance Export",'','','','','','']);
  tr.getCell(1).font = { name:'Arial', bold:true, size:14, color:{ argb:'FF8B6914' } };
  ws.mergeCells('A1:G1');

  const dr = ws.addRow(['Generated: ' + new Date().toLocaleString()]);
  dr.getCell(1).font = { name:'Arial', size:9, color:{ argb:'FF888888' } };
  ws.mergeCells('A2:G2');
  ws.addRow([]);

  const hdr = ws.addRow(['Budget','Currency','Income','Expense','Balance','Paid','Pending']);
  applyHeader(hdr);

  const rowStart = 5;
  data.budgets.forEach(b => {
    const t = totals(b);
    const curr = b.currency || 'USD';
    const sym = (CURRENCIES[curr] || curr + ' ').trim();
    const fmt = '"' + sym + '"#,##0;("' + sym + '"#,##0);"-"';
    const row = ws.addRow([b.name, curr, t.inc, t.exp, t.bal, t.paid, t.unpaid]);
    ['C','D','E','F','G'].forEach((col, ci) => {
      const c = row.getCell(ci + 3);
      c.numFmt = fmt;
    });
    const balCell = row.getCell(5);
    balCell.font = { name:'Arial', size:10, color:{ argb: t.bal >= 0 ? 'FF006400' : 'FFC00000' } };
    applyData(row, SUMM_FILL);
  });

  ws.addRow([]);
  const rowEnd = rowStart + data.budgets.length - 1;
  const tot = ws.addRow(['TOTAL','',`=SUM(C${rowStart}:C${rowEnd})`,`=SUM(D${rowStart}:D${rowEnd})`,`=SUM(E${rowStart}:E${rowEnd})`,`=SUM(F${rowStart}:F${rowEnd})`,`=SUM(G${rowStart}:G${rowEnd})`]);
  tot.eachCell(c => { c.font = { name:'Arial', bold:true, size:10 }; c.border = borders; });

  // ─── Per-budget sheets ────────────────────────────────────────────────────
  data.budgets.forEach(b => {
    const name = b.name.replace(/[\\/*?[\]:]/g,'').substring(0, 31);
    const s = wb.addWorksheet(name);
    const curr = b.currency || 'USD';
    const sym  = (CURRENCIES[curr] || curr + ' ').trim();
    const fmt  = '"' + sym + '"#,##0;("' + sym + '"#,##0);"-"';
    s.columns = [{ key:'cat', width:32 },{ key:'type', width:12 },{ key:'amt', width:16 },{ key:'stat', width:14 }];

    const btRow = s.addRow([b.name + ' — ' + curr]);
    btRow.getCell(1).font = { name:'Arial', bold:true, size:13, color:{ argb:'FF8B6914' } };
    s.mergeCells('A1:D1');
    s.addRow([]);

    const bh = s.addRow(['Category','Type','Amount (' + curr + ')','Status']);
    applyHeader(bh);

    // Blue=income, Green=paid expense, Amber=unpaid expense  (xlsx skill color coding)
    b.categories.forEach(c => {
      const fill = c.type === 'income' ? BLUE_FILL : (c.paid ? GREEN_FILL : AMBER_FILL);
      const row = s.addRow([c.name, c.type === 'income' ? 'Income' : 'Expense', c.amount || 0, c.type !== 'income' ? (c.paid ? 'Paid ✓' : 'Pending') : '—']);
      row.getCell(3).numFmt = fmt;
      applyData(row, fill);
      if (c.paid && c.type !== 'income') row.getCell(4).font = { name:'Arial', size:10, color:{ argb:'FF006400' }, bold:true };
    });

    const t = totals(b);
    s.addRow([]);
    [['Total Income', t.inc, '0070C0'], ['Total Expense', t.exp, 'C00000'],
     ['Balance', t.bal, t.bal >= 0 ? '006400' : 'C00000'],
     ['Paid', t.paid, '006400'], ['Pending', t.unpaid, 'C07000']].forEach(([label, val, col]) => {
      const r = s.addRow([label, '', val, '']);
      r.getCell(1).font = { name:'Arial', bold:true, size:10 };
      r.getCell(3).font = { name:'Arial', size:10, color:{ argb:'FF' + col }, bold:true };
      r.getCell(3).numFmt = fmt;
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'lews-tracker-finance-' + today() + '.xlsx'; a.click();
  URL.revokeObjectURL(url);
  toastMsg('Finance exported to Excel ✓');
}

// ── Word Task Export (Office-compatible HTML, no CDN needed) ──────────────
function exportTaskDocx() {
  const tasks2 = data.tasks.map(ensure);
  const priC = { high:'#FFEBEB', medium:'#FFFBEB', low:'#EBFFEB' };
  const priT = { high:'#C00000', medium:'#8B6914', low:'#006400' };

  const openC = tasks2.filter(t => t.status !== 'done').length;
  const doneC = tasks2.filter(t => t.status === 'done').length;
  const overC = tasks2.filter(t => t.status !== 'done' && t.due && t.due < today()).length;
  const timeT = tasks2.reduce((a,t) => a + totalSecs(t), 0);

  let h = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Task Report</title>
<style>
body{font-family:Arial,sans-serif;font-size:11pt;color:#333;margin:2cm}
h1{color:#8B6914;font-size:18pt;border-bottom:3px solid #d8b76d;padding-bottom:6px}
h2{color:#5a4a0a;font-size:13pt;margin:18px 0 8px}
.meta{font-size:9pt;color:#888;margin-bottom:14px}
.sum{background:#FDF8EE;padding:9px 14px;border-left:5px solid #d8b76d;margin:12px 0;font-size:10.5pt;font-weight:bold}
table{border-collapse:collapse;width:100%;margin:8px 0;font-size:10pt}
th{background:#D8B76D;color:#0A0908;font-weight:bold;padding:6px 9px;text-align:left;border:1px solid #B89A50}
td{padding:5px 9px;border:1px solid #DDD;vertical-align:top}
.done td{color:#999;text-decoration:line-through}
.foot{color:#AAA;font-size:8pt;margin-top:28px;border-top:1px solid #EEE;padding-top:8px;text-align:center}
</style></head><body>`;

  h += `<h1>Lew's Tracker — Task Report</h1>
<p class="meta">Generated: ${new Date().toLocaleString()}</p>
<div class="sum">${tasks2.length} total &nbsp;·&nbsp; ${openC} open &nbsp;·&nbsp; ${doneC} done &nbsp;·&nbsp; ${overC} overdue${timeT > 0 ? ' &nbsp;·&nbsp; Time: ' + fmtSecs(timeT) : ''}</div>
<h2>To Do List</h2>
<table><tr><th width="30%">Title</th><th width="9%">Priority</th><th width="11%">Status</th><th width="10%">Due</th><th width="8%">Time</th><th width="12%">Tags</th><th width="10%">Recurring</th></tr>`;

  tasks2.forEach(t => {
    const bg = t.status === 'done' ? '#F5F5F5' : (priC[t.priority] || '#FFF');
    const secs = totalSecs(t);
    const tags = (t.tags || []).map(g => '#' + esc(g)).join(', ');
    const rec = t.recurring && t.recurring !== 'none' ? '↺ ' + t.recurring : '—';
    h += `<tr class="${t.status === 'done' ? 'done' : ''}" style="background:${bg}">
<td><b>${esc(t.title)}</b>${t.refs ? '<br><small style="color:#666">' + esc(t.refs.substring(0,100)) + '</small>' : ''}${t.files&&t.files.length ? '<br><small style="color:#666">Files: ' + t.files.map(f=>esc(f.name)).join(', ') + '</small>' : ''}</td>
<td style="color:${priT[t.priority]||'#333'};font-weight:bold">${t.priority}</td>
<td>${statusName(t.status)}</td><td>${t.due || '—'}</td>
<td style="color:${secs > 0 ? '#006400' : '#888'}">${secs > 0 ? fmtSecs(secs) : '—'}</td>
<td>${tags || '—'}</td><td>${rec}</td></tr>`;
    if (t.checklist && t.checklist.length) {
      const dc = t.checklist.filter(c => c.done).length;
      h += `<tr style="background:#F9F9F9"><td colspan="7" style="font-size:9pt;color:#555">Checklist ${dc}/${t.checklist.length}: ${t.checklist.map(c => (c.done ? '☑' : '☐') + ' ' + esc(c.text)).join(' · ')}</td></tr>`;
    }
  });
  h += '</table>';

  if (data.notes.length) {
    h += `<h2>Notes (${data.notes.length})</h2><table><tr><th width="25%">Title</th><th width="15%">Date</th><th>Content</th></tr>`;
    data.notes.forEach(n => {
      h += `<tr><td><b>${esc(n.title)}</b></td><td>${n.created || ''}</td><td>${esc((n.body || '').substring(0, 280))}</td></tr>`;
    });
    h += '</table>';
  }

  h += `<p class="foot">Lew's Tracker v10 &nbsp;·&nbsp; ${new Date().toLocaleString()} &nbsp;·&nbsp; For Melliea &#9825;</p><\/body><\/html>`;

  const blob = new Blob(['﻿' + h], { type:'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'lews-tracker-tasks-' + today() + '.doc'; a.click();
  URL.revokeObjectURL(url);
  toastMsg('Tasks exported to Word ✓');
}


// ── Appearance Studio v8.7 ───────────────────────────────────────────────────
const APPEARANCE_PRESETS={
  'BIM Dark':{theme:'dark',accent:'#d8b76d',accent2:'#ff9655',bgStyle:'bim-grid',density:'standard',animLevel:'balanced',rowStyle:'stripe',glass:true,compact:false,radius:22,iconStyle:'emoji',font:'Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif'},
  'Site Light':{theme:'light',accent:'#a07830',accent2:'#cc6622',bgStyle:'minimal',density:'comfortable',animLevel:'subtle',rowStyle:'card',glass:false,compact:false,radius:18,iconStyle:'text'},
  'Presentation Gold':{theme:'dark',accent:'#d8b76d',accent2:'#ffeab0',bgStyle:'glow',density:'comfortable',animLevel:'full',rowStyle:'card',glass:true,compact:false,radius:28,iconStyle:'emoji'},
  'Eye Comfort':{theme:'pastel',pastel:true,accent:'#a08050',accent2:'#c09060',bgStyle:'minimal',density:'standard',animLevel:'subtle',rowStyle:'minimal',glass:false,compact:false,radius:20,iconStyle:'symbol'},
  'Compact Dashboard':{theme:'dark',accent:'#8db9ff',accent2:'#4a9eff',bgStyle:'flat',density:'compact',animLevel:'balanced',rowStyle:'table',glass:false,compact:true,radius:14,iconStyle:'symbol'},
  'OLED Black':{theme:'dark',accent:'#d8b76d',accent2:'#97dc8d',bgStyle:'flat',density:'ultra',animLevel:'none',rowStyle:'minimal',glass:false,compact:true,radius:12,iconStyle:'text'},
  'Blueprint Blue':{theme:'dark',accent:'#4a9eff',accent2:'#00c9ff',bgStyle:'blueprint',density:'standard',animLevel:'balanced',rowStyle:'table',glass:true,radius:18,iconStyle:'symbol'},
  'Doha Sand':{theme:'pastel',pastel:true,accent:'#b08a55',accent2:'#d8a45f',bgStyle:'minimal',density:'comfortable',animLevel:'subtle',rowStyle:'card',glass:false,radius:24,iconStyle:'emoji'},
  'MEP Cyan':{theme:'dark',accent:'#00c9c9',accent2:'#8db9ff',bgStyle:'bim-grid',density:'compact',animLevel:'balanced',rowStyle:'stripe',glass:true,radius:18,iconStyle:'symbol'},
  'Coordination Orange':{theme:'dark',accent:'#ff9655',accent2:'#ff7474',bgStyle:'glow',density:'standard',animLevel:'full',rowStyle:'stripe',glass:true,radius:20,iconStyle:'emoji'}
};
function clearAppearanceClasses(){document.body.classList.remove('bg-minimal','bg-flat','bg-blueprint','bg-bim-grid','bg-glow','bg-aurora','density-comfort','density-standard','density-compact','density-ultra','anim-none','anim-subtle','row-table','row-card','row-minimal','icons-text','icons-symbol');}
function setBackgroundStyle(v){data.settings.bgStyle=v||'default';applyAppearanceClasses();save();}
function setDensity(v){data.settings.density=v||'standard';applyAppearanceClasses();save();}
function setAnimationLevel(v){data.settings.animLevel=v||'balanced';applyAppearanceClasses();save();}
function setTaskRowStyle(v){data.settings.rowStyle=v||'stripe';applyAppearanceClasses();save();renderTasks();}
function setIconStyle(v){data.settings.iconStyle=v||'emoji';applyAppearanceClasses();save();}
function setBranding(){data.settings.brandTitle=(brandTitleInput.value||"Lew's Tracker").trim();data.settings.brandSub=(brandSubInput.value||'BIM Command Center').trim();data.settings.brandLogo=(brandLogoInput.value||'L').trim().slice(0,2);applyBranding();save();}
function applyBranding(){const s=data.settings||{};document.querySelectorAll('.brand h1').forEach(x=>x.textContent=s.brandTitle||"Lew's Tracker");document.querySelectorAll('.brand p').forEach(x=>x.textContent=s.brandSub||'v10 · BIM Command Center');document.querySelectorAll('.logo,.login-logo').forEach(x=>x.textContent=s.brandLogo||'L');if(brandTitleInput)brandTitleInput.value=s.brandTitle||"Lew's Tracker";if(brandSubInput)brandSubInput.value=s.brandSub||'BIM Command Center';if(brandLogoInput)brandLogoInput.value=s.brandLogo||'L';}
function setCustomCss(v){data.settings.customCss=v||'';applyCustomCss();save();}
function applyCustomCss(){let st=document.getElementById('customCssStyle');if(!st){st=document.createElement('style');st.id='customCssStyle';document.head.appendChild(st);}st.textContent=(data.settings&&data.settings.customCss)||'';if(customCssBox)customCssBox.value=(data.settings&&data.settings.customCss)||'';}
function applyAppearancePreset(name){const p=APPEARANCE_PRESETS[name];if(!p)return;data.settings=Object.assign(data.settings,p);if(p.theme==='pastel'){data.settings.pastel=true}else if(p.theme==='light'){data.settings.pastel=false}else{data.settings.pastel=false}if(p.theme)LTTheme.set({skin:p.theme==='pastel'?'pastel':(LTTheme.raw().skin==='pastel'?'gold':LTTheme.raw().skin),mode:p.theme==='light'?'light':'dark',auto:false});applySettings();save();renderAll();toastMsg('Preset applied: '+name);}
function renderAppearancePresets(){const el=document.getElementById('appearancePresets');if(!el)return;el.innerHTML=Object.keys(APPEARANCE_PRESETS).map(n=>`<button class="preset-card" onclick="applyAppearancePreset('${n.replace(/'/g,"\\'")}')"><b>${n}</b><span>${APPEARANCE_PRESETS[n].bgStyle||'default'} · ${APPEARANCE_PRESETS[n].density||'standard'}</span></button>`).join('');}
function applyAppearanceClasses(){const s=data.settings||{};clearAppearanceClasses();if(s.bgStyle&&s.bgStyle!=='default')document.body.classList.add('bg-'+s.bgStyle);document.body.classList.add('density-'+(s.density||'compact'));if(s.animLevel==='none')document.body.classList.add('anim-none');if(s.animLevel==='subtle')document.body.classList.add('anim-subtle');if(s.rowStyle==='table')document.body.classList.add('row-table');if(s.rowStyle==='card')document.body.classList.add('row-card');if(s.rowStyle==='minimal')document.body.classList.add('row-minimal');if(s.iconStyle==='text')document.body.classList.add('icons-text');if(s.iconStyle==='symbol')document.body.classList.add('icons-symbol');if(bgStyleSelect)bgStyleSelect.value=s.bgStyle||'default';if(densitySelect)densitySelect.value=s.density||'compact';if(animLevelSelect)animLevelSelect.value=s.animLevel||'balanced';if(rowStyleSelect)rowStyleSelect.value=s.rowStyle||'stripe';if(iconStyleSelect)iconStyleSelect.value=s.iconStyle||'emoji';}
function resetAppearanceOnly(){if(!confirm('Reset appearance only? Tasks, notes, budgets, and files will stay.'))return;const keep={theme:'dark',scale:1,tabScale:1,financeScale:1,compact:false,glass:false,reduceMotion:false,autoTheme:false,accent:'#d8b76d',accent2:'#ff9655',radius:22,font:DEF.settings.font,bgStyle:'default',density:'compact',animLevel:'balanced',rowStyle:'stripe',iconStyle:'emoji',brandTitle:"Lew's Tracker",brandSub:'BIM Command Center',brandLogo:'L',customCss:''};Object.assign(data.settings,keep);applySettings();save();toastMsg('Appearance reset');}
function exportTheme(){const keys=['theme','pastel','scale','tabScale','financeScale','compact','glass','reduceMotion','autoTheme','accent','accent2','radius','font','bgStyle','density','animLevel','rowStyle','iconStyle','brandTitle','brandSub','brandLogo','customCss'];const theme={_type:'lews-tracker-theme',_version:'v8.7'};keys.forEach(k=>theme[k]=data.settings[k]);const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(theme,null,2)],{type:'application/json'}));a.download='lews-tracker-theme-'+today()+'.json';a.click();URL.revokeObjectURL(a.href);toastMsg('Theme exported');}
function importTheme(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const theme=JSON.parse(r.result);if(theme._type!=='lews-tracker-theme'&&!confirm('This does not look like a theme file. Import anyway?'))return;Object.assign(data.settings,theme);delete data.settings._type;delete data.settings._version;applySettings();save();toastMsg('Theme imported');}catch{alert('Invalid theme JSON')}};r.readAsText(f);e.target.value='';}
// ── Apply settings on load ────────────────────────────────────────────────────
function applySettings(){const s=data.settings;if(!LTTheme.has()||LTTheme.raw()._fromLogin)LTTheme.set({skin:s.mellieaTheme?'rose':(s.pastel?'pastel':'gold'),mode:s.theme==='light'?'light':'dark',auto:!!s.autoTheme,_fromLogin:false});else LTTheme.apply();if(s.glass)document.body.classList.add('glass');document.documentElement.style.setProperty('--fs',s.scale||1);document.documentElement.style.setProperty('--tabscale',s.tabScale||1);document.documentElement.style.setProperty('--finScale',s.financeScale||1);document.documentElement.style.setProperty('--accent',s.accent||'#d8b76d');document.documentElement.style.setProperty('--accent2',s.accent2||'#ff9655');document.documentElement.style.setProperty('--r',(s.radius||22)+'px');document.documentElement.style.setProperty('--compact',s.compact?1:0);document.documentElement.style.setProperty('--glass',s.glass?1:0);document.documentElement.style.setProperty('--font',s.font||DEF.settings.font);if(fontRange)fontRange.value=Math.round((s.scale||1)*100);if(fontLabel)fontLabel.textContent=fontRange.value+'%';if(tabScaleRange)tabScaleRange.value=Math.round((s.tabScale||1)*100);if(tabScaleLabel)tabScaleLabel.textContent=tabScaleRange.value+'%';if(financeScaleRange)financeScaleRange.value=Math.round((s.financeScale||1)*100);if(financeScaleLabel)financeScaleLabel.textContent=financeScaleRange.value+'%';if(fontSelect)fontSelect.value=s.font||DEF.settings.font;if(accentSelect)accentSelect.value=s.accent||'#d8b76d';if(accentPicker)accentPicker.value=s.accent||'#d8b76d';if(radiusRange)radiusRange.value=s.radius||22;if(compactToggle)compactToggle.checked=!!s.compact;if(glassToggle)glassToggle.checked=!!s.glass;if(autoThemeToggle)autoThemeToggle.checked=!!s.autoTheme;if(reduceMotionToggle)reduceMotionToggle.checked=!!s.reduceMotion;if(introToggle)introToggle.checked=!!s.introAlways;var pastelT=document.getElementById("pastelToggle");if(pastelT)pastelT.checked=!!s.pastel;var mellieaT=document.getElementById("mellieaToggle");if(mellieaT)mellieaT.checked=!!s.mellieaTheme;if(typeof toggleMellieaTheme==='function')toggleMellieaTheme(!!s.mellieaTheme);if(autoBackupHint)autoBackupHint.checked=!!s.backupHint;if(defaultView)defaultView.value=s.defaultView||'dashboard';if(focusDefault)focusDefault.value=s.focusDefault||45;const ps=document.getElementById('petAutoShow');if(ps)ps.checked=!!s.petAutoShow;const pm=document.getElementById('petModeSelect');if(pm)pm.value=s.petMode||'gamepad';const psr=document.getElementById('petSizeRange');if(psr){psr.value=Math.round((s.petScale||1)*100);const pl=document.getElementById('petSizeLbl');if(pl)pl.textContent=psr.value+'%';}const por=document.getElementById('petOpRange');if(por){por.value=Math.round((s.petOpacity||1)*100);const ol=document.getElementById('petOpLbl');if(ol)ol.textContent=por.value+'%';}const css=document.getElementById('clockStyleSelect');if(css)css.value=s.clockStyle||0;document.documentElement.style.setProperty('--pet-scale',s.petScale||1);document.documentElement.style.setProperty('--pet-opacity',s.petOpacity||1);if(taskSort)taskSort.value=s.sort||'dueAsc';document.querySelectorAll('#currentUserLabel,#currentUserLabel2').forEach(ul=>{if(currentUser)ul.textContent=currentUser;});// Auto system theme listener
  applyAppearanceClasses();applyBranding();applyCustomCss();renderAppearancePresets();}


// ── StringTune-style scroll animation engine ─────────────────────────────────
(function initScrollAnimations() {
  const introEl = document.getElementById('intro');
  const progressFill = document.getElementById('introProgressFill');
  const progressBar = document.getElementById('introProgress');
  const scrollCue = document.querySelector('.scroll-cue');
  const dots = document.querySelectorAll('.intro-dot-btn');
  const slideIds = ['introSlide0','introSlide1','introSlide2','introSlide3','introSlide4','introSlide5','introSlide6','introSlideEnd'];
  const slides = slideIds.map(id => document.getElementById(id)).filter(Boolean);
  const heroGrid = document.querySelector('.intro-grid');
  const heroText = heroGrid ? heroGrid.querySelector('div:first-child') : null;
  const orb = document.querySelector('.orb');
  const h1 = document.querySelector('.intro h1');
  const particlesEl = document.getElementById('introParticles');

  if (!introEl) return;

  // ── Block scroll from leaking to body (overscroll-behavior) ──
  introEl.style.overscrollBehavior = 'contain';

  // Also prevent wheel events from propagating when at scroll boundaries
  introEl.addEventListener('wheel', e => {
    const atTop = introEl.scrollTop <= 0 && e.deltaY < 0;
    const atBottom = introEl.scrollTop + introEl.clientHeight >= introEl.scrollHeight - 2 && e.deltaY > 0;
    if (atTop || atBottom) e.preventDefault();
  }, { passive: false });

  // Block touchmove propagation too
  let _touchStartY = 0;
  introEl.addEventListener('touchstart', e => { _touchStartY = e.touches[0].clientY; }, { passive: true });
  introEl.addEventListener('touchmove', e => {
    const deltaY = _touchStartY - e.touches[0].clientY;
    const atTop = introEl.scrollTop <= 0 && deltaY < 0;
    const atBottom = introEl.scrollTop + introEl.clientHeight >= introEl.scrollHeight - 2 && deltaY > 0;
    if (atTop || atBottom) e.preventDefault();
  }, { passive: false });

  // ── Create floating particles ──
  if (particlesEl) {
    for (let i = 0; i < 18; i++) {
      const p = document.createElement('div');
      p.className = 'intro-particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDuration = (6 + Math.random() * 10) + 's';
      p.style.animationDelay = Math.random() * 8 + 's';
      p.style.width = p.style.height = (2 + Math.random() * 3) + 'px';
      p.style.background = Math.random() > 0.5 ? 'var(--accent)' : 'var(--accent2)';
      particlesEl.appendChild(p);
    }
  }

  // ── Smooth scroll helper ──
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const st = introEl.scrollTop;
      const maxScroll = introEl.scrollHeight - introEl.clientHeight;
      const progress = maxScroll > 0 ? st / maxScroll : 0;
      const vh = introEl.clientHeight;

      // 1. Scroll progress bar
      if (progressFill) progressFill.style.width = (progress * 100) + '%';

      // 2. Fade scroll cue after 80px
      if (scrollCue) scrollCue.classList.toggle('faded', st > 80);

      // 3. Hero parallax — text moves slower, orb moves faster
      if (heroText && st < vh * 1.5) {
        const heroProgress = Math.min(st / vh, 1);
        heroText.style.transform = 'translateY(' + (heroProgress * -30) + 'px)';
        if (orb) orb.style.transform = 'translateY(' + (heroProgress * 50) + 'px) scale(' + (1 - heroProgress * 0.15) + ')';
      }

      // 4. Scroll-driven headline shimmer
      if (h1) h1.style.setProperty('--scroll-shimmer', (progress * 280) + '%');

      // 5. Active dot tracking
      const mid = st + vh * 0.45;
      let active = 0;
      slides.forEach((s, i) => { if (s && s.offsetTop <= mid) active = i; });
      dots.forEach((d, i) => d.classList.toggle('active', i === active));

      // 6. Per-slide scroll-driven transforms
      slides.forEach((slide, i) => {
        if (i === 0) return; // hero slide handled separately
        const rect = slide.getBoundingClientRect();
        const slideTop = slide.offsetTop;
        const slideH = slide.offsetHeight;
        const relativeScroll = st + vh - slideTop;
        const slideProgress = Math.max(0, Math.min(relativeScroll / (vh + slideH), 1));

        // Entering zone: 0 → 0.35 | Visible zone: 0.35 → 0.7 | Exiting zone: 0.7 → 1
        if (slideProgress > 0.12 && slideProgress < 0.75) {
          slide.classList.add('visible');
          slide.classList.remove('exiting');
        } else if (slideProgress >= 0.75) {
          slide.classList.add('exiting');
          slide.classList.remove('visible');
        } else {
          slide.classList.remove('visible', 'exiting');
        }

        // Parallax on slide card — slight vertical offset
        const card = slide.querySelector('.slide-card');
        if (card && slideProgress > 0.1 && slideProgress < 0.9) {
          const cardParallax = (slideProgress - 0.5) * 25;
          card.style.transform = slide.classList.contains('visible') ? 'translateY(' + cardParallax + 'px)' : '';
        }
      });

      ticking = false;
    });
  }

  introEl.addEventListener('scroll', onScroll, { passive: true });
  // Initial run
  onScroll();

  // ── Dot navigation ──
  window.scrollIntroTo = function(idx) {
    const el = document.getElementById(slideIds[idx]);
    if (el && introEl) introEl.scrollTo({ top: el.offsetTop, behavior: 'smooth' });
  };

  // ── Hide dots + progress when intro closes ──
  const _origCloseIntro = window.closeIntro;
  window.closeIntro = function() {
    if (_origCloseIntro) _origCloseIntro();
    const dotsEl = document.getElementById('introDots');
    if (dotsEl) dotsEl.classList.add('hide');
    if (progressBar) progressBar.style.display = 'none';
    if (particlesEl) particlesEl.style.display = 'none';
  };
})();


// ── Login UX helpers v8.7 ────────────────────────────────────────────────────
function togglePwd(id,btn){const el=document.getElementById(id);if(!el)return;el.type=el.type==='password'?'text':'password';if(btn)btn.textContent=el.type==='password'?'👁':'🙈';}
function updatePwdStrength(v){const bar=document.getElementById('pwdStrength');if(!bar)return;bar.className='login-strength';if((v||'').length>=8&&/[A-Z]/.test(v)&&/[0-9]/.test(v))bar.classList.add('good');else if((v||'').length>=4)bar.classList.add('ok');const span=bar.querySelector('span');if(span&&!bar.classList.contains('ok')&&!bar.classList.contains('good'))span.style.width=v?Math.min(45,v.length*10)+'%':'0';}
function setAuthBusy(btnText){const btn=[...document.querySelectorAll('#loginForm .btn.primary,#registerForm .btn.primary,#recoveryForm .btn.primary')].find(b=>b.offsetParent!==null);if(btn){btn.dataset.oldText=btn.textContent;btn.textContent=btnText||'Working…';btn.disabled=true;}return btn;}
function clearAuthBusy(btn){if(btn){btn.textContent=btn.dataset.oldText||btn.textContent;btn.disabled=false;}}
function forceReturnLogin(){clearSession();currentUser=null;data=null;STORE=null;document.querySelectorAll('.modal.show').forEach(m=>m.classList.remove('show'));const ls=document.getElementById('loginScreen');if(ls)ls.classList.add('show');showSignIn();}
// ── Auth system v8.2 ──────────────────────────────────────────────────────────
const USERS_KEY='lews_tracker_v82_users';
const SESSION_KEY='lews_tracker_v82_session';
let currentUser=null;

// PBKDF2: 100k iterations + unique random salt per user (browser-native, slow-hash)
function _hex(buf){return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('')}
function _unhex(s){return new Uint8Array(s.match(/.{2}/g).map(h=>parseInt(h,16)))}
async function sha256Hex(str){if(window.crypto&&crypto.subtle){const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str));return _hex(buf);}let h1=0x811c9dc5,h2=0x01000193;for(let i=0;i<str.length;i++){const c=str.charCodeAt(i);h1^=c;h1=Math.imul(h1,0x01000193);h2=(h2+c+((h2<<5)-h2))|0;}const a=(h1>>>0).toString(16).padStart(8,'0'),b=(h2>>>0).toString(16).padStart(8,'0');return(a+b+a+b).padEnd(64,'0').slice(0,64);}
async function hashPwd(pwd,saltHex){if(window.crypto&&crypto.subtle&&crypto.getRandomValues){const salt=saltHex?_unhex(saltHex):crypto.getRandomValues(new Uint8Array(16));const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pwd),{name:'PBKDF2'},false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},key,256);return{hash:_hex(bits),salt:_hex(salt),algo:'PBKDF2'};}const salt=saltHex||('fallback-'+Date.now()+'-'+Math.random());return{hash:await sha256Hex(salt+'|'+pwd),salt,algo:'FALLBACK'};}
async function verifyPwd(pwd,storedHash,storedSalt){if(storedSalt){const result=await hashPwd(pwd,storedSalt);if(result.hash===storedHash)return true;}if(!storedSalt&&storedHash){const legacy=await sha256Hex(pwd);if(legacy===storedHash)return true;}return false;}
function getUsers(){try{return JSON.parse(localStorage.getItem(USERS_KEY)||'[]')}catch{return[]}}
function saveUsers(u){localStorage.setItem(USERS_KEY,JSON.stringify(u))}
function getSession(){
  try{const raw=sessionStorage.getItem(SESSION_KEY)||localStorage.getItem(SESSION_KEY)||'null';const s=JSON.parse(raw);return s&&s.expires>Date.now()?s:null}catch{return null}
}
function setSession(u){
  const remember=document.getElementById('rememberMe')&&document.getElementById('rememberMe').checked;
  const expires=Date.now()+(remember?365*864e5:12*60*60*1000);
  const payload=JSON.stringify({username:u,expires,remember});
  sessionStorage.removeItem(SESSION_KEY);localStorage.removeItem(SESSION_KEY);
  if(remember)localStorage.setItem(SESSION_KEY,payload);else sessionStorage.setItem(SESSION_KEY,payload);
}
function clearSession(){localStorage.removeItem(SESSION_KEY);sessionStorage.removeItem(SESSION_KEY)}

function showLoginError(m){const el=document.getElementById('loginErr');if(el){el.textContent=m;}}
function showRegError(m){const el=document.getElementById('regErr');if(el){el.textContent=m;}}
function showRegister(){
  document.getElementById('loginForm').style.display='none';
  document.getElementById('registerForm').style.display='block';
  setTimeout(()=>document.getElementById('regUsername').focus(),60);
}
function showSignIn(){
  document.getElementById('registerForm').style.display='none';
  document.getElementById('loginForm').style.display='block';
  var rf=document.getElementById('recoveryForm');if(rf)rf.style.display='none';
  setTimeout(()=>document.getElementById('loginUsername').focus(),60);
}

// renderQuickUsers removed in v8.5 — user list hidden for security

async function doLogin(){const btn=setAuthBusy('Signing in…');try{await doLogin_core();}catch(e){const msg=e&&(e.message||e)?(e.message||e):'Unknown error';const target=document.getElementById('loginErr');if(target)target.textContent='Error: '+msg;}finally{clearAuthBusy(btn);}}
async function doLogin_core(){
  const username=(document.getElementById('loginUsername').value||'').trim();
  const password=document.getElementById('loginPassword').value||'';
  if(!username||!password){showLoginError('Enter username and password');return;}
  const users=getUsers();
  const user=users.find(u=>u.username.toLowerCase()===username.toLowerCase());
  if(!user){showLoginError('User not found — create an account first');return;}
  const valid=await verifyPwd(password,user.hash,user.salt||'');
  if(!valid){showLoginError('Wrong password');return;}
  currentUser=user.username;
  setSession(user.username);
  enterApp();
}
document.getElementById('loginPassword')?.addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
document.getElementById('loginUsername')?.addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('loginPassword').focus();});

async function doRegister(){const btn=setAuthBusy('Creating…');try{await doRegister_core();}catch(e){const msg=e&&(e.message||e)?(e.message||e):'Unknown error';const target=document.getElementById('regErr');if(target)target.textContent='Error: '+msg;}finally{clearAuthBusy(btn);}}
async function doRegister_core(){
  const username=(document.getElementById('regUsername').value||'').trim();
  const pwd=document.getElementById('regPassword').value||'';
  const pwd2=document.getElementById('regPassword2').value||'';
  if(!username){showRegError('Choose a username');return;}
  if(username.length<2){showRegError('Username must be at least 2 characters');return;}
  if(/[^a-zA-Z0-9_.-]/.test(username)){showRegError('Username: letters, numbers, _ . - only');return;}
  if(!pwd){showRegError('Choose a password');return;}
  if(pwd.length<4){showRegError('Password must be at least 4 characters');return;}
  if(pwd!==pwd2){showRegError('Passwords do not match');return;}
  const users=getUsers();
  if(users.find(u=>u.username.toLowerCase()===username.toLowerCase())){showRegError('Username already taken');return;}
  const {hash,salt}=await hashPwd(pwd);
  const secQ=document.getElementById('regSecQ')?.value||'';
  const secA=(document.getElementById('regSecA')?.value||'').trim().toLowerCase();
  users.push({username,hash,salt,created:Date.now(),secQ:secQ||undefined,secA:secA||undefined});
  saveUsers(users);
  currentUser=username;
  setSession(username);
  enterApp();
}
document.getElementById('regPassword2')?.addEventListener('keydown',e=>{if(e.key==='Enter')doRegister();});

async function changePassword(){return changePasswordFrom('cpOld','cpNew','cpNew2','cpErr');}
async function changePasswordFrom(oldId,newId,new2Id,errId){
  const old=document.getElementById(oldId)?.value||'';
  const nw=document.getElementById(newId)?.value||'';
  const nw2=document.getElementById(new2Id)?.value||'';
  const el=document.getElementById(errId);
  const setErr=m=>{if(el)el.textContent=m;};
  if(!old||!nw){setErr('Fill in all fields');return;}
  if(nw.length<4){setErr('New password min 4 chars');return;}
  if(nw!==nw2){setErr('New passwords do not match');return;}
  const users=getUsers();
  const user=users.find(u=>u.username===currentUser);
  if(!user){setErr('User not found');return;}
  const validOld=await verifyPwd(old,user.hash,user.salt||'');
  if(!validOld){setErr('Current password incorrect');return;}
  const {hash:newHash,salt:newSalt}=await hashPwd(nw);
  user.hash=newHash;user.salt=newSalt;
  saveUsers(users);
  if(el)el.textContent='';
  [oldId,newId,new2Id].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  toastMsg('Password changed ✓');
}

function doLogout(){
  clearSession();
  currentUser=null;
  data=null;
  STORE=null;
  location.reload();
}

function doGuestLogin(){
  currentUser='guest';
  // No session saved — guest is always temporary
  enterApp();
}

function isAdmin(){return currentUser&&currentUser.toLowerCase()==='lew';}
function renderUsers(){
  const containers=[document.getElementById('usersList'),document.getElementById('usersListSharing')].filter(Boolean);
  if(!containers.length)return;
  const el=containers[0];
  const users=getUsers();
  const admin=isAdmin();
  el.innerHTML=users.map(u=>{
    const isMe=u.username===currentUser;
    const canRemove=admin&&!isMe;
    return '<div class="users-list-item">'+
      '<div class="row" style="gap:8px"><div class="user-chip" style="padding:3px 10px;font-size:.7rem">'+esc(u.username[0].toUpperCase())+'</div><b>'+esc(u.username)+'</b><span class="small">'+(isMe?'(you)':'')+(admin&&isMe?' · Admin':'')+'</span></div>'+
      (canRemove?'<button class="icon danger" onclick="removeUser(\''+esc(u.username)+'\')" title="Remove user">×</button>':(isMe?'<span class="pill">Active</span>':'<span class="pill" style="opacity:.4">Protected</span>'))+
    '</div>';
  }).join('')||'<div class="empty">No other users.</div>';
  if(!admin){el.insertAdjacentHTML('beforeend','<p class="small" style="margin-top:8px;opacity:.5">Only the admin (Lew) can manage other accounts.</p>');}
  containers.slice(1).forEach(c=>{c.innerHTML=el.innerHTML;});
}

function removeUser(username){
  if(!isAdmin()){toastMsg('Only admin (Lew) can remove users');return;}
  if(username.toLowerCase()==='lew'){toastMsg('Cannot remove admin account');return;}
  if(!confirm('Remove user "'+username+'"? Their data will be deleted.'))return;
  const users=getUsers().filter(u=>u.username!==username);
  saveUsers(users);
  localStorage.removeItem(_DATA_PREFIX+username);
  renderUsers();
  toastMsg('User removed');
}

function enterApp(){
  STORE=dataKey(currentUser);
  const ls=document.getElementById('loginScreen');
  if(ls)ls.classList.remove('show');

  // Local-only: load this user's data from browser storage.
  data=load();
  _finishEnterApp();
}
function _finishEnterApp(){
  initNav();
  applySettings();
  // Intro — use per-user seen flag stored in settings
  if(data.settings.introSeen&&!data.settings.introAlways){
    intro.classList.add('hide');
    const dots=document.getElementById('introDots');
    if(dots)dots.classList.add('hide');
    const pb=document.getElementById('introProgress');
    if(pb)pb.style.display='none';
    const pt=document.getElementById('introParticles');
    if(pt)pt.style.display='none';
  }
  timerTotal=settingsFocus()*60;remaining=timerTotal;tickRing();tickClock();
  show(data.settings.defaultView||'dashboard');
  renderAll();
  // live-refresh the to-do list when the QA/QC tool saves (from its iframe)
  if(!window.__qaqcMirrorBound){
    window.__qaqcMirrorBound=true;
    window.addEventListener('storage', function(e){
      if(e.key==='lews_qaqc_state_v1' || e.key==='lews_qaqc_updated'){
        if(typeof renderTasks==='function') try{renderTasks();}catch(_){}
        if(typeof dashboard==='function') try{dashboard();}catch(_){}
        if(typeof stats==='function') try{stats();}catch(_){}
      }
    });
  }
  toastMsg('Welcome back, '+currentUser+' 👋');
  if(isAdmin())setTimeout(function(){toastMsg('Admin mode active. You have full control.');},1200);
  setTimeout(function(){if(typeof updateCredBtn==='function')updateCredBtn();},100);
  // Update UI labels
  document.querySelectorAll('#currentUserLabel,#currentUserLabel2').forEach(ul=>ul.textContent=currentUser);
  renderUsers();
  restoreSaveFolder().catch(console.warn);
  // v8.5: Restore pet if enabled or auto-show
  setTimeout(()=>{
    const s=data.settings;
    // phones/tablets: never pop the pet over the page — the 🐾 button is there instead
    if(s.petAutoShow&&window.innerWidth>900){
      const pw=document.getElementById('uPetWin');
      const fb=document.getElementById('petFloatBtn');
      if(pw&&pw.style.display!=='block'){
        pw.style.display='block';
        if(fb)fb.classList.remove('pet-off');
        if(typeof uLoadMode==='function')uLoadMode();
        if(s.petMode&&typeof uSetMode==='function')uSetMode(s.petMode);
        if(s.petX!=null&&s.petY!=null&&typeof uMP==='function')uMP(s.petX,s.petY);
      }
    }
  },300);
}




// ── v8.5: Admin credentials list ─────────────────────────────────────────────
function showCredentialsList(){
  if(!isAdmin()){toastMsg('Admin only');return;}
  var users=getUsers();
  var lines=users.map(function(u){
    return u.username+' | Created: '+new Date(u.created).toLocaleDateString()+' | Security Q: '+(u.secQ||'none');
  });
  var title='User Accounts ('+users.length+')';
  // Check if note already exists
  var existing=data.notes.find(function(n){return n.title==='User Accounts';});
  if(existing){
    existing.body=lines.join('\n');
    existing.created=today();
  }else{
    data.notes.unshift({id:uid(),title:'User Accounts',body:lines.join('\n'),created:today(),taskId:null});
  }
  save();renderNotes();
  toastMsg('Accounts list updated in Notes');
}
// Show/hide credentials button based on admin
function updateCredBtn(){
  var btn=document.getElementById('credListBtn');
  if(btn)btn.style.display=isAdmin()?'inline-flex':'none';
}

// ── v8.5: Floating Calculator ─────────────────────────────────────────────────
function toggleCalcFloat(){
  var el=document.getElementById('calcFloat');
  if(!el)return;
  el.classList.toggle('show');
}
function updateCalcFab(viewId){
  var fab=document.getElementById('calcFab');
  var fl=document.getElementById('calcFloat');
  if(!fab)return;
  if(viewId==='finance'){
    fab.style.display='flex';
  }else{
    fab.style.display='none';
    if(fl)fl.classList.remove('show');
  }
}

// Calculator drag
(function(){
  var bar=document.getElementById('calcBar');
  var win=document.getElementById('calcFloat');
  if(!bar||!win)return;
  var dx=0,dy=0,dragging=false;
  bar.addEventListener('mousedown',function(e){
    if(e.target.tagName==='BUTTON')return;
    dragging=true;
    var r=win.getBoundingClientRect();
    dx=e.clientX-r.left;dy=e.clientY-r.top;
    e.preventDefault();
  });
  document.addEventListener('mousemove',function(e){
    if(!dragging)return;
    win.style.left=(e.clientX-dx)+'px';
    win.style.top=(e.clientY-dy)+'px';
    win.style.right='auto';win.style.bottom='auto';
  });
  document.addEventListener('mouseup',function(){dragging=false;});
  bar.addEventListener('touchstart',function(e){
    if(e.target.tagName==='BUTTON')return;
    dragging=true;
    var r=win.getBoundingClientRect();
    dx=e.touches[0].clientX-r.left;dy=e.touches[0].clientY-r.top;
    e.preventDefault();
  },{passive:false});
  document.addEventListener('touchmove',function(e){
    if(!dragging)return;
    win.style.left=(e.touches[0].clientX-dx)+'px';
    win.style.top=(e.touches[0].clientY-dy)+'px';
    win.style.right='auto';win.style.bottom='auto';
    e.preventDefault();
  },{passive:false});
  document.addEventListener('touchend',function(){dragging=false;});
})();

// Calculator pad init
(function(){
  var pad=document.getElementById('calcPad');
  var valEl=document.getElementById('calcVal');
  var exprEl=document.getElementById('calcExpr');
  if(!pad)return;
  var current='0',expr='',lastOp='',memory=0,fresh=true;
  var btns=[
    {l:'C',t:'fn',a:'clear'},{l:'+/-',t:'fn',a:'negate'},{l:'%',t:'fn',a:'pct'},{l:'/',t:'op'},
    {l:'7',t:'num'},{l:'8',t:'num'},{l:'9',t:'num'},{l:'x',t:'op',v:'*'},
    {l:'4',t:'num'},{l:'5',t:'num'},{l:'6',t:'num'},{l:'-',t:'op'},
    {l:'1',t:'num'},{l:'2',t:'num'},{l:'3',t:'num'},{l:'+',t:'op'},
    {l:'0',t:'num',w:2},{l:'.',t:'num'},{l:'=',t:'eq'}
  ];
  btns.forEach(function(b){
    var btn=document.createElement('button');
    btn.className='btn'+(b.t==='op'||b.t==='eq'?' primary':'');
    btn.textContent=b.l;
    btn.style.padding='12px 0';btn.style.fontSize='.9rem';btn.style.fontWeight='800';btn.style.borderRadius='10px';
    if(b.w)btn.style.gridColumn='span '+b.w;
    btn.addEventListener('click',function(){calcPress(b);});
    pad.appendChild(btn);
  });
  function update(){valEl.textContent=current;exprEl.textContent=expr;}
  function calcPress(b){
    if(b.t==='num'){
      if(fresh){current='';fresh=false;}
      if(b.l==='.'&&current.includes('.'))return;
      current=(current==='0'&&b.l!=='.')?b.l:current+b.l;
    }else if(b.t==='op'){
      if(lastOp&&!fresh){calcEval();}
      expr=current+' '+(b.v||b.l)+' ';
      memory=parseFloat(current);lastOp=b.v||b.l;fresh=true;
    }else if(b.t==='eq'){
      if(lastOp)calcEval();
      expr='';lastOp='';
    }else if(b.a==='clear'){
      current='0';expr='';lastOp='';memory=0;fresh=true;
    }else if(b.a==='negate'){
      current=String(parseFloat(current)*-1);
    }else if(b.a==='pct'){
      current=String(parseFloat(current)/100);
    }
    update();
  }
  function calcEval(){
    var num=parseFloat(current);
    var result=0;
    if(lastOp==='+')result=memory+num;
    else if(lastOp==='-')result=memory-num;
    else if(lastOp==='*')result=memory*num;
    else if(lastOp==='/'){result=num!==0?memory/num:0;}
    current=parseFloat(result.toFixed(10)).toString();
    memory=parseFloat(current);fresh=true;
    expr='';
  }
  update();
})();

// ── v8.5: Secret Command Center ──────────────────────────────────────────────
let _secretClickCount=0,_secretTimer=null;
function openSecret(){
  // single click trigger now
  {  // direct open
    var overlay=document.getElementById('secretOverlay');
    if(!overlay)return;
    // Build stats
    var stats=document.getElementById('secretStats');
    var tasks=data?data.tasks.map(ensure):[];
    var done=tasks.filter(function(t){return t.status==='done';}).length;
    var totalSessions=parseInt(localStorage.getItem('lew_sessions')||'0')+1;
    localStorage.setItem('lew_sessions',String(totalSessions));
    var streak=calcStreak();
    var adminExtra=isAdmin()?'<div class="secret-stat"><b>'+getUsers().length+'</b><span class="small">Users</span></div>':'';
    stats.innerHTML='<div class="secret-stat"><b>'+done+'</b><span class="small">Tasks Done</span></div><div class="secret-stat"><b>'+streak+'</b><span class="small">Day Streak</span></div><div class="secret-stat"><b>'+totalSessions+'</b><span class="small">Sessions</span></div>'+adminExtra;
    // Build buttons
    var grid=document.getElementById('secretGrid');
    grid.innerHTML='';
    var actions=[
      {icon:'\u{1F4E6}',label:'Full Backup',fn:secretExportAll},
      {icon:'\u{1F4CA}',label:'Weekly Report',fn:secretWeeklyReport},
      {icon:'\u{1F9F9}',label:'Clean Done',fn:secretCleanDone},
      {icon:'\u{1F3AF}',label:'Quick Plan',fn:secretQuickPlan},
      {icon:'\u{1F512}',label:'Lock All',fn:secretLockAll},
      {icon:'\u{1F311}',label:'Ultra Dark',fn:secretDarkUltra}
    ];
    actions.forEach(function(a){
      var btn=document.createElement('div');
      btn.className='secret-btn';
      btn.innerHTML='<div class="s-icon">'+a.icon+'</div><div class="s-label">'+a.label+'</div>';
      btn.addEventListener('click',a.fn);
      grid.appendChild(btn);
    });
    // Close button
    document.getElementById('secretCloseBtn').onclick=closeSecret;
    // Dismiss on background click
    overlay.onclick=function(e){if(e.target===overlay)closeSecret();};
    overlay.classList.add('show');
  }
}
function closeSecret(){var o=document.getElementById('secretOverlay');if(o)o.classList.remove('show');}

function calcStreak(){
  if(!data)return 0;
  var tasks=data.tasks.map(ensure).filter(function(t){return t.status==='done'&&t.due;});
  var dates=[];tasks.forEach(function(t){if(dates.indexOf(t.due)===-1)dates.push(t.due);});
  dates.sort().reverse();
  var streak=0,d=new Date();
  for(var i=0;i<60;i++){
    var key=dateKey(d);
    if(dates.indexOf(key)>=0)streak++;
    else if(i>0)break;
    d.setDate(d.getDate()-1);
  }
  return streak;
}

function secretExportAll(){
  closeSecret();
  var full={data:data,users:getUsers().map(function(u){return u.username;}),exported:new Date().toISOString(),version:'v8.5'};
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(full,null,2)],{type:'application/json'}));
  a.download='lews-tracker-full-backup-'+today()+'.json';a.click();
  toastMsg('Full backup downloaded');
}

function secretWeeklyReport(){
  closeSecret();
  var tasks=data.tasks.map(ensure);
  var weekAgo=dateKey(new Date(Date.now()-7*864e5));
  var done=tasks.filter(function(t){return t.status==='done'&&t.due&&t.due>=weekAgo;});
  var added=tasks.filter(function(t){return t.createdAt&&t.createdAt>=Date.now()-7*864e5;});
  var overdue=tasks.filter(function(t){return t.status!=='done'&&t.due&&t.due<today();});
  var totalTime=0;done.forEach(function(t){totalTime+=totalSecs(t);});
  var report='WEEKLY REPORT\n'+new Date().toLocaleDateString()+'\n\n';
  report+='Completed: '+done.length+'\n';
  report+='New tasks added: '+added.length+'\n';
  report+='Currently overdue: '+overdue.length+'\n';
  report+='Total time logged: '+fmtSecs(totalTime)+'\n\n';
  report+='Done this week:\n';
  done.forEach(function(t){report+='- '+t.title+'\n';});
  // Save as note
  data.notes.unshift({id:uid(),title:'Weekly Report - '+today(),body:report,created:today(),taskId:null});
  save();renderNotes();
  toastMsg('Weekly report saved to Notes');
}

function secretCleanDone(){
  closeSecret();
  var before=data.tasks.length;
  data.tasks=data.tasks.filter(function(t){return ensure(t).status!=='done';});
  var removed=before-data.tasks.length;
  save();renderAll();
  toastMsg(removed+' completed tasks removed');
}

function secretLockAll(){
  closeSecret();
  data.settings.financeUnlocked=false;
  save();renderBudgets();
  doLogout();
  toastMsg('All locked. Signed out.');
}

function secretQuickPlan(){
  closeSecret();
  var tasks=data.tasks.map(ensure).filter(function(t){return t.status!=='done';});
  var td=today();
  var todayTasks=tasks.filter(function(t){return t.due===td;});
  var overdue=tasks.filter(function(t){return t.due&&t.due<td;});
  var high=tasks.filter(function(t){return t.priority==='high';});
  var plan='Plan: ';
  if(overdue.length)plan+=overdue.length+' overdue! ';
  if(todayTasks.length)plan+=todayTasks.length+' due today. ';
  if(high.length)plan+=high.length+' high priority. ';
  if(!overdue.length&&!todayTasks.length&&!high.length)plan+='All clear!';
  var focus=high[0]||todayTasks[0]||tasks[0];
  if(focus)plan+=' Focus: '+focus.title;
  toastMsg(plan);
}

var _ultraDark=false;
function secretDarkUltra(){
  closeSecret();
  _ultraDark=!_ultraDark;
  if(_ultraDark){
    document.body.classList.remove('light');
    document.documentElement.style.setProperty('--bg','#000');
    document.documentElement.style.setProperty('--bg2','#050504');
    document.documentElement.style.setProperty('--panel','rgba(5,5,4,.92)');
    toastMsg('Ultra Dark activated');
  }else{
    document.documentElement.style.setProperty('--bg','#070807');
    document.documentElement.style.setProperty('--bg2','#10120f');
    document.documentElement.style.setProperty('--panel','rgba(18,20,16,.78)');
    toastMsg('Normal dark restored');
  }
}

function updateDataMonitor(){
  const el=document.getElementById('dataMonitorInfo');
  if(!el)return;
  const dataStr=JSON.stringify(data||{});
  const kb=(dataStr.length/1024).toFixed(1);
  const tasks=data?data.tasks.length:0;
  const notes=data?data.notes.length:0;
  const budgets=data?data.budgets.length:0;
  el.innerHTML='Browser cache: <b>'+kb+' KB</b><br>Tasks: <b>'+tasks+'</b> · Notes: <b>'+notes+'</b> · Budgets: <b>'+budgets+'</b>';
}
setTimeout(updateDataMonitor,500);


// ── v8.5: Password Recovery ──────────────────────────────────────────────────
// Recovery code: each user can set their own in Settings → Security (stored hashed, like the password).
async function setRecoveryCode(){
  const el=document.getElementById('recCodeSet'),msg=document.getElementById('recCodeMsg');
  const code=(el&&el.value||'').trim();
  if(!currentUser||currentUser==='guest'){if(msg)msg.textContent='Sign in to a saved account first';return;}
  if(code.length<6){if(msg)msg.textContent='Use at least 6 characters';return;}
  const users=getUsers(),i=users.findIndex(u=>u.username===currentUser);
  if(i<0){if(msg)msg.textContent='Account not found';return;}
  const {hash,salt}=await hashPwd(code);
  users[i].recHash=hash;users[i].recSalt=salt;saveUsers(users);
  el.value='';if(msg)msg.textContent='Recovery code saved ✓ — write it down somewhere safe';
  toastMsg('Recovery code saved');
}

const _secQLabels={pet:"What was your first pet's name?",city:"What city were you born in?",food:"What is your favorite food?",teacher:"Who was your favorite teacher?",street:"What street did you grow up on?"};

function showRecovery(){
  document.getElementById('loginForm').style.display='none';
  document.getElementById('registerForm').style.display='none';
  document.getElementById('recoveryForm').style.display='block';
  document.getElementById('recErr').textContent='';
  document.getElementById('recUsername').value='';
  document.getElementById('recSecA').value='';
  document.getElementById('recMasterCode').value='';
  document.getElementById('recNewPwd').value='';
  document.getElementById('recNewPwd2').value='';
  document.getElementById('recSecQWrap').style.display='none';
  setTimeout(()=>document.getElementById('recUsername').focus(),60);
}

// Auto-show security question when username is entered
document.addEventListener('DOMContentLoaded',()=>{
  const recUser=document.getElementById('recUsername');
  if(recUser)recUser.addEventListener('input',()=>{
    const username=recUser.value.trim();
    const users=getUsers();
    const user=users.find(u=>u.username.toLowerCase()===username.toLowerCase());
    const wrap=document.getElementById('recSecQWrap');
    const label=document.getElementById('recSecQLabel');
    if(user&&user.secQ&&_secQLabels[user.secQ]){
      wrap.style.display='block';
      label.textContent=_secQLabels[user.secQ];
    }else{
      wrap.style.display='none';
    }
  });
});

function showRecErr(m){const el=document.getElementById('recErr');if(el)el.textContent=m;}

async function doRecovery(){const btn=setAuthBusy('Resetting…');try{await doRecovery_core();}catch(e){const msg=e&&(e.message||e)?(e.message||e):'Unknown error';const target=document.getElementById('recErr');if(target)target.textContent='Error: '+msg;}finally{clearAuthBusy(btn);}}
async function doRecovery_core(){
  const username=(document.getElementById('recUsername').value||'').trim();
  const secAnswer=(document.getElementById('recSecA').value||'').trim().toLowerCase();
  const masterCode=document.getElementById('recMasterCode').value||'';
  const newPwd=document.getElementById('recNewPwd').value||'';
  const newPwd2=document.getElementById('recNewPwd2').value||'';

  if(!username){showRecErr('Enter your username');return;}
  if(!newPwd){showRecErr('Enter a new password');return;}
  if(newPwd.length<4){showRecErr('Password must be at least 4 characters');return;}
  if(newPwd!==newPwd2){showRecErr('Passwords do not match');return;}

  const users=getUsers();
  const userIdx=users.findIndex(u=>u.username.toLowerCase()===username.toLowerCase());
  if(userIdx===-1){showRecErr('User not found');return;}

  const user=users[userIdx];
  let authorized=false;

  // Check the user's own recovery code (set in Settings → Security)
  if(masterCode){
    if(user.recHash&&await verifyPwd(masterCode,user.recHash,user.recSalt)){authorized=true;}
    else{showRecErr(user.recHash?'Recovery code is incorrect':'No recovery code was set for this account');return;}
  }
  // Check security answer
  else if(secAnswer&&user.secQ&&user.secA){
    if(secAnswer===user.secA.toLowerCase()){
      authorized=true;
    }else{
      showRecErr('Security answer is incorrect');return;
    }
  }else{
    showRecErr('Enter your security answer or your recovery code');return;
  }

  if(authorized){
    const {hash,salt}=await hashPwd(newPwd);
    users[userIdx].hash=hash;
    users[userIdx].salt=salt;
    saveUsers(users);
    showRecErr('');
    showSignIn();
    showLoginError('Password reset! Sign in with your new password.');
    document.getElementById('loginUsername').value=user.username;
    document.getElementById('loginPassword').focus();
  }
}

// ── Startup: check session ────────────────────────────────────────────────────
(function(){
  const ls=document.getElementById('loginScreen');
  const session=getSession();
  if(session){
    currentUser=session.username;
    const users=getUsers();
    if(users.find(u=>u.username===currentUser)){
      enterApp();return;
    }
    clearSession();
  }
  // ── Seed default admin account if no users exist ─────────────────────────
  (async function seedDefaultAdmin(){
    const users=getUsers();
    if(users.length===0){
      // Default account: username = lew, password = lew1234
      // Change password after first login via Settings > Change Password
      const {hash,salt}=await hashPwd('lew1234');
      const defaultUser={username:'lew',hash,salt,created:Date.now()};
      // hashing takes a moment — only seed if nobody signed up meanwhile (never overwrite a new account)
      if(getUsers().length===0)saveUsers([defaultUser]);
    }
  })();
  // No valid session — show login
  if(ls)ls.classList.add('show');
  setTimeout(()=>document.getElementById('loginUsername')?.focus(),120);
})();

// ── v8.5: Confetti burst on task completion ──────────────────────────────────
(function(){
  let canvas,ctx;
  function initCanvas(){
    if(canvas)return;
    canvas=document.createElement('canvas');
    canvas.id='confettiCanvas';
    document.body.appendChild(canvas);
    ctx=canvas.getContext('2d');
    canvas.width=window.innerWidth;
    canvas.height=window.innerHeight;
    window.addEventListener('resize',()=>{canvas.width=window.innerWidth;canvas.height=window.innerHeight;});
  }
  window.confettiBurst=function(evt){
    initCanvas();
    const x=evt.clientX||evt.pageX||window.innerWidth/2;
    const y=evt.clientY||evt.pageY||window.innerHeight/2;
    const colors=['#d8b76d','#ff9655','#97dc8d','#ffeab0','#fff','#ff7474'];
    const particles=[];
    for(let i=0;i<35;i++){
      const angle=Math.random()*Math.PI*2;
      const speed=2+Math.random()*6;
      particles.push({
        x,y,
        vx:Math.cos(angle)*speed,
        vy:Math.sin(angle)*speed-2,
        size:3+Math.random()*5,
        color:colors[Math.floor(Math.random()*colors.length)],
        life:1,
        decay:0.012+Math.random()*0.018,
        rot:Math.random()*360,
        rotV:(Math.random()-0.5)*12,
        shape:Math.random()>0.5?'rect':'circle'
      });
    }
    let running=true;
    function draw(){
      if(!running)return;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      let alive=0;
      particles.forEach(p=>{
        if(p.life<=0)return;
        alive++;
        p.x+=p.vx;
        p.y+=p.vy;
        p.vy+=0.12; // gravity
        p.vx*=0.99;
        p.life-=p.decay;
        p.rot+=p.rotV;
        ctx.save();
        ctx.translate(p.x,p.y);
        ctx.rotate(p.rot*Math.PI/180);
        ctx.globalAlpha=Math.max(0,p.life);
        ctx.fillStyle=p.color;
        if(p.shape==='rect'){ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*0.6);}
        else{ctx.beginPath();ctx.arc(0,0,p.size/2,0,Math.PI*2);ctx.fill();}
        ctx.restore();
      });
      if(alive>0)requestAnimationFrame(draw);
      else{ctx.clearRect(0,0,canvas.width,canvas.height);running=false;}
    }
    requestAnimationFrame(draw);
  };
})();

// ── v8.5: Time-of-day ambient lighting ───────────────────────────────────────
(function(){
  const el=document.createElement('div');
  el.className='ambient-light';
  document.body.appendChild(el);
  function updateAmbient(){
    const h=new Date().getHours();
    let bg;
    if(h>=6&&h<10){
      // Sunrise: warm gold
      bg='radial-gradient(ellipse at 30% 20%,rgba(216,183,109,.18),transparent 60%),radial-gradient(ellipse at 70% 80%,rgba(255,150,85,.08),transparent 50%)';
    }else if(h>=10&&h<17){
      // Daytime: neutral warm
      bg='radial-gradient(ellipse at 50% 30%,rgba(216,183,109,.06),transparent 50%)';
    }else if(h>=17&&h<21){
      // Sunset: amber/orange
      bg='radial-gradient(ellipse at 80% 30%,rgba(255,150,85,.15),transparent 55%),radial-gradient(ellipse at 20% 70%,rgba(216,183,109,.10),transparent 50%)';
    }else{
      // Night: cool blue
      bg='radial-gradient(ellipse at 40% 20%,rgba(60,80,140,.12),transparent 55%),radial-gradient(ellipse at 70% 80%,rgba(40,60,120,.08),transparent 50%)';
    }
    el.style.background=bg;
  }
  updateAmbient();
  setInterval(updateAmbient,60000); // update every minute
})();

// ── v8.5: Interactive cursor glow trail ──────────────────────────────────────
(function(){
  if(window.matchMedia('(pointer:coarse)').matches)return;
  const glow=document.createElement('div');
  glow.className='cursor-glow';
  document.body.appendChild(glow);
  let mx=0,my=0,gx=0,gy=0,active=false;
  document.addEventListener('mousemove',e=>{
    mx=e.clientX;my=e.clientY;
    if(!active){active=true;glow.classList.add('active');raf();}
  });
  document.addEventListener('mouseleave',()=>{active=false;glow.classList.remove('active');});
  function raf(){
    if(!active)return;
    // Smooth lerp for trail effect
    gx+=(mx-gx)*0.12;
    gy+=(my-gy)*0.12;
    glow.style.transform='translate('+(gx-90)+'px,'+(gy-90)+'px)';
    requestAnimationFrame(raf);
  }
})();
