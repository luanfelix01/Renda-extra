const SUPABASE_URL='https://uqtmlkdvivqouifyxsjc.supabase.co';
const SUPABASE_KEY='sb_publishable__Dl-MlDC0EZvtA46FSCWng_FEXmWQ6H';
window.addEventListener('error',e=>{document.body.insertAdjacentHTML('afterbegin','<p style="background:#400;color:#fff;padding:8px;margin:0;font-size:12px">Erro: '+String(e.message).replace(/</g,'&lt;')+'</p>')});
const db=(()=>{
  let session=null,cb=null;try{session=JSON.parse(localStorage.getItem('rp_session')||'null')}catch(e){}
  const store=s=>{session=s;try{s?localStorage.setItem('rp_session',JSON.stringify(s)):localStorage.removeItem('rp_session')}catch(e){}};
  const err=j=>({code:j.code||j.error_code||'',message:j.msg||j.error_description||j.message||'Erro'});
  const mk=j=>j.access_token?{access_token:j.access_token,refresh_token:j.refresh_token,expires_at:Date.now()/1000+(j.expires_in||3600),user:j.user}:null;
  async function fresh(){
    if(session&&session.expires_at-60<Date.now()/1000){
      const r=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
      const j=await r.json();if(r.ok&&j.access_token)store(mk(j));else{store(null);cb&&cb('SIGNED_OUT',null)}
    }
  }
  const hdr=extra=>({apikey:SUPABASE_KEY,'Content-Type':'application/json',Authorization:'Bearer '+(session?session.access_token:SUPABASE_KEY),...extra});
  async function rest(path,opt){
    try{await fresh();const r=await fetch(SUPABASE_URL+'/rest/v1/'+path,opt(hdr));const t=await r.text();const j=t?JSON.parse(t):null;
      return r.ok?{data:j,error:null}:{data:null,error:err(j||{})}}catch(e){return{data:null,error:{code:'',message:e.message}}}
  }
  class Q{
    constructor(t){this.t=t;this.f=[];this.o='';this.m='GET';this.sel='*';this.b=null;this.one=false}
    select(c){this.sel=c||'*';return this}
    insert(b){this.m='POST';this.b=b;return this}
    update(b){this.m='PATCH';this.b=b;return this}
    eq(c,v){this.f.push(encodeURIComponent(c)+'=eq.'+encodeURIComponent(v));return this}
    order(c,o){this.o='order='+c+'.'+((o&&o.ascending===false)?'desc':'asc');return this}
    single(){this.one=true;return this}
    then(res,rej){
      const q=[];if(this.m==='GET')q.push('select='+encodeURIComponent(this.sel));q.push(...this.f);if(this.o)q.push(this.o);
      return rest(this.t+(q.length?'?'+q.join('&'):''),h=>({method:this.m,headers:h({...(this.m!=='GET'?{Prefer:'return=minimal'}:{}),...(this.one?{Accept:'application/vnd.pgrst.object+json'}:{})}),body:this.b?JSON.stringify(this.b):undefined})).then(res,rej);
    }
  }
  async function token(body,grant){
    try{const r=await fetch(SUPABASE_URL+'/auth/v1/'+grant,{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
      const j=await r.json();if(!r.ok)return{data:{},error:err(j)};const s=mk(j);if(s){store(s);cb&&cb('SIGNED_IN',s)}return{data:{session:s},error:null}}
    catch(e){return{data:{},error:{message:'Sem conexão: '+e.message}}}
  }
  return{
    from:t=>new Q(t),
    rpc:(n,args)=>rest('rpc/'+n,h=>({method:'POST',headers:h({}),body:JSON.stringify(args||{})})),
    auth:{
      signInWithPassword:({email,password})=>token({email,password},'token?grant_type=password'),
      signUp:({email,password})=>token({email,password},'signup'),
      signOut:async()=>{store(null);cb&&cb('SIGNED_OUT',null);return{error:null}},
      onAuthStateChange:f=>{cb=f;setTimeout(()=>f('INITIAL_SESSION',session),0)}
    }
  };
})();
const $=id=>document.getElementById(id);
const money=c=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c/100);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label={pending:'Em análise',approved:'Aprovada',rejected:'Rejeitada'};
let S={user:null,profile:null,tasks:[],subs:[],balance:0,filter:'Todas',selected:null,pending:[]};
function toast(m){$('toast').textContent=m;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2600)}
function show(view){document.querySelectorAll('.view').forEach(v=>v.hidden=true);$(view+'View').hidden=false;document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.view===view))}

async function load(){
  const u=S.user.id;
  const [t,s,b,p]=await Promise.all([
    db.from('tasks').select('*').eq('active',true).order('created_at',{ascending:false}),
    db.from('submissions').select('id,task_id,proof,status,created_at,tasks(title,reward_cents)').eq('user_id',u).order('created_at',{ascending:false}),
    db.from('my_balance').select('balance_cents').single(),
    db.from('profiles').select('*').eq('id',u).single()]);
  S.tasks=t.data||[];S.subs=s.data||[];S.balance=b.data?.balance_cents||0;S.profile=p.data||{name:'',city:'',is_admin:false};
  if(S.profile.is_admin){
    const r=await db.from('submissions').select('id,proof,tasks(title,reward_cents)').eq('status','pending').order('created_at');
    S.pending=r.data||[];
  }else S.pending=[];
  render();
}
function render(){
  const list=S.tasks.filter(t=>S.filter==='Todas'||t.category===S.filter);
  const taken=new Set(S.subs.filter(s=>s.status!=='rejected').map(s=>s.task_id));
  $('taskCount').textContent=list.length+' disponíveis';
  $('taskList').innerHTML=list.map(t=>`<article class="task"><div class="task-top"><span class="tag">${esc(t.category)}</span><strong class="reward">${money(t.reward_cents)}</strong></div><h3>${esc(t.title)}</h3><p>${esc(t.description)}</p><button class="primary" onclick="openTask(${t.id})">${taken.has(t.id)?'Já enviada':'Ver tarefa'}</button></article>`).join('')||'<p class="muted">Nenhuma tarefa nesta categoria no momento.</p>';
  const pend=S.subs.filter(s=>s.status==='pending').reduce((a,s)=>a+(s.tasks?.reward_cents||0),0);
  const appr=S.subs.filter(s=>s.status==='approved').reduce((a,s)=>a+(s.tasks?.reward_cents||0),0);
  $('balance').textContent=$('walletAvailable').textContent=money(S.balance);
  $('walletPending').textContent=money(pend);$('walletTotal').textContent=money(appr);
  $('historyList').innerHTML=S.subs.length?S.subs.map(s=>`<div class="history-row"><b>${esc(s.tasks?.title||'Tarefa')}</b><p class="muted small">${new Date(s.created_at).toLocaleString('pt-BR')} · ${label[s.status]} · ${money(s.tasks?.reward_cents||0)}</p><p class="muted small">${esc(s.proof)}</p></div>`).join(''):'Você ainda não enviou nenhuma tarefa.';
  $('userName').value=S.profile.name;$('userCity').value=S.profile.city;$('userEmail').textContent=S.user.email;
  $('adminLink').hidden=!S.profile.is_admin;
  $('reviewList').innerHTML=S.pending.length?S.pending.map(s=>`<div class="history-row"><b>${esc(s.tasks?.title||'')}</b> · ${money(s.tasks?.reward_cents||0)}<p class="muted small">${esc(s.proof)}</p><button class="primary" onclick="review(${s.id},true)">Aprovar</button> <button class="text-btn" onclick="review(${s.id},false)">Rejeitar</button></div>`).join(''):'Nenhum envio pendente.';
}
window.openTask=id=>{S.selected=S.tasks.find(t=>t.id===id);if(!S.selected)return;$('dialogTitle').textContent=S.selected.title;$('dialogDesc').textContent=S.selected.description;$('dialogReward').textContent=money(S.selected.reward_cents);$('proof').value='';$('dialogMsg').textContent='';$('taskDialog').showModal()};
window.review=async(id,ok)=>{const {error}=await db.rpc('review_submission',{sub_id:id,approve:ok});if(error)return toast('Erro: '+error.message);toast(ok?'Envio aprovado e saldo creditado.':'Envio rejeitado.');load()};

document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>show(b.dataset.view)));
document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>{S.filter=b.dataset.filter;document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x===b));render()}));
$('submitTask').onclick=async()=>{
  const proof=$('proof').value.trim();
  if(proof.length<3){$('dialogMsg').textContent='Descreva a atividade ou informe o link antes de enviar.';return}
  const {error}=await db.from('submissions').insert({task_id:S.selected.id,user_id:S.user.id,proof});
  if(error){$('dialogMsg').textContent=error.code==='23505'?'Você já enviou esta tarefa.':'Não foi possível enviar: '+error.message;return}
  $('taskDialog').close();toast('Atividade enviada para análise.');load();
};
$('saveProfile').onclick=async()=>{const {error}=await db.from('profiles').update({name:$('userName').value.trim(),city:$('userCity').value.trim()}).eq('id',S.user.id);$('profileMsg').textContent=error?'Erro ao salvar.':'Perfil salvo.'};
$('withdrawBtn').onclick=async()=>{
  const pix=$('pixKey').value.trim();
  if(S.balance<1000){$('withdrawMsg').textContent='O saque mínimo é R$ 10,00.';return}
  if(!pix){$('withdrawMsg').textContent='Informe sua chave Pix.';return}
  const {error}=await db.from('withdrawals').insert({user_id:S.user.id,amount_cents:S.balance,pix_key:pix});
  $('withdrawMsg').textContent=error?'Erro: '+error.message:'Saque solicitado. O pagamento é feito manualmente pela equipe após conferência.';
  if(!error){$('pixKey').value='';load()}
};
$('adminLink').onclick=()=>show('admin');
$('addTask').onclick=async()=>{
  const title=$('newTitle').value.trim(),desc=$('newDesc').value.trim(),reward=Math.round(Number($('newReward').value)*100),funded=Math.round(Number($('newFunded').value||0)*100);
  if(title.length<3||!desc||!(reward>0)){$('adminMsg').textContent='Preencha título, descrição e recompensa válida.';return}
  const {error}=await db.from('tasks').insert({title,description:desc,reward_cents:reward,category:$('newCategory').value,funded_cents:funded,active:funded>=reward});
  $('adminMsg').textContent=error?'Erro: '+error.message:(funded>=reward?'Tarefa publicada.':'Tarefa salva como inativa: faltam fundos confirmados.');
  if(!error){$('newTitle').value=$('newDesc').value=$('newReward').value=$('newFunded').value='';load()}
};
$('menuBtn').onclick=()=>show('account');
$('logoutBtn').onclick=async()=>{await db.auth.signOut()};

async function auth(signup){
  const email=$('authEmail').value.trim(),password=$('authPass').value;
  if(!email||password.length<8){$('authMsg').textContent='Informe e-mail e senha com 8+ caracteres.';return}
  const {data,error}=signup?await db.auth.signUp({email,password}):await db.auth.signInWithPassword({email,password});
  if(error){$('authMsg').textContent=error.message;return}
  if(signup&&!data.session)$('authMsg').textContent='Conta criada. Confirme seu e-mail e depois entre.';
}
$('loginBtn').onclick=()=>auth(false);$('signupBtn').onclick=()=>auth(true);
$('authDialog').addEventListener('cancel',e=>e.preventDefault());
db.auth.onAuthStateChange((_e,session)=>{
  S.user=session?.user||null;
  if(S.user){$('authDialog').open&&$('authDialog').close();setTimeout(load,0)}
  else{S={user:null,profile:null,tasks:[],subs:[],balance:0,filter:'Todas',selected:null,pending:[]};$('balance').textContent=money(0);show('tasks');if(!$('authDialog').open)$('authDialog').showModal()}
});
let deferredPrompt;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBtn').hidden=false});
$('installBtn').onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installBtn').hidden=true}};
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
