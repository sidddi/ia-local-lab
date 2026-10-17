# ia-local-lab: context per a Claude

Laboratori personal (no és un producte) per mesurar quines tasques d'IA sobre documents
es poden fer bé dins del navegador, sense enviar el document enlloc, en un portàtil normal i en un mòbil.
Si un experiment surt bé, podria acabar com una eina de TotPDF (https://totpdf.com).
Públic final: gestories, despatxos, escoles i particulars. Llengües: català, castellà i anglès. El català és important.

## Regles
- Cap document surt del navegador. Cap analítica ni script de tercers.
  Les úniques baixades permeses són el codi de la web i els models.
- Durant el laboratori els models es baixen de Hugging Face. Per a cada model cal apuntar
  d'on es baixa, quant pesa i quina llicència té (a `src/models.js` i al README).
  Marca les llicències amb condicions (Llama, Gemma...) o no comercials.
- Només dades inventades i evidents. Res de dades reals ni documents que semblin d'organismes reals.
- Dependències amb versió fixada (`save-exact`). Stack: Vite + JavaScript.
- Tot ha de funcionar també amb WebAssembly (CPU). El contenidor de proves no té GPU.
- Repo públic: cap referència a la feina de l'autor ni a cap organisme. Cap secret al codi
  (tokens a `.env`, amb `.env.example`). Els models no es pugen (`public/models/` és a `.gitignore`).
- Textos de la web i del README: sense guions llargs ni mitjans com a puntuació. Frases curtes.

## Estructura
- `index.html`: CSP i navegació. `src/main.js`: rutes per hash.
- `src/pages/`: una pàgina per experiment (E1 a E5) i `results.js`.
- `src/lib/`: PDF.js, regles (E1), NER (E2), xat (WebLLM, Transformers.js, Chrome), RAG, puntuació, mètriques.
- `src/models.js`: registre de models amb origen, pes i llicència.
- `scripts/make-samples.mjs`: genera les mostres PDF i la resposta correcta (`public/samples/`).
- `scripts/fetch-models.mjs`: copia models a `public/models/` per servir-los des del mateix origen.
- `scripts/make-tiny-ner.py`: model NER de prova (sense qualitat) per als tests de fontaneria.
- `tests/unit/`: tests de Node. `tests/e2e/`: Playwright amb Chromium (WASM).

## Ordres
- `npm run dev`, `npm test`, `npm run samples`, `npm run fetch-models`.
