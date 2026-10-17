# ia-local-lab

Laboratori: IA local sobre documents, al navegador i sense pujar res.

Vull saber, amb dades, quines tasques d'IA sobre documents es poden fer bé dins del navegador.
Sense enviar el document enlloc. En un portàtil normal i en un mòbil.
És un laboratori, no un producte.

Els resultats i les recomanacions són a [REPORT.md](REPORT.md).

## Experiments

| | Tasca | Com |
|---|---|---|
| E1 | Dades personals amb regles | Expressions regulars i validació (DNI, NIE, NIF, IBAN, telèfon, correu, codi postal). Sense model. |
| E2 | Noms, adreces i organitzacions | Model NER petit amb Transformers.js, combinat amb E1. |
| E3 | Resumir | IA integrada de Chrome, model de xat (WebLLM o Transformers.js) i model de resum. |
| E4 | Camps d'una factura | Model de xat que respon en JSON. Es valida i es puntua camp per camp. |
| E5 | Preguntes sobre un document llarg | Embeddings locals, índex en memòria i model de xat (RAG). |

Cada pàgina mostra el resultat i les mètriques: pes baixat, temps de càrrega, temps per pàgina o document,
backend (WebGPU o WASM) i memòria, si el navegador la dona.
El botó "Exporta els resultats (JSON)" baixa totes les execucions amb el navegador i el dispositiu.

## Executar-ho

Cal Node 20 o més nou.

```bash
npm install
npm run dev
```

Obre http://localhost:5173. La primera vegada que executes un experiment amb model, el model es baixa de Hugging Face
i queda a la memòria cau del navegador.

### Al teu portàtil, amb WebGPU

1. Fes servir Chrome o Edge d'escriptori recents. Mira la pàgina d'inici: ha de dir "WebGPU: sí".
2. `npm install` i `npm run dev`.
3. Ves a cada experiment, tria la mostra i prem "Executa". A E1, E2 i E4 hi ha "Executa totes les mostres".
4. A E3, E4 i E5 tria el motor "WebLLM (WebGPU)" i el model "Qwen3.5 2B". Si vas justa de memòria, "Qwen3 1.7B".
5. Per comparar, repeteix E2 i E5 amb el backend "WASM (CPU)".
6. A la pàgina "Resultats" prem "Exporta els resultats (JSON)".

Per provar-ho al mòbil: `npx vite --host`, obre l'adreça de la xarxa local des del mòbil.
WebGPU i l'aïllament entre orígens necessiten HTTPS fora de `localhost`. Sense HTTPS, el mòbil anirà amb WASM d'un sol fil.

### Models al mateix origen (opcional)

```bash
npm run fetch-models                                   # NER, embeddings, resum i xat petit
npm run fetch-models -- --chat                         # afegeix Qwen3 1.7B ONNX
npm run fetch-models -- --webllm Qwen3.5-2B-q4f16_1-MLC
```

Els fitxers van a `public/models/` (no es puja al repo). La web els fa servir automàticament si hi són.

## Tests

La primera vegada, instal·la el Chromium de Playwright: `npx playwright install chromium`.

```bash
npm test             # tests unitaris (Node) i Playwright amb Chromium
npm run test:unit    # només els unitaris
RUN_CHAT=1 npm run test:e2e   # inclou el test pesat de E4 amb un model de xat
```

Els tests de Playwright fan servir Chromium sense GPU, és a dir WASM.
Els tests que necessiten un model real se salten si no el poden baixar, i ho diuen.
Hi ha un model NER minúscul de prova (`tests/fixtures`) que només serveix per comprovar la càrrega local,
el WASM i la prova sense connexió. No té cap qualitat.

## Privadesa comprovable

- `index.html` té una CSP. Només permet connexions al mateix origen i als dominis de models del laboratori:
  `huggingface.co`, `*.huggingface.co`, `*.hf.co` i `raw.githubusercontent.com` (biblioteques WASM de WebLLM).
- El runtime d'ONNX es serveix des del mateix origen (`/ort/`). Per defecte Transformers.js el baixaria d'un CDN.
- La pàgina d'inici llista totes les connexions que ha fet la web en aquesta sessió.
- Un test de Playwright carrega el model, posa el navegador sense connexió i torna a executar E1 i E2.
  El resultat ha de ser idèntic.
- No hi ha analítica, ni tipus de lletra externs, ni scripts de tercers.

### Com es faria a producció

1. Models allotjats al mateix domini (com fa `npm run fetch-models`), amb memòria cau llarga.
2. Biblioteques WASM de WebLLM també al mateix domini.
3. CSP enviada com a capçalera HTTP:
   `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self'; img-src 'self' data: blob:; style-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'`
4. Capçaleres `Cross-Origin-Opener-Policy: same-origin` i `Cross-Origin-Embedder-Policy: require-corp`
   per tenir WASM multifil. No es poden posar amb `<meta>`.
5. Amb `connect-src 'self'`, encara que hi hagués un error al codi, el navegador no deixaria enviar el document fora.

## Mostres

`npm run samples` genera 9 PDF a `public/samples/`: per a cada llengua (ca, es, en) una carta o formulari amb dades
personals, una factura i un document llarg de 10 pàgines. Cada PDF té un fitxer `.truth.json` amb la resposta correcta.
Totes les dades són inventades: noms, DNI i NIE amb lletra correcta, NIF d'empresa amb control correcte,
IBAN amb dígits de control correctes d'una entitat inventada (9000) i correus de dominis `example`.
Cada pàgina porta l'avís "Document de prova. Dades inventades".

## Models i llicències

Pes aproximat del fitxer que es baixa amb la configuració per defecte. La web mesura el pes real.

| Model | Ús | Origen | Pes aprox. | Llicència |
|---|---|---|---|---|
| Xenova/bert-base-multilingual-cased-ner-hrl | E2 | [Hugging Face](https://huggingface.co/Xenova/bert-base-multilingual-cased-ner-hrl) | 178 MB (q8) | AFL-3.0. Permet ús comercial. |
| Xenova/distilbert-base-multilingual-cased-ner-hrl | E2 | [Hugging Face](https://huggingface.co/Xenova/distilbert-base-multilingual-cased-ner-hrl) | 135 MB (q8) | AFL-3.0. Permet ús comercial. |
| Xenova/multilingual-e5-small | E5 | [Hugging Face](https://huggingface.co/Xenova/multilingual-e5-small) | 118 MB (q8) | MIT |
| Xenova/paraphrase-multilingual-MiniLM-L12-v2 | E5 | [Hugging Face](https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2) | 118 MB (q8) | Apache-2.0 |
| Xenova/distilbart-cnn-6-6 | E3 | [Hugging Face](https://huggingface.co/Xenova/distilbart-cnn-6-6) | 290 MB (q8) | Apache-2.0. Només anglès. |
| Qwen3.5-2B-q4f16_1-MLC | E3, E4, E5 (WebLLM) | [Hugging Face](https://huggingface.co/mlc-ai/Qwen3.5-2B-q4f16_1-MLC) | 1,3 GB | Apache-2.0 |
| Qwen3-1.7B-q4f16_1-MLC | E3, E4, E5 (WebLLM) | [Hugging Face](https://huggingface.co/mlc-ai/Qwen3-1.7B-q4f16_1-MLC) | 1 GB | Apache-2.0 |
| Qwen3.5-4B-q4f16_1-MLC | E3, E4, E5 (WebLLM) | [Hugging Face](https://huggingface.co/mlc-ai/Qwen3.5-4B-q4f16_1-MLC) | 2,5 GB | Apache-2.0 |
| Llama-3.2-3B-Instruct-q4f16_1-MLC | E3, E4, E5 (WebLLM) | [Hugging Face](https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC) | 1,8 GB | ⚠ Llama 3.2 Community License. Amb condicions. |
| gemma-2-2b-it-q4f16_1-MLC | E3, E4, E5 (WebLLM) | [Hugging Face](https://huggingface.co/mlc-ai/gemma-2-2b-it-q4f16_1-MLC) | 1,4 GB | ⚠ Gemma Terms of Use. Amb condicions. |
| onnx-community/Qwen3-1.7B-ONNX | E3, E4, E5 (Transformers.js) | [Hugging Face](https://huggingface.co/onnx-community/Qwen3-1.7B-ONNX) | 1,4 GB (q4) | Apache-2.0 |
| onnx-community/Qwen3-0.6B-ONNX | Proves amb CPU | [Hugging Face](https://huggingface.co/onnx-community/Qwen3-0.6B-ONNX) | 550 MB (q4) | Apache-2.0 |
| Gemini Nano (IA de Chrome) | E3 | El baixa Chrome | uns GB, fora de la web | ⚠ Termes de Chrome i política d'usos prohibits de Google. |

Les biblioteques WASM de WebLLM es baixen de `raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs` (Apache-2.0).

## Biblioteques

| Biblioteca | Versió | Llicència | Ús |
|---|---|---|---|
| @huggingface/transformers (Transformers.js) | 4.3.0 | Apache-2.0 | NER, embeddings, resum, xat amb WASM o WebGPU |
| onnxruntime-web | 1.31.0-dev.20260914 (la que fixa Transformers.js) | MIT | Runtime ONNX |
| @mlc-ai/web-llm | 0.2.85 | Apache-2.0 | Xat amb WebGPU |
| pdfjs-dist (PDF.js) | 6.3.289 | Apache-2.0 | Lectura i vista prèvia de PDF |
| vite | 8.3.1 | MIT | Servidor i empaquetat |
| pdf-lib | 1.17.1 | MIT | Generar les mostres (només desenvolupament) |
| @playwright/test | 1.56.1 | Apache-2.0 | Tests (només desenvolupament) |

## Estructura

```
index.html            CSP i navegació
src/pages/            una pàgina per experiment i la de resultats
src/lib/              PDF.js, regles, NER, xat, RAG, puntuació i mètriques
src/models.js         models amb origen, pes i llicència
scripts/              mostres, models al mateix origen i model de prova
public/samples/       PDF de prova i resposta correcta
tests/                unitaris (Node) i Playwright
```

## Llicència

[MIT](LICENSE). Siddharta Navarro.
