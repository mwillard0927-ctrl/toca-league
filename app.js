const C = window.LEAGUE_CONFIG;
const sb = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
const T = {"HT": "HT-TOCA Thursday COED – Winter 1", "GD": "Goal Diggers", "SD": "Sundream II", "GM": "Green Machine", "HB": "Here for the Beer", "BC": "The Brew Crew", "SL": "Super Latinos & The Gringos", "BM": "Big Monster and Friends FC", "FA": "Fantastics", "CM": "The Cookie Monsters", "SC": "Stroke City Coed", "DU": "The Dummies"};
let GAMES = [], MY = '', ADMIN = false, editing = null, pendingPhoto = null, IMP = [];
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const ls = { get(k){try{return localStorage.getItem(k)}catch(e){return null}}, set(k,v){try{localStorage.setItem(k,v)}catch(e){}} };
MY = ls.get('myteam') || '';
const has = g => g.home_score != null && g.away_score != null;
const md = d => { const [y,m,dd] = d.split('-'); return `${+m}/${+dd}` };

async function load(){
  const { data, error } = await sb.from('games').select('*').order('id');
  if (error) { $('#loadNote').textContent = 'Could not load scores. Check your connection.'; return }
  GAMES = data; $('#loadNote').textContent = ''; render();
}

function standings(){
  const s = {}; Object.keys(T).forEach(k => s[k] = {k,gp:0,w:0,l:0,t:0,gf:0,ga:0,form:[]});
  GAMES.forEach(g => { if (!has(g)) return; const H=s[g.home],A=s[g.away],h=g.home_score,a=g.away_score;
    H.gp++;A.gp++;H.gf+=h;H.ga+=a;A.gf+=a;A.ga+=h;
    if(h>a){H.w++;A.l++;H.form.push('W');A.form.push('L')}else if(h<a){A.w++;H.l++;A.form.push('W');H.form.push('L')}else{H.t++;A.t++;H.form.push('T');A.form.push('T')} });
  return Object.values(s).map(x=>({...x,pts:x.w*3+x.t,gd:x.gf-x.ga})).sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.w-a.w||b.gf-a.gf||T[a.k].localeCompare(T[b.k]));
}
function nextWeek(){ const now=new Date(); const g=GAMES.find(g=>new Date(g.game_date+'T23:59')>=now); return g?g.week:99 }

function renderSchedule(){
  const nw = nextWeek(); let html = '';
  const weeks = [...new Set(GAMES.map(g=>g.week))];
  weeks.forEach(w => { const gs = GAMES.filter(g=>g.week===w && (!MY||g.home===MY||g.away===MY)); if(!gs.length) return;
    html += `<div class="week"><h2>Week ${w} · Thu ${md(gs[0].game_date)}${w===nw?' <span class="tag">Up next</span>':''}<small>${MY?'':gs.length+' games'}</small></h2>`;
    gs.forEach(g => { const r = has(g), mine = MY&&(g.home===MY||g.away===MY);
      const cls = side => !r||g.home_score===g.away_score ? '' : ((side==='h')===(g.home_score>g.away_score)?'won':'lost');
      html += `<div class="game${mine?' mine':''}"><div class="time">${esc(g.game_time.replace(' PM',''))}<br><small style="font-size:11px">PM</small></div><div class="teams">
        <div class="row ${cls('h')}"><span class="nm">${esc(T[g.home])}<small>home</small></span><span class="sc">${r?g.home_score:''}</span></div>
        <div class="row ${cls('a')}"><span class="nm">${esc(T[g.away])}</span><span class="sc">${r?g.away_score:''}</span></div>
        ${g.photo_url||ADMIN?`<div class="meta">${g.photo_url?`<a href="${esc(g.photo_url)}" target="_blank" rel="noopener">Score sheet</a>`:''}${r?'<span>Final</span>':''}${ADMIN?`<button class="edit" data-g="${g.id}">${r?'Edit score':'Enter score'}</button>`:''}</div>`:''}
      </div></div>` });
    html += '</div>' });
  $('#view-schedule').innerHTML = html || '<p class="note">No games for this team.</p>';
}
function renderStandings(){
  const rows = standings();
  $('#view-standings').innerHTML = `<div class="tablewrap"><table><thead><tr><th></th><th class="t">Team</th><th>GP</th><th>W</th><th>L</th><th>T</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th><th>Form</th></tr></thead><tbody>${
    rows.map((x,i)=>`<tr class="${x.k===MY?'mine':''}"><td class="rk">${i+1}</td><td class="t">${esc(T[x.k])}</td><td>${x.gp}</td><td>${x.w}</td><td>${x.l}</td><td>${x.t}</td><td>${x.gf}</td><td>${x.ga}</td><td>${x.gd>0?'+':''}${x.gd}</td><td class="pts">${x.pts}</td><td><span class="form">${x.form.slice(-5).map(f=>`<i class="${f}">${f}</i>`).join('')}</span></td></tr>`).join('')}</tbody></table></div>
    <p class="note">Win 3 pts, tie 1. Ranked by points, then goal difference, wins, goals for.</p>`;
}
function renderStats(){
  const rows = standings().filter(x=>x.gp), done = GAMES.filter(has);
  if(!done.length){ $('#view-stats').innerHTML='<p class="note">Stats appear once results are entered.</p>'; return }
  const goals = done.reduce((s,g)=>s+g.home_score+g.away_score,0);
  const top=(f,lab,fmt)=>{const b=[...rows].sort(f)[0];return `<div class="leader"><span>${lab}</span><b>${fmt(b)}</b><span>${esc(T[b.k])}</span></div>`};
  const big = [...done].sort((a,b)=>Math.abs(b.home_score-b.away_score)-Math.abs(a.home_score-a.away_score))[0];
  $('#view-stats').innerHTML = `<div class="leaders">
    <div class="leader"><span>Games played</span><b>${done.length} / ${GAMES.length}</b><span>${goals} goals total</span></div>
    <div class="leader"><span>Goals per game</span><b>${(goals/done.length).toFixed(1)}</b><span>League average</span></div>
    ${top((a,b)=>b.gf/b.gp-a.gf/a.gp,'Best attack',b=>(b.gf/b.gp).toFixed(1)+' GF/gm')}
    ${top((a,b)=>a.ga/a.gp-b.ga/b.gp,'Best defense',b=>(b.ga/b.gp).toFixed(1)+' GA/gm')}
    <div class="leader"><span>Biggest margin</span><b>${big.home_score}–${big.away_score}</b><span>${esc(T[big.home])} vs ${esc(T[big.away])}, ${md(big.game_date)}</span></div></div>`;
}
function render(){ renderSchedule(); renderStandings(); renderStats(); $('#adminPanel').hidden=!ADMIN; $('#loginBtn').classList.toggle('on',ADMIN) }

function show(tab){ if(!['schedule','standings','stats'].includes(tab)) tab='schedule';
  document.querySelectorAll('nav button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===tab));
  ['schedule','standings','stats'].forEach(t=>$('#view-'+t).hidden=t!==tab); ls.set('tab',tab) }
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>show(b.dataset.tab));
const sel=$('#myteam'); Object.entries(T).sort((a,b)=>a[1].localeCompare(b[1])).forEach(([k,v])=>{const o=document.createElement('option');o.value=k;o.textContent=v;sel.appendChild(o)});
sel.value=MY; sel.onchange=()=>{MY=sel.value;ls.set('myteam',MY);render()};
const banner = m => { const b=$('#banner'); b.hidden=!m; b.textContent=m||'' };

// ---------- login ----------
$('#loginBtn').onclick = async () => { if (ADMIN) { await sb.auth.signOut(); return } $('#loginStatus').textContent=''; $('#loginDlg').showModal() };
$('#loginCancel').onclick = () => $('#loginDlg').close();
$('#loginForm').onsubmit = async e => { e.preventDefault();
  const u=$('#un').value.trim().toLowerCase(); const email=u.includes('@')?u:`${u}@${C.LOGIN_DOMAIN}`;
  $('#loginStatus').textContent='Logging in…';
  const { error } = await sb.auth.signInWithPassword({ email, password: $('#pw').value });
  if (error) { $('#loginStatus').textContent='Wrong username or password.'; return }
  $('#pw').value=''; $('#loginDlg').close(); show('schedule') };
sb.auth.onAuthStateChange((_, session) => { ADMIN = !!session; banner(ADMIN?'Admin mode. Tap the lock to log out.':''); render() });

// ---------- manual edit ----------
document.addEventListener('click', e => {
  const b=e.target.closest('.edit'); if(b) openEdit(+b.dataset.g);
  const s=e.target.closest('[data-st]'); if(s){ const i=$('#'+s.dataset.st); i.value=Math.max(0,(parseInt(i.value)||0)+ +s.dataset.d) } });
function openEdit(id){ editing=GAMES.find(g=>g.id===id); pendingPhoto=null;
  $('#hsLabel').textContent=T[editing.home]; $('#asLabel').textContent=T[editing.away];
  $('#hs').value=editing.home_score??''; $('#as').value=editing.away_score??''; $('#sheet').value=''; $('#sheetPrev').hidden=true;
  $('#clearRes').hidden=!has(editing); $('#dlgStatus').textContent=`Week ${editing.week} · ${md(editing.game_date)} · ${editing.game_time}`; $('#dlg').showModal() }
$('#cancel').onclick=()=>$('#dlg').close();
$('#sheet').onchange=e=>{ const f=e.target.files[0]; if(!f) return; pendingPhoto=f; const im=$('#sheetPrev'); im.src=URL.createObjectURL(f); im.hidden=false };
async function uploadPhoto(f, id){
  const path = `game-${id}-${Date.now()}.${(f.name.split('.').pop()||'jpg').toLowerCase()}`;
  const { error } = await sb.storage.from('scoresheets').upload(path, f, { contentType: f.type });
  if (error) throw error;
  return sb.storage.from('scoresheets').getPublicUrl(path).data.publicUrl;
}
async function saveGame(id, patch){
  const { error } = await sb.from('games').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}
$('#dlgForm').onsubmit = async e => { e.preventDefault();
  const h=parseInt($('#hs').value), a=parseInt($('#as').value);
  if (isNaN(h)||isNaN(a)||h<0||a<0) { $('#dlgStatus').textContent='Enter a score for both teams.'; return }
  $('#save').disabled=true;
  try { const patch={home_score:h,away_score:a};
    if (pendingPhoto) { $('#dlgStatus').textContent='Uploading score sheet…'; patch.photo_url=await uploadPhoto(pendingPhoto, editing.id) }
    await saveGame(editing.id, patch); $('#dlg').close(); await load();
  } catch(err) { $('#dlgStatus').textContent='Could not save: '+(err.message||err) }
  $('#save').disabled=false };
$('#clearRes').onclick = async () => { try { await saveGame(editing.id,{home_score:null,away_score:null}); $('#dlg').close(); await load() } catch(err){ $('#dlgStatus').textContent='Could not clear: '+(err.message||err) } };

// ---------- photo scan (Gemini via Edge Function) ----------
const norm = s => String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
function teamKey(n){ const x=norm(n); if(!x) return; return Object.keys(T).find(k=>norm(T[k])===x||norm(T[k]).startsWith(x)||x.startsWith(norm(T[k]).slice(0,10))) }
function shrink(file){ return new Promise((res,rej)=>{ const img=new Image(); img.onload=()=>{ const m=1600, s=Math.min(1,m/Math.max(img.width,img.height));
  const c=document.createElement('canvas'); c.width=img.width*s; c.height=img.height*s; c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  res(c.toDataURL('image/jpeg',0.85).split(',')[1]) }; img.onerror=rej; img.src=URL.createObjectURL(file) }) }
$('#scan').onchange = async e => { const f=e.target.files[0]; e.target.value=''; if(!f) return; const st=$('#scanStatus');
  st.textContent='Reading score sheet…';
  try { const image = await shrink(f);
    const { data:v, error } = await sb.functions.invoke('read-scoresheet', { body:{ image, mime:'image/jpeg', teams:Object.values(T) } });
    if (error || v?.error) throw new Error(v?.error || error.message);
    const h=teamKey(v.home), a=teamKey(v.away);
    const g = GAMES.find(g=>g.home===h&&g.away===a) || GAMES.find(g=>g.home===a&&g.away===h);
    if (!g) { st.textContent='Could not match the teams on that sheet to a scheduled game. Use manual entry.'; return }
    const flip = g.home!==h; openEdit(g.id); pendingPhoto=f; const im=$('#sheetPrev'); im.src=URL.createObjectURL(f); im.hidden=false;
    if (v.homeScore!=null) { $('#hs').value=flip?v.awayScore:v.homeScore; $('#as').value=flip?v.homeScore:v.awayScore }
    $('#dlgStatus').textContent=`Read from photo: Week ${g.week} · ${md(g.game_date)}. Check the score, then save.`; st.textContent='';
  } catch(err) { st.textContent='Could not read that photo ('+(err.message||err)+'). Try a clearer shot or enter it manually.' } };

// ---------- spreadsheet ----------
$('#xls').onchange = async e => { const f=e.target.files[0]; e.target.value=''; if(!f) return;
  try { const wb=XLSX.read(await f.arrayBuffer()); const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]); IMP=[]; const bad=[];
    rows.forEach((r,i)=>{ const k={}; Object.keys(r).forEach(c=>k[norm(c)]=r[c]); const h=teamKey(k.home),a=teamKey(k.away),hs=parseInt(k.homescore),as=parseInt(k.awayscore);
      const wk=parseInt(k.week); const g=GAMES.find(g=>g.home===h&&g.away===a&&(isNaN(wk)||g.week===wk)); if(!g||isNaN(hs)||isNaN(as)){bad.push(i+2);return} IMP.push({g,hs,as}) });
    $('#impList').innerHTML = IMP.map(x=>`<div><span>Wk ${x.g.week}: ${esc(T[x.g.home])} vs ${esc(T[x.g.away])}</span><b>${x.hs}–${x.as}</b></div>`).join('') || '<p class="note">No matching games found.</p>';
    $('#impStatus').textContent = `${IMP.length} game${IMP.length===1?'':'s'} ready.` + (bad.length?` Skipped row${bad.length>1?'s':''} ${bad.join(', ')} (team names or scores didn't match).`:'');
    $('#impApply').disabled=!IMP.length; $('#impDlg').showModal();
  } catch(err) { $('#scanStatus').textContent='Could not read that file. Use .xlsx or .csv.' } };
$('#impCancel').onclick=()=>$('#impDlg').close();
$('#impForm').onsubmit = async e => { e.preventDefault(); $('#impApply').disabled=true; let ok=0;
  for (const x of IMP) { try { await saveGame(x.g.id,{home_score:x.hs,away_score:x.as}); ok++ } catch(err){} }
  $('#impDlg').close(); await load(); $('#scanStatus').textContent=`Updated ${ok} of ${IMP.length} games from the spreadsheet.` };

// ---------- live updates + start ----------
sb.channel('games').on('postgres_changes',{event:'*',schema:'public',table:'games'},()=>load()).subscribe();
show(ls.get('tab')||'schedule'); load();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
