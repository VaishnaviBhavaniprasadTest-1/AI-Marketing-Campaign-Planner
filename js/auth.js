/* ============================================================
   AUTH — login / signup / session guard
   ============================================================ */

let authMode = "login"; // "login" | "signup"

const tabLogin = document.getElementById("tabLogin");
const tabSignup = document.getElementById("tabSignup");
const tabIndicator = document.getElementById("tabIndicator");
const submitLabel = document.getElementById("submitLabel");
const authForm = document.getElementById("authForm");
const authError = document.getElementById("authError");
const submitBtn = document.getElementById("submitBtn");

function setAuthMode(mode){
  authMode = mode;
  authError.textContent = "";
  if (mode === "login"){
    tabLogin.classList.add("active");
    tabSignup.classList.remove("active");
    tabIndicator.style.transform = "translateX(0%)";
    submitLabel.textContent = "Log In";
  } else {
    tabSignup.classList.add("active");
    tabLogin.classList.remove("active");
    tabIndicator.style.transform = "translateX(100%)";
    submitLabel.textContent = "Create Account";
  }
}

tabLogin.addEventListener("click", () => setAuthMode("login"));
tabSignup.addEventListener("click", () => setAuthMode("signup"));

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  submitBtn.disabled = true;
  setLoading(true, authMode === "login" ? "AUTHENTICATING" : "CREATING ACCOUNT", "Talking to Supabase…");

  try{
    if (authMode === "login"){
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.href = "dashboard.html";
    } else {
      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw error;
      setLoading(false);
      if (data.session){
        window.location.href = "dashboard.html";
      } else {
        authError.style.color = "var(--success)";
        authError.textContent = "Account created! Check your email to confirm, then log in.";
        setAuthMode("login");
      }
    }
  } catch(err){
    setLoading(false);
    authError.style.color = "var(--danger)";
    authError.textContent = err.message || "Something went wrong. Please try again.";
  } finally {
    submitBtn.disabled = false;
    setLoading(false);
  }
});

/* Redirect to dashboard if already logged in */
(async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session){
    window.location.href = "dashboard.html";
  } else {
    gsap.timeline()
      .fromTo("#authCard", { opacity: 0, y: 30, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: "power3.out" })
      .to(".reveal", { opacity: 1, y: 0, duration: 0.6, stagger: 0.07, ease: "power3.out" }, "-=0.5");
  }
})();
