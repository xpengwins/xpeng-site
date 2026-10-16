(function(){'use strict';
var B=document.body,$=function(s,r){return(r||document).querySelector(s)},$$=function(s,r){return[].slice.call((r||document).querySelectorAll(s))};
var WA=B.dataset.wa,base=B.dataset.base||'';
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
$$('.car').forEach(function(c){var tr=$('.track',c);if(!tr||tr.children.length<2)return;var w=document.createElement('div');w.className='cbtn';w.innerHTML='<button class="tab" aria-label="Geser kiri">←</button><button class="tab" aria-label="Geser kanan">→</button>';c.appendChild(w);var b=w.children;
b[0].onclick=function(){tr.scrollBy({left:-tr.clientWidth*.7,behavior:'smooth'})};b[1].onclick=function(){tr.scrollBy({left:tr.clientWidth*.7,behavior:'smooth'})}});
/* konfigurator */
var cfg=$('.cfg');if(cfg){var M=JSON.parse(cfg.dataset.models),mi=0,ci=0,img=$('#cfgimg'),sw=$('#sw'),sel=$('#var'),R=function(n){return 'Rp'+Math.round(n).toLocaleString('id-ID')};
function draw(){var m=M[mi];sw.innerHTML='';m.c.forEach(function(c,k){var b=document.createElement('button');b.style.background=c.hex;b.setAttribute('aria-label','Warna '+c.name);if(k===ci)b.className='on';b.onclick=function(){ci=k;draw()};sw.appendChild(b)});
img.style.opacity=.3;setTimeout(function(){img.src=u(m.c[ci].image);img.alt=m.n+' warna '+m.c[ci].name;img.style.opacity=1},120);$('#colname').textContent='Warna: '+m.c[ci].name;
var cur=sel.value;sel.innerHTML=m.v.map(function(v,k){return '<option value="'+k+'">'+v.name+'</option>'}).join('');sel.value=m.v[cur]?cur:0;calc()}
function calc(){var m=M[mi],v=m.v[sel.value||0],p=v.price,dp=+$('#dp').value,tn=+$('#tn').value,bg=+$('#bg').value;
$('#dpv').textContent=dp+'% ('+R(p*dp/100)+')';$('#tnv').textContent=tn+' tahun';$('#bgv').textContent=bg+'%';$('#harga').textContent=R(p);
var pk=p*(1-dp/100),r=bg/100/12,n=tn*12,c=r?pk*r/(1-Math.pow(1+r,-n)):pk/n;$('#cic').textContent=R(c)+' / bulan';
$('#cfgwa').href='https://wa.me/'+WA+'?text='+encodeURIComponent('Halo, saya tertarik '+v.name+' warna '+m.c[ci].name+'. Simulasi: DP '+dp+'%, tenor '+tn+' tahun. Boleh minta penawaran?')}
$$('.tab',cfg).forEach(function(t){if(t.dataset.m===undefined)return;t.onclick=function(){$$('.tab[data-m]',cfg).forEach(function(x){x.classList.remove('on')});t.classList.add('on');mi=+t.dataset.m;ci=0;draw()}});
sel.onchange=calc;['dp','tn','bg'].forEach(function(id){$('#'+id).oninput=calc});draw()}
/* form lead -> WhatsApp */
$$('form.lead').forEach(function(f){f.addEventListener('submit',function(e){e.preventDefault();var d=new FormData(f);if(!String(d.get('nama')||'').trim()){f.nama.focus();return}
var tx='Halo, saya '+d.get('nama')+'. Saya mau test drive '+d.get('model')+'. Rencana pembelian: '+d.get('rencana')+'. (dari website)';window.open('https://wa.me/'+WA+'?text='+encodeURIComponent(tx),'_blank','noopener')})});
/* reveal */
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.12});$$('.section h2,.mcard,.acard,.stats>div,.panel,.stage').forEach(function(el){el.classList.add('rv');io.observe(el)})}
if('serviceWorker' in navigator&&location.protocol==='https:'){navigator.serviceWorker.register(base+'/sw.js').catch(function(){})}
/* lightbox: klik foto galeri untuk zoom */
(function(){var imgs=$$('.track.g img,[data-zoom]');if(!imgs.length)return;
var ov=document.createElement('div');ov.className='lb';ov.hidden=true;ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label','Pratinjau foto');
ov.innerHTML='<button class="lbx" aria-label="Tutup">&times;</button><button class="lbp" aria-label="Foto sebelumnya">&lsaquo;</button><button class="lbn" aria-label="Foto berikutnya">&rsaquo;</button><div class="lbs"><img alt=""></div><div class="lbc"></div>';
document.body.appendChild(ov);
var im=$('img',ov),cap=$('.lbc',ov),sc=$('.lbs',ov),k=0,last=null;
function show(n){k=(n+imgs.length)%imgs.length;ov.classList.remove('zoom');im.src=imgs[k].currentSrc||imgs[k].src;im.alt=imgs[k].alt;cap.textContent=imgs[k].alt+' ('+(k+1)+'/'+imgs.length+') \u2022 ketuk foto untuk zoom'}
function open(n){last=document.activeElement;show(n);ov.hidden=false;document.documentElement.style.overflow='hidden';$('.lbx',ov).focus()}
function close(){ov.hidden=true;document.documentElement.style.overflow='';if(last&&last.focus)last.focus()}
function tz(){var z=ov.classList.toggle('zoom');cap.textContent=z?'Geser untuk melihat detail \u2022 ketuk lagi untuk kecilkan':imgs[k].alt+' ('+(k+1)+'/'+imgs.length+') \u2022 ketuk foto untuk zoom';if(z){sc.scrollLeft=(sc.scrollWidth-sc.clientWidth)/2;sc.scrollTop=(sc.scrollHeight-sc.clientHeight)/2}}
imgs.forEach(function(g,n){g.setAttribute('tabindex','0');g.setAttribute('role','button');g.style.cursor='zoom-in';g.addEventListener('click',function(){open(n)});g.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();open(n)}})});
$('.lbx',ov).onclick=close;$('.lbp',ov).onclick=function(){show(k-1)};$('.lbn',ov).onclick=function(){show(k+1)};
im.onclick=tz;sc.addEventListener('click',function(e){if(e.target===sc&&!ov.classList.contains('zoom'))close()});
document.addEventListener('keydown',function(e){if(ov.hidden)return;if(e.key==='Escape')close();else if(e.key==='ArrowLeft')show(k-1);else if(e.key==='ArrowRight')show(k+1)});
var sx=null;sc.addEventListener('touchstart',function(e){sx=ov.classList.contains('zoom')?null:e.touches[0].clientX},{passive:true});
sc.addEventListener('touchend',function(e){if(sx===null)return;var d=e.changedTouches[0].clientX-sx;if(Math.abs(d)>50)show(k+(d<0?1:-1));sx=null})})();
})();
