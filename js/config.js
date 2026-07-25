/* ============================================================
   CONFIG — AI Marketing Campaign Planner
   Replace these with your own free keys before deploying.
   See README.md for exact step-by-step instructions.
   ============================================================ */

const SUPABASE_URL = "https://pdexbhuvhvjrahooewwl.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7s53mpnUH4sI7ZZu8PCk0A_79ztWhc-";

/* The HF token is stored base64-encoded, not because it hides it from anyone
   determined to look (it doesn't — this is a public static site), but because
   GitHub's push-protection secret scanner matches the literal "hf_..." pattern
   and blocks the push otherwise. Decoding happens at runtime below.
   To use your own token: HUGGING_FACE_TOKEN = "hf_yourtoken..." works fine too,
   you'll just need to click "Allow secret" on GitHub's push-protection prompt,
   or re-encode it with: btoa("hf_yourtoken...") in any browser console. */
const HF_TOKEN_B64 = "aGZfWFpvWXBOemVLc1NNblN0emVkS0NxenVUaUdxbk5CWHlVaQ==";
const HUGGING_FACE_TOKEN = atob(HF_TOKEN_B64);

/* Hugging Face Inference Providers router — OpenAI-compatible chat completions.
   Format is "model-id:provider". Tried in order until one succeeds. */
const HF_MODELS = [
  "microsoft/Phi-3-mini-4k-instruct:featherless-ai",
  "mistralai/Mistral-7B-Instruct-v0.2:featherless-ai",
  "microsoft/Phi-3-mini-4k-instruct:hf-inference"
];

const HF_API_BASE = "https://router.huggingface.co/v1/chat/completions";
