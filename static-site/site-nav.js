/* ============================================================
   damirbuilds — shared navbar + footer component
   Edit the markup below once and it updates on every page that
   loads this script. Also wires up the dropdown menu and the
   site-wide custom cursor, both via event delegation so they
   work no matter when <site-nav>/<site-footer> render.
   ============================================================ */
(function(){

  /* The theme-toggle button is rendered twice: one copy sits next to
     the hamburger (visible on mobile only, always reachable without
     opening the menu), the other lives inside .nav-links (visible on
     desktop only, where nav-links is just the normal inline row).
     Both share the .theme-toggle class so the existing click handler
     and syncThemeToggle() work on either one unchanged. Which copy is
     actually shown/hidden per breakpoint is pure CSS, see shared.css. */
  var THEME_TOGGLE_SVGS =
    '<svg class="icon-sun" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="10" cy="10" r="3.5"/><path d="M10 1.5v2M10 16.5v2M3.5 10h-2M18.5 10h-2M5.05 5.05L3.6 3.6M16.4 16.4l-1.45-1.45M5.05 14.95L3.6 16.4M16.4 3.6l-1.45 1.45"/></svg>' +
    '<svg class="icon-moon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M17 12.5A7 7 0 0 1 7.5 3 7.5 7.5 0 1 0 17 12.5z"/></svg>';

  var NAV_HTML =
    '<div class="wrap">' +
      '<a class="logo" href="/">damir<span>builds</span></a>' +
      '<div class="nav-mobile-controls">' +
        '<button class="theme-toggle theme-toggle--mobile" type="button" aria-label="Switch to light mode">' + THEME_TOGGLE_SVGS + '</button>' +
        '<button class="nav-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="navLinks">' +
          '<span></span><span></span><span></span>' +
        '</button>' +
      '</div>' +
      '<div class="nav-links" id="navLinks">' +
        '<div class="dropdown">' +
          '<button class="pill dropdown-trigger" type="button" aria-haspopup="true" aria-expanded="false">' +
            'Services' +
            '<span class="caret" aria-hidden="true"></span>' +
          '</button>' +
          '<div class="dropdown-menu">' +
            '<a href="/speed-to-lead.html">Speed-to-Lead System</a>' +
          '</div>' +
        '</div>' +
        '<a class="pill" href="/blog">Blog</a>' +
        '<a class="pill" href="/contact.html">Contact</a>' +
        '<a class="nav-cta" href="https://x.com/damirbuilds" target="_blank" rel="noopener">DM on X</a>' +
        '<button class="theme-toggle theme-toggle--desktop" type="button" aria-label="Switch to light mode">' + THEME_TOGGLE_SVGS + '</button>' +
      '</div>' +
    '</div>';

  var FOOTER_HTML =
    '<div class="wrap">' +
      '<a class="logo" href="/">damirbuilds</a>' +
      '<p>AI automations, built for revenue.</p>' +
      '<a class="footer-email" href="mailto:contact@damirbuilds.com">contact@damirbuilds.com</a>' +
    '</div>';

  /* Rendered inside real <nav>/<footer> tags (not just the <site-nav>/
     <site-footer> wrapper) so the existing nav{}/footer{} CSS selectors
     in shared.css keep matching. */
  customElements.define('site-nav', class extends HTMLElement{
    connectedCallback(){
      this.innerHTML = '<nav>' + NAV_HTML + '</nav>';
      syncThemeToggle();
    }
  });

  customElements.define('site-footer', class extends HTMLElement{
    connectedCallback(){ this.innerHTML = '<footer>' + FOOTER_HTML + '</footer>'; }
  });

  /* ---------- Light/dark theme toggle ----------
     The actual theme is set as early as possible by a small inline
     script in each page's <head> (before shared.css loads) to avoid
     a flash of the wrong theme. This just keeps the toggle button's
     icon/label in sync with the current html[data-theme], and flips
     it (+ persists the choice) on click. */
  function syncThemeToggle(){
    var btns = document.querySelectorAll('.theme-toggle');
    if(!btns.length) return;
    var isLight = document.documentElement.getAttribute('data-theme') === 'light';
    var label = isLight ? 'Switch to dark mode' : 'Switch to light mode';
    btns.forEach(function(btn){
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
    });
  }

  /* ---------- Dropdown open/close (delegated to document) ---------- */
  function closeAllDropdowns(){
    document.querySelectorAll('.dropdown.open').forEach(function(o){
      o.classList.remove('open');
      var t = o.querySelector('.dropdown-trigger');
      if(t) t.setAttribute('aria-expanded', 'false');
    });
  }

  /* ---------- Mobile nav menu ----------
     Below the CSS breakpoint, .nav-links becomes a hidden dropdown
     panel toggled by the hamburger button (.nav-toggle). Above the
     breakpoint both stay visually inert (nav-toggle is display:none,
     nav-links is always visible), so this logic is safe to run at
     any width. */
  function closeMobileMenu(){
    var links = document.querySelector('.nav-links');
    var toggle = document.querySelector('.nav-toggle');
    if(links) links.classList.remove('open');
    if(toggle){
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  }

  document.addEventListener('click', function(e){
    var navToggle = e.target.closest && e.target.closest('.nav-toggle');
    if(navToggle){
      var links = document.querySelector('.nav-links');
      var isOpen = navToggle.classList.contains('open');
      if(isOpen){
        closeMobileMenu();
      }else{
        if(links) links.classList.add('open');
        navToggle.classList.add('open');
        navToggle.setAttribute('aria-expanded', 'true');
      }
      return;
    }

    var themeBtn = e.target.closest && e.target.closest('.theme-toggle');
    if(themeBtn){
      var html = document.documentElement;
      var next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      html.setAttribute('data-theme', next);
      try{ localStorage.setItem('theme', next); }catch(err){}
      syncThemeToggle();
      return;
    }

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

    // Close the mobile menu when: a real navigation link inside it was
    // clicked (Blog, DM on X, Speed-to-Lead — don't leave the panel
    // open behind the new page/tab), or the click landed outside the
    // panel entirely. A click on non-link whitespace inside the open
    // panel (or on the dropdown trigger, handled above already) should
    // NOT close it.
    var clickedNavLink = e.target.closest && e.target.closest('.nav-links a');
    var clickedInsideNavLinks = e.target.closest && e.target.closest('.nav-links');
    if(clickedNavLink || !clickedInsideNavLinks){
      closeMobileMenu();
    }

    closeAllDropdowns();
  });

  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){
      closeAllDropdowns();
      closeMobileMenu();
    }
  });

  /* ---------- Custom cursor (site-wide) ---------- */
  if(window.matchMedia('(pointer: fine)').matches){
    var dot = document.createElement('div'); dot.id = 'cursor-dot';
    var ring = document.createElement('div'); ring.id = 'cursor-ring';
    document.addEventListener('DOMContentLoaded', function(){
      document.body.appendChild(dot);
      document.body.appendChild(ring);
    });

    var mouseX = 0, mouseY = 0, ringX = 0, ringY = 0, hasMoved = false;

    window.addEventListener('mousemove', function(e){
      mouseX = e.clientX; mouseY = e.clientY;
      dot.style.transform = 'translate(' + mouseX + 'px,' + mouseY + 'px) translate(-50%,-50%)';
      // Stay hidden (opacity:0 in CSS) until this first real mousemove —
      // otherwise both elements render pinned to the top-left corner
      // the instant the page loads, before the pointer ever moved there.
      if(!hasMoved){
        hasMoved = true;
        ringX = mouseX; ringY = mouseY;
        dot.classList.add('is-visible');
        ring.classList.add('is-visible');
      }
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
