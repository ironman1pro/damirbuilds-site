/* ============================================================
   damirbuilds — shared navbar + footer component
   Edit the markup below once and it updates on every page that
   loads this script. Also wires up the dropdown menu and the
   site-wide custom cursor, both via event delegation so they
   work no matter when <site-nav>/<site-footer> render.
   ============================================================ */
(function(){

  var NAV_HTML =
    '<div class="wrap">' +
      '<a class="logo" href="index.html">damir<span>builds</span></a>' +
      '<div class="nav-links">' +
        '<div class="dropdown">' +
          '<button class="pill dropdown-trigger" type="button" aria-haspopup="true" aria-expanded="false">' +
            'Services' +
            '<span class="caret" aria-hidden="true"></span>' +
          '</button>' +
          '<div class="dropdown-menu">' +
            '<a href="speed-to-lead.html">Speed-to-Lead System</a>' +
          '</div>' +
        '</div>' +
        '<a class="pill" href="/blog">Blog</a>' +
        '<a class="nav-cta" href="https://x.com/damirbuilds" target="_blank" rel="noopener">DM on X</a>' +
      '</div>' +
    '</div>';

  var FOOTER_HTML =
    '<div class="wrap">' +
      '<a class="logo" href="index.html">damirbuilds</a>' +
      '<p>AI automations, built for revenue.</p>' +
      '<a class="footer-email" href="mailto:contact@damirbuilds.com">contact@damirbuilds.com</a>' +
    '</div>';

  /* Rendered inside real <nav>/<footer> tags (not just the <site-nav>/
     <site-footer> wrapper) so the existing nav{}/footer{} CSS selectors
     in shared.css keep matching. */
  customElements.define('site-nav', class extends HTMLElement{
    connectedCallback(){ this.innerHTML = '<nav>' + NAV_HTML + '</nav>'; }
  });

  customElements.define('site-footer', class extends HTMLElement{
    connectedCallback(){ this.innerHTML = '<footer>' + FOOTER_HTML + '</footer>'; }
  });

  /* ---------- Dropdown open/close (delegated to document) ---------- */
  function closeAllDropdowns(){
    document.querySelectorAll('.dropdown.open').forEach(function(o){
      o.classList.remove('open');
      var t = o.querySelector('.dropdown-trigger');
      if(t) t.setAttribute('aria-expanded', 'false');
    });
  }

  document.addEventListener('click', function(e){
    var trigger = e.target.closest && e.target.closest('.dropdown-trigger');
    if(trigger){
      e.stopPropagation();
      var dd = trigger.closest('.dropdown');
      var isOpen = dd.classList.contains('open');
      closeAllDropdowns();
      if(!isOpen){
        dd.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
      }
      return;
    }
    closeAllDropdowns();
  });

  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape') closeAllDropdowns();
  });

  /* ---------- Custom cursor (site-wide) ---------- */
  if(window.matchMedia('(pointer: fine)').matches){
    var dot = document.createElement('div'); dot.id = 'cursor-dot';
    var ring = document.createElement('div'); ring.id = 'cursor-ring';
    document.addEventListener('DOMContentLoaded', function(){
      document.body.appendChild(dot);
      document.body.appendChild(ring);
    });

    var mouseX = 0, mouseY = 0, ringX = 0, ringY = 0;

    window.addEventListener('mousemove', function(e){
      mouseX = e.clientX; mouseY = e.clientY;
      dot.style.transform = 'translate(' + mouseX + 'px,' + mouseY + 'px) translate(-50%,-50%)';
    });

    function loop(){
      ringX += (mouseX - ringX) * 0.18;
      ringY += (mouseY - ringY) * 0.18;
      ring.style.transform = 'translate(' + ringX + 'px,' + ringY + 'px) translate(-50%,-50%)';
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    var hoverSelector = 'a, button, .logo, [role="button"]';
    document.addEventListener('mouseover', function(e){
      if(e.target.closest && e.target.closest(hoverSelector)){
        ring.classList.add('is-hover');
        dot.classList.add('is-hover');
      }
    });
    document.addEventListener('mouseout', function(e){
      if(e.target.closest && e.target.closest(hoverSelector)){
        ring.classList.remove('is-hover');
        dot.classList.remove('is-hover');
      }
    });
  }

})();
