/* =============================================================================
   AI GPS — netlify/functions/execute.js
   Le SEUL endroit qui parle à une IA réelle. Même schéma que ton ai-router.js (M@Y) :
   la clé API vit uniquement ici, en variable d'environnement Netlify — jamais dans le front.

   DÉPLOIEMENT
   1. Place ce fichier dans : netlify/functions/execute.js (sur ton dépôt GitHub relié à Netlify)
   2. Netlify → Site configuration → Environment variables → ANTHROPIC_API_KEY = ta clé
   3. Redéploie. Le front appelle automatiquement /.netlify/functions/execute
   Aucune dépendance npm : fetch est natif (Node 18+ sur Netlify).
   ============================================================================= */

// Prompts système par type de besoin. Chacun cadre le rôle de l'IA pour l'étape.
const SYSTEM = {
  idee: "Tu es product manager senior. Tu transformes une idée floue en concept précis et exploitable : concept en une phrase, public cible, ambiance, fonctionnalités clés. Tu poses au maximum 2 questions seulement si c'est indispensable, sinon tu proposes directement.",
  texte: "Tu es un rédacteur professionnel. Tu produis un texte clair, structuré et prêt à l'emploi, adapté à l'objectif décrit.",
  code: "Tu es développeur front-end senior. Tu produis un cahier des charges technique ou du code propre et commenté, et tu signales explicitement les éléments (assets, données) qui manquent.",
  audit: "Tu es auditeur produit et QA. Tu analyses ce qui t'est fourni : cohérence, bugs potentiels, UX, accessibilité, puis tu listes des améliorations priorisées. Tu ne proposes jamais de changement qui casserait une fonctionnalité existante.",
  recherche: "Tu es analyste. Tu synthétises l'information de façon structurée et tu distingues clairement les faits établis des points à vérifier.",
  data: "Tu es analyste de données. Tu résumes, tu extrais des insights actionnables et tu proposes des visualisations pertinentes.",
  presentation: "Tu es expert en présentations. Tu structures un contenu clair, concis et percutant, slide par slide.",
  marketing: "Tu es stratège marketing. Tu définis cible, angle et messages adaptés à l'objectif."
};

const MODEL = "claude-haiku-4-5-20251001"; // modèle éprouvé, rapide et économique (comme M@Y)

exports.handler = async (event) => {
  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST")
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Méthode non autorisée" }) };

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key)
    return { statusCode: 400, headers, body: JSON.stringify({ error: "ANTHROPIC_API_KEY absente des variables d'environnement Netlify" }) };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Corps de requête invalide" }) }; }

  const { need = "texte", prompt = "", context = "", lang = "fr" } = body;
  if (!prompt.trim())
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Prompt vide" }) };

  const langLine = lang === "en" ? "Answer in English." : "Réponds en français.";
  const system = (SYSTEM[need] || SYSTEM.texte) + " " + langLine;
  const userMessage = (context ? context + "\n\n---\n\n" : "") + prompt;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system,
        messages: [{ role: "user", content: userMessage }]
      })
    });

    if (!r.ok) {
      const detail = await r.text();
      return { statusCode: r.status, headers, body: JSON.stringify({ error: "Erreur API IA", detail }) };
    }

    const data = await r.json();
    const text = (data.content || []).map(b => b.text || "").join("\n").trim();
    return { statusCode: 200, headers, body: JSON.stringify({ text }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(err && err.message || err) }) };
  }
};
