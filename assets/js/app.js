(function(){'use strict';
var B=document.body,$=function(s,r){return(r||document).querySelector(s)},$$=function(s,r){return[].slice.call((r||document).querySelectorAll(s))};
var WA=B.dataset.wa,base=B.dataset.base||'';
/* submenu Tentang (HP: ketuk panah) */
$$('.nd .ndb').forEach(function(b){b.addEventListener('click',function(e){e.stopPropagation();var d=b.parentNode,o=d.classList.toggle('open');b.setAttribute('aria-expanded',o)})});
document.addEventListener('click',function(e){$$('.nd.open').forEach(function(d){if(!d.contains(e.target)){d.classList.remove('open');var b=$('.ndb',d);if(b)b.setAttribute('aria-expanded','false')}})});
/* bengkel rekanan: cari, saring provinsi, salin alamat */
(function(){var g=$('#bkg');if(!g)return;var q=$('#bq'),p=$('#bprov'),n=$('#bkn'),em=$('#bkempty'),cs=$$('.bk',g),tot=cs.length;
function f(){var s=(q.value||'').trim().toLowerCase(),pv=p.value,c=0;cs.forEach(function(x){var ok=(!pv||x.dataset.p===pv)&&(!s||x.dataset.s.indexOf(s)>-1);x.hidden=!ok;if(ok)c++});em.hidden=c>0;n.textContent=(s||pv)?c+' dari '+tot+' bengkel ditampilkan':tot+' bengkel rekanan'}
q.addEventListener('input',f);p.addEventListener('change',f);
g.addEventListener('click',function(e){var b=e.target.closest('.bkcp');if(!b)return;var t=b.dataset.t,done=function(){var o=b.textContent;b.textContent='Tersalin \u2713';setTimeout(function(){b.textContent=o},1600)};if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(done,function(){});else{var a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();try{document.execCommand('copy');done()}catch(x){}a.remove()}})})();
/* spesifikasi: buka/tutup detail + saring hanya perbedaan */
(function(){var b=$('#spbtn'),m=$('#spmore');if(!b||!m)return;b.addEventListener('click',function(){var o=m.hidden;m.hidden=!o;b.setAttribute('aria-expanded',o?'true':'false');b.textContent=o?'Tutup detail':'Lihat detail';if(o)m.scrollIntoView({behavior:'smooth',block:'nearest'})});var c=$('#spdiff'),t=$('#sptbl');if(c&&t)c.addEventListener('change',function(){t.setAttribute('data-only',c.checked?'1':'0')})})();
/* animasi memuat: gambar tampil shimmer sampai selesai dimuat */
var mk=function(i){i.classList.add('px');i.classList.remove('ok');var d=function(){i.classList.add('ok')};if(i.complete&&i.naturalWidth)d();else{i.addEventListener('load',d,{once:true});i.addEventListener('error',d,{once:true})}};
$$('img.px,img[loading="lazy"]:not(.nopx)').forEach(function(i){if(i.naturalWidth&&i.complete){i.classList.add('ok');return}mk(i)});
$$('.vid,.mvid,.mapbox').forEach(function(w){var v=$('video',w),f=$('iframe',w),d=function(){w.classList.add('ok')};if(v){if(v.readyState>=2)d();else{v.addEventListener('loadeddata',d,{once:true});v.addEventListener('error',d,{once:true})}}else if(f){f.addEventListener('load',d,{once:true})}else d()});
/* bar kemajuan saat pindah halaman */
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a||e.defaultPrevented||e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target&&a.target!=='_self'||a.hasAttribute('download'))return;var u;try{u=new URL(a.href,location.href)}catch(x){return}if(u.origin!==location.origin||(u.pathname===location.pathname&&u.search===location.search))return;var p=$('.navp');if(!p){p=document.createElement('div');p.className='navp';p.setAttribute('aria-hidden','true');B.appendChild(p)}p.className='navp go'});
window.addEventListener('pageshow',function(){var p=$('.navp');if(p)p.remove()});
/* sumber iklan Google: ingat selama sesi, lalu tandai pesan WhatsApp "(dari iklan Google)" */
var ADS=false;try{var Q=new URLSearchParams(location.search);if(Q.get('gclid')||(/google/i.test(Q.get('utm_source')||'')&&/cpc/i.test(Q.get('utm_medium')||'')))sessionStorage.setItem('xp_src','ads');ADS=sessionStorage.getItem('xp_src')==='ads'}catch(e){}
function tagWA(a){if(!ADS)return;try{var h=a.getAttribute('href')||'';if(h.indexOf('wa.me/')<0)return;var u=new URL(h,location.href),t=u.searchParams.get('text')||'';if(!t||t.indexOf('dari iklan Google')>-1)return;u.searchParams.set('text',t+' (dari iklan Google)');a.setAttribute('href',u.toString())}catch(e){}}
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href*="wa.me/"]');if(a)tagWA(a)},true);
var u=function(p){return /^https?:/.test(p)?p:base+'/'+p.replace(/^\//,'')};
/* menu */
var bg=$('#burger'),nav=$('#nav');if(bg)bg.onclick=function(){var o=nav.classList.toggle('open');bg.setAttribute('aria-expanded',o)};
/* hero slider */
var hero=$('#hero');if(hero){var sl=$$('.slide',hero),dt=$$('#dots button'),i=0,t;
function go(n){i=(n+sl.length)%sl.length;sl.forEach(function(s,k){s.classList.toggle('on',k===i)});dt.forEach(function(d,k){d.classList.toggle('on',k===i)})}
function auto(){clearInterval(t);if(!matchMedia('(prefers-reduced-motion:reduce)').matches)t=setInterval(function(){go(i+1)},6500)}
$('.prev',hero).onclick=function(){go(i-1);auto()};$('.next',hero).onclick=function(){go(i+1);auto()};dt.forEach(function(d,k){d.onclick=function(){go(k);auto()}});
var x0=null;hero.addEventListener('touchstart',function(e){x0=e.touches[0].clientX},{passive:true});hero.addEventListener('touchend',function(e){if(x0===null)return;var d=e.changedTouches[0].clientX-x0;if(Math.abs(d)>45){go(i+(d<0?1:-1));auto()}x0=null});auto()}
/* carousel tombol */
$$('.car').forEach(function(c){var tr=$('.track',c);if(!tr||tr.children.length<2)return;var n=tr.children.length,hasDots=n<=6,w=document.createElement('div');w.className='cbtn';w.innerHTML='<button class="tab" aria-label="Geser kiri">←</button>'+(hasDots?'<div class="cdots"></div>':'')+'<button class="tab" aria-label="Geser kanan">→</button>';
if(c.id==='car'){var h=document.createElement('p');h.className='chint';h.setAttribute('aria-hidden','true');h.innerHTML='<span>Geser untuk lihat model lainnya</span> <b>→</b>';c.insertBefore(h,tr)}
c.appendChild(w);if(c.classList.contains('pmini')&&tr.scrollWidth<=tr.clientWidth+2)w.style.display='none';var bs=w.querySelectorAll('.tab'),dd=$('.cdots',w),ds=[];
bs[0].onclick=function(){tr.scrollBy({left:-tr.clientWidth*.7,behavior:'smooth'})};bs[1].onclick=function(){tr.scrollBy({left:tr.clientWidth*.7,behavior:'smooth'})};
if(dd){for(var k=0;k<n;k++)(function(k){var d=document.createElement('button');d.type='button';d.setAttribute('aria-label','Tampilan '+(k+1)+' dari '+n);d.onclick=function(){tr.scrollTo({left:tr.children[k].offsetLeft-tr.children[0].offsetLeft,behavior:'smooth'})};dd.appendChild(d);ds.push(d)})(k)}
var sync=function(){var st=(tr.children[1].offsetLeft-tr.children[0].offsetLeft)||1,i=Math.round(tr.scrollLeft/st);if(tr.scrollLeft+tr.clientWidth>=tr.scrollWidth-4)i=n-1;if(i>n-1)i=n-1;ds.forEach(function(d,k){d.className=k===i?'on':''});if(tr.scrollLeft>8)c.classList.add('moved')};
tr.addEventListener('scroll',sync,{passive:true});sync();
if(c.id==='car'&&'IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){c.classList.add('nudge');io.disconnect()}})},{threshold:.6});io.observe(c)}});
/* artikel di beranda: tampilkan lebih banyak */
var am=$('#amore');if(am){am.addEventListener('click',function(){var hs=$$('.acard[hidden]',$('#ahome')),k=+am.dataset.step||6;hs.slice(0,k).forEach(function(x){x.hidden=false});if(hs.length<=k)am.parentNode.removeChild(am)})}
/* cari artikel */
var aq=$('#aq');if(aq){var cards=$$('.agrid .acard'),cnt=$('#acount'),none=$('#anone'),norm=function(s){return(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')};
var run=function(){var ws=norm(aq.value).split(/\s+/).filter(Boolean),n=0;cards.forEach(function(c){var ok=ws.every(function(w){return(c.dataset.s||'').indexOf(w)>-1});c.hidden=!ok;if(ok)n++});cnt.textContent=ws.length?n+' artikel ditemukan':'';none.hidden=!(ws.length&&!n)};
aq.addEventListener('input',run);var qm=location.search.match(/[?&]q=([^&]*)/);if(qm){try{aq.value=decodeURIComponent(qm[1].replace(/\+/g,' '))}catch(e){}run()}}
/* konfigurator */
var cfg=$('.cfg');if(cfg){var M=JSON.parse(cfg.dataset.models),mi=0,ci=0,img=$('#cfgimg'),sw=$('#sw'),sel=$('#var'),R=function(n){return 'Rp'+Math.round(n).toLocaleString('id-ID')};
function draw(){var m=M[mi];sw.innerHTML='';m.c.forEach(function(c,k){var b=document.createElement('button');b.style.background=c.hex;b.setAttribute('aria-label','Warna '+c.name);if(k===ci)b.className='on';b.onclick=function(){ci=k;draw()};sw.appendChild(b)});
img.style.opacity=.3;setTimeout(function(){img.src=u(m.c[ci].image);img.alt=m.n+' warna '+m.c[ci].name;mk(img);img.style.opacity=1},120);$('#colname').textContent='Warna: '+m.c[ci].name;
var cur=sel.value;sel.innerHTML=m.v.map(function(v,k){return '<option value="'+k+'">'+v.name+'</option>'}).join('');sel.value=m.v[cur]?cur:0;calc()}
function calc(){var m=M[mi],v=m.v[sel.value||0],p=v.price,dp=+$('#dp').value,tn=+$('#tn').value,bg=+$('#bg').value;
$('#dpv').textContent=dp+'% ('+R(p*dp/100)+')';$('#tnv').textContent=tn+' tahun';$('#bgv').textContent=bg+'%';$('#harga').textContent=R(p);
var pk=p*(1-dp/100),r=bg/100/12,n=tn*12,c=r?pk*r/(1-Math.pow(1+r,-n)):pk/n;$('#cic').textContent=R(c)+' / bulan';
$('#cfgwa').href='https://wa.me/'+WA+'?text='+encodeURIComponent('Halo, saya tertarik '+v.name+' warna '+m.c[ci].name+'. Simulasi: DP '+dp+'%, tenor '+tn+' tahun. Boleh minta penawaran?')}
$$('.tab',cfg).forEach(function(t){if(t.dataset.m===undefined)return;t.onclick=function(){$$('.tab[data-m]',cfg).forEach(function(x){x.classList.remove('on')});t.classList.add('on');mi=+t.dataset.m;ci=0;draw()}});
sel.onchange=calc;['dp','tn','bg'].forEach(function(id){$('#'+id).oninput=calc});draw()}
/* form lead -> WhatsApp */
$$('form.lead').forEach(function(f){f.addEventListener('submit',function(e){e.preventDefault();var d=new FormData(f);if(!String(d.get('nama')||'').trim()){f.nama.focus();return}
var tx='Halo, saya '+d.get('nama')+'. Saya mau test drive '+d.get('model')+'. Rencana pembelian: '+d.get('rencana')+'. (dari '+(ADS?'iklan Google':'website')+')';window.open('https://wa.me/'+WA+'?text='+encodeURIComponent(tx),'_blank','noopener')})});
/* reveal */
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.12});$$('.section h2,.mcard,.acard,.stats>div,.panel,.stage,.ccard,.tl li,.mapbox,.soc li').forEach(function(el){el.classList.add('rv');io.observe(el)})}
if('serviceWorker' in navigator&&location.protocol==='https:'){navigator.serviceWorker.register(base+'/sw.js').catch(function(){})}
/* iframe berat (video YouTube, Google Maps): baru dimuat setelah halaman selesai dan saat sudah dekat layar */
(function(){var fr=$$('iframe[data-src]');if(!fr.length)return;
function on(f){var s=f.getAttribute('data-src');if(s){f.removeAttribute('data-src');f.src=s}}
function start(){if(!('IntersectionObserver' in window)){fr.forEach(on);return}
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){io.unobserve(e.target);on(e.target)}})},{rootMargin:'150px 0px'});fr.forEach(function(f){io.observe(f)})}
if(document.readyState==='complete')start();else addEventListener('load',start)})();
/* lightbox: klik foto galeri untuk zoom */
(function(){var imgs=$$('.track.g img,[data-zoom]');if(!imgs.length)return;
var ov=document.createElement('div');ov.className='lb';ov.hidden=true;ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label','Pratinjau foto');
ov.innerHTML='<button class="lbx" aria-label="Tutup">&times;</button><button class="lbp" aria-label="Foto sebelumnya">&lsaquo;</button><button class="lbn" aria-label="Foto berikutnya">&rsaquo;</button><div class="lbs"><img alt=""></div><div class="lbc"></div>';
document.body.appendChild(ov);
var im=$('img',ov),cap=$('.lbc',ov),sc=$('.lbs',ov),k=0,last=null;
function show(n){k=(n+imgs.length)%imgs.length;ov.classList.remove('zoom');im.src=imgs[k].currentSrc||imgs[k].src;im.alt=imgs[k].alt;mk(im);cap.textContent=imgs[k].alt+' ('+(k+1)+'/'+imgs.length+') \u2022 ketuk foto untuk zoom'}
function open(n){last=document.activeElement;show(n);ov.hidden=false;document.documentElement.style.overflow='hidden';$('.lbx',ov).focus()}
function close(){ov.hidden=true;document.documentElement.style.overflow='';if(last&&last.focus)last.focus()}
function tz(){var z=ov.classList.toggle('zoom');cap.textContent=z?'Geser untuk melihat detail \u2022 ketuk lagi untuk kecilkan':imgs[k].alt+' ('+(k+1)+'/'+imgs.length+') \u2022 ketuk foto untuk zoom';if(z){sc.scrollLeft=(sc.scrollWidth-sc.clientWidth)/2;sc.scrollTop=(sc.scrollHeight-sc.clientHeight)/2}}
imgs.forEach(function(g,n){g.setAttribute('tabindex','0');g.setAttribute('role','button');g.style.cursor='zoom-in';g.addEventListener('click',function(){open(n)});g.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();open(n)}})});
$('.lbx',ov).onclick=close;$('.lbp',ov).onclick=function(){show(k-1)};$('.lbn',ov).onclick=function(){show(k+1)};
im.onclick=tz;sc.addEventListener('click',function(e){if(e.target===sc&&!ov.classList.contains('zoom'))close()});
document.addEventListener('keydown',function(e){if(ov.hidden)return;if(e.key==='Escape')close();else if(e.key==='ArrowLeft')show(k-1);else if(e.key==='ArrowRight')show(k+1)});
var sx=null;sc.addEventListener('touchstart',function(e){sx=ov.classList.contains('zoom')?null:e.touches[0].clientX},{passive:true});
sc.addEventListener('touchend',function(e){if(sx===null)return;var d=e.changedTouches[0].clientX-sx;if(Math.abs(d)>50)show(k+(d<0?1:-1));sx=null})})();
/* video artikel: putar hanya saat terlihat di layar */
$$('.vid video').forEach(function(v){v.muted=true;if('IntersectionObserver'in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){var p=v.play();if(p&&p.catch)p.catch(function(){})}else v.pause()})},{threshold:.25});io.observe(v)}});
/* pelacakan leads (GA4): klik WhatsApp, telepon, email, brosur, form test drive */
(function(){function ev(n,o){try{if(window.gtag)gtag('event',n,o||{})}catch(e){}}
var pg=location.pathname;
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;var h=a.getAttribute('href')||'',pos=(a.closest('[data-cta]')||{dataset:{}}).dataset.cta||(a.classList.contains('wafab')?'melayang':'halaman');
if(h.indexOf('wa.me/')>-1)ev('klik_whatsapp',{halaman:pg,posisi:pos,sumber:ADS?'iklan_google':'lainnya'});else if(h.indexOf('tel:')===0)ev('klik_telepon',{halaman:pg});else if(h.indexOf('mailto:')===0)ev('klik_email',{halaman:pg});else if(/\.pdf(\?|$)/i.test(h))ev('unduh_brosur',{halaman:pg,file:h});else if(h.indexOf('#testdrive')>-1)ev('klik_booking_test_drive',{halaman:pg,posisi:pos})},true);
document.addEventListener('submit',function(e){if(e.target&&e.target.classList&&e.target.classList.contains('lead'))ev('kirim_form_test_drive',{halaman:pg})},true)})();
/* chat ala WhatsApp: tombol WA membuka jendela chat di website, salam otomatis muncul duluan,
   aktivitas (buka, mengetik, kirim, lead) dikirim ke Apps Script -> Telegram + Google Sheet */
(function(){var HOOK=B.dataset.chat||'',SALAM=B.dataset.salam||'Halo, ada yang bisa kami bantu?',DEALER=B.dataset.dealer||'XPeng';
function gev(n,o){try{if(window.gtag)gtag('event',n,o||{})}catch(e){}}
var SID;try{SID=sessionStorage.getItem('xp_sid');if(!SID){SID=Date.now().toString(36)+Math.random().toString(36).slice(2,7);sessionStorage.setItem('xp_sid',SID)}}catch(e){SID='x'+Date.now().toString(36)}
var Q0={};try{var q=new URLSearchParams(location.search);['utm_source','utm_medium','utm_campaign','utm_term','gclid'].forEach(function(k){var v=q.get(k);if(v)sessionStorage.setItem('xp_'+k,v)});['utm_source','utm_medium','utm_campaign','utm_term','gclid'].forEach(function(k){var v=sessionStorage.getItem('xp_'+k);if(v)Q0[k]=v})}catch(e){}
function send(t,o){if(!HOOK)return;var d={t:t,sid:SID,page:location.pathname,title:document.title,src:ADS?'Iklan Google':(Q0.utm_source||(document.referrer?(function(){try{return new URL(document.referrer).hostname}catch(e){return''}})():'Langsung')),camp:Q0.utm_campaign||'',term:Q0.utm_term||'',gclid:Q0.gclid?1:0,dev:/Mobi|Android|iPhone/i.test(navigator.userAgent)?'HP':'Desktop',ref:document.referrer||''};for(var k in o)d[k]=o[k];var s=JSON.stringify(d);try{if(navigator.sendBeacon&&navigator.sendBeacon(HOOK,new Blob([s],{type:'text/plain'})))return}catch(e){}try{fetch(HOOK,{method:'POST',mode:'no-cors',body:s,keepalive:true})}catch(e){}}
var ICO='<svg viewBox="0 0 32 32" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M16 3a13 13 0 0 0-11 19.8L3 29l6.4-2A13 13 0 1 0 16 3zm0 2.3A10.7 10.7 0 1 1 9.5 24l-.4-.3-3.6 1.1 1.2-3.5-.3-.4A10.7 10.7 0 0 1 16 5.3z"/></svg>';
var box,log,ta,cur={},typed=false,step=0;
function tm(){var d=new Date();return('0'+d.getHours()).slice(-2)+'.'+('0'+d.getMinutes()).slice(-2)}
function bub(who,txt,lab){var b=document.createElement('div');b.className='wcb '+who;var p=document.createElement('p');p.textContent=txt;b.appendChild(p);var m=document.createElement('span');m.className='wcm';m.textContent=(lab?lab+' · ':'')+tm()+(who==='me'?' ✓✓':'');b.appendChild(m);log.appendChild(b);log.scrollTop=log.scrollHeight;return b}
function dots(ms,cb){var d=document.createElement('div');d.className='wcb them wcdots';d.innerHTML='<i></i><i></i><i></i>';log.appendChild(d);log.scrollTop=log.scrollHeight;setTimeout(function(){d.remove();cb()},ms)}
function build(){box=document.createElement('div');box.className='wchat';box.hidden=true;box.setAttribute('role','dialog');box.setAttribute('aria-label','Chat WhatsApp '+DEALER);
box.innerHTML='<div class="wch"><img src="'+u('assets/img/icon-white.svg')+'" alt="" width="34" height="34"><div><b></b><small>Akun bisnis · biasanya membalas dalam beberapa menit</small></div><button type="button" class="wcx" aria-label="Tutup chat">×</button></div><div class="wcl" aria-live="polite"></div><form class="wcf"><textarea rows="1" aria-label="Tulis pesan" placeholder="Ketik pesan"></textarea><button type="submit" aria-label="Kirim">'+'<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 20.5 21 12 3 3.5l.01 6.6L15 12 3.01 13.9z"/></svg></button></form><a class="wcskip" href="#" data-direct="1">Langsung buka WhatsApp</a>';
$('b',box).textContent=DEALER;document.body.appendChild(box);log=$('.wcl',box);ta=$('textarea',box);
$('.wcx',box).onclick=close;box.addEventListener('keydown',function(e){if(e.key==='Escape')close()});
ta.addEventListener('input',function(){ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight,110)+'px';if(!typed&&step===0){typed=true;send('typing',{});gev('chat_mengetik',{halaman:location.pathname})}});
ta.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('.wcf',box).requestSubmit?$('.wcf',box).requestSubmit():$('.wcf button',box).click()}});
$('.wcf',box).addEventListener('submit',function(e){e.preventDefault();var t=ta.value.trim();if(!t){ta.focus();return}if(step===0)firstMsg(t)});
$('.wcskip',box).addEventListener('click',function(e){e.preventDefault();go('lewati')})}
function open(href,cta){if(!box)build();var t='';try{t=(new URL(href,location.href).searchParams.get('text')||'').replace(' (dari iklan Google)','')}catch(e){}cur={href:href,text:t,cta:cta};typed=false;step=0;log.innerHTML='';ta.value=t;ta.disabled=false;$('.wcf',box).hidden=false;box.hidden=false;document.documentElement.classList.add('wcopen');
var c=document.createElement('div');c.className='wcctx';c.textContent='Obrolan dimulai dari halaman: '+document.title.split('|')[0].trim();log.appendChild(c);
dots(900,function(){bub('them',SALAM,'Salam otomatis')});setTimeout(function(){typed=true;ta.focus();ta.dispatchEvent(new Event('input'));typed=false},50);
send('open',{cta:cta,draft:t});gev('chat_buka',{halaman:location.pathname,posisi:cta})}
function close(){if(box){box.hidden=true;document.documentElement.classList.remove('wcopen')}}
function firstMsg(t){step=1;cur.msg=t;bub('me',t);ta.value='';ta.disabled=true;$('.wcf',box).hidden=true;send('send',{msg:t});gev('chat_kirim',{halaman:location.pathname});
dots(1100,function(){bub('them','Terima kasih! Supaya tim kami bisa langsung membalas, tulis nama dan nomor WhatsApp Anda, lalu lanjutkan ke WhatsApp.');
var f=document.createElement('form');f.className='wclead';f.innerHTML='<label>Nama<input name="n" autocomplete="name" required maxlength="60"></label><label>Nomor WhatsApp<input name="h" type="tel" inputmode="tel" autocomplete="tel" placeholder="08xxxxxxxxxx" required maxlength="18"></label><p class="wcerr" hidden>Nomor WhatsApp belum benar. Contoh: 081234567890</p><button class="btn" type="submit">Kirim dan lanjut ke WhatsApp</button><small>Dengan mengirim, Anda setuju dihubungi tim kami lewat WhatsApp.</small>';log.appendChild(f);log.scrollTop=log.scrollHeight;f.n.focus();
f.addEventListener('submit',function(e){e.preventDefault();var n=f.n.value.trim(),h=f.h.value.replace(/[^\d+]/g,'').replace(/^\+/,'');if(/^0/.test(h))h='62'+h.slice(1);if(/^8/.test(h))h='62'+h;var ok=/^628\d{7,12}$/.test(h);$('.wcerr',f).hidden=ok;if(!n){f.n.focus();return}if(!ok){f.h.focus();return}
cur.nama=n;cur.hp=h;send('lead',{nama:n,hp:h,msg:cur.msg});gev('chat_lead',{halaman:location.pathname});f.remove();bub('me',n+' · '+h);go('lead')})})}
function go(mode){var t=cur.msg||(ta&&ta.value.trim())||cur.text||'Halo, saya mau tanya XPeng';if(cur.nama)t='Halo, saya '+cur.nama+'. '+t.replace(/^halo,?\s*/i,'');if(ADS&&t.indexOf('dari iklan Google')<0)t+=' (dari iklan Google)';
send('wa',{mode:mode});gev('chat_ke_whatsapp',{halaman:location.pathname,mode:mode});window.open('https://wa.me/'+WA+'?text='+encodeURIComponent(t),'_blank','noopener');if(mode==='lead'){bub('them','Membuka WhatsApp... Pesan Anda sudah kami siapkan, tinggal tekan kirim.')}}
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href*="wa.me/"]');if(!a||a.dataset.direct||e.defaultPrevented||e.ctrlKey||e.metaKey)return;e.preventDefault();var pos=(a.closest('[data-cta]')||{dataset:{}}).dataset.cta||(a.classList.contains('wafab')?'melayang':'halaman');open(a.getAttribute('href'),pos)});
document.addEventListener('submit',function(e){var f=e.target;if(f&&f.classList&&f.classList.contains('lead')){var d=new FormData(f);send('form',{nama:String(d.get('nama')||''),msg:'Test drive '+(d.get('model')||'')+', rencana: '+(d.get('rencana')||'')})}},true);
})();
})();
