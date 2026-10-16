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
})();
