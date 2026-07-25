/* ============================================================
   SHARED ATMOSPHERE — orbs, particles, magnetic buttons, toast
   ============================================================ */

function initAtmosphere(){
  // Floating gradient orbs
  gsap.to(".orb-1", { x: 60, y: 40, duration: 14, repeat: -1, yoyo: true, ease: "sine.inOut" });
  gsap.to(".orb-2", { x: -50, y: -30, duration: 16, repeat: -1, yoyo: true, ease: "sine.inOut" });
  gsap.to(".orb-3", { x: 40, y: -50, duration: 12, repeat: -1, yoyo: true, ease: "sine.inOut" });

  // Ambient particles
  const field = document.querySelector(".particles");
  if (field){
    const count = window.innerWidth < 700 ? 14 : 28;
    for (let i = 0; i < count; i++){
      const p = document.createElement("div");
      p.className = "particle";
      p.style.left = Math.random() * 100 + "vw";
      p.style.top = Math.random() * 100 + "vh";
      field.appendChild(p);
      gsap.to(p, {
        y: -(80 + Math.random() * 160),
        x: (Math.random() - 0.5) * 100,
        opacity: 0,
        duration: 6 + Math.random() * 8,
        repeat: -1,
        delay: Math.random() * 6,
        ease: "power1.out",
        onRepeat: () => { gsap.set(p, { y: 0, opacity: 0.5, top: 100 + Math.random() * 10 + "vh" }); }
      });
    }
  }
}

function initMagneticButtons(){
  document.querySelectorAll(".magnetic").forEach((btn) => {
    btn.addEventListener("mousemove", (e) => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      gsap.to(btn, { x: x * 0.25, y: y * 0.3, duration: 0.4, ease: "power2.out" });
    });
    btn.addEventListener("mouseleave", () => {
      gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1,0.4)" });
    });
  });
}

function revealStagger(selector, opts = {}){
  const els = gsap.utils.toArray(selector);
  if (!els.length) return;
  gsap.fromTo(els,
    { opacity: 0, y: opts.y ?? 26 },
    { opacity: 1, y: 0, duration: opts.duration ?? 0.8, stagger: opts.stagger ?? 0.09, ease: "power3.out", delay: opts.delay ?? 0 }
  );
}

function showToast(message, type = "success"){
  let el = document.querySelector(".toast");
  if (!el){
    el = document.createElement("div");
    el.className = "toast glass";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = `toast glass ${type}`;
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 3400);
}

function setLoading(active, text, sub){
  const overlay = document.querySelector(".loading-overlay");
  if (!overlay) return;
  if (text) overlay.querySelector(".loading-text").textContent = text;
  if (sub !== undefined) overlay.querySelector(".loading-sub").textContent = sub;
  overlay.classList.toggle("active", active);
}

document.addEventListener("DOMContentLoaded", () => {
  if (window.gsap){
    initAtmosphere();
    initMagneticButtons();
  }
});
