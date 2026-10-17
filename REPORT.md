# Informe del laboratori

Data: 17 d'octubre de 2026.
Entorn de proves: contenidor Linux sense GPU, 4 fils de CPU, Chromium 141 sense interfície (Playwright). Tot amb WASM.

## Avís important: què s'ha pogut mesurar aquí

La xarxa d'aquest contenidor **bloqueja `huggingface.co`**. No he pogut baixar cap model.
Per tant:

- **E1** s'ha executat i puntuat del tot.
- **E2, E3, E4 i E5** estan implementats, però **no s'han executat amb models reals**.
  No hi ha puntuacions de qualitat de E2 ni de E4. Els temps de més avall per a aquests experiments són estimacions, no mesures.
- Per comprovar que la càrrega de models, el WASM i la prova sense connexió funcionen, he fet servir un model NER
  minúscul generat aquí (`tests/fixtures`). Només prova la fontaneria. No té cap qualitat.

Les mesures de veritat han de sortir del teu portàtil. Les instruccions són al final.

### Tests que no s'han pogut executar

| Test | Estat aquí | Motiu |
|---|---|---|
| E1 troba totes les dades (Playwright i Node) | ✅ passa | |
| E1 marca la vista prèvia, exportació JSON | ✅ passa | |
| E2 fontaneria amb model de prova (WASM, càrrega local) | ✅ passa | |
| Sense connexió: E1 i E2 donen el mateix resultat | ✅ passa, amb el model de prova | Amb el model real s'executa sol quan es pot baixar |
| E3 detecta la IA de Chrome i ho diu | ✅ passa | |
| E2 es carrega i dona resultat **amb el model real** | ⏭️ saltat | Hugging Face bloquejat |
| E5 recuperació amb embeddings | ⏭️ saltat | Hugging Face bloquejat |
| E4 extracció amb model de xat | ⏭️ saltat | Hugging Face bloquejat i test pesat (`RUN_CHAT=1`) |
| WebLLM (E3, E4, E5) | no provat | Sense WebGPU aquí |
| IA de Chrome (E3) | no provat | Chromium 141 sense interfície: Summarizer `unavailable`, Prompt API inexistent |

Codi que mai s'ha executat i on cal mirar primer si alguna cosa falla al portàtil:
la generació amb Transformers.js (`src/lib/chat.js`, `apply_chat_template` amb `enable_thinking: false`),
WebLLM amb `response_format` i esquema JSON per a Qwen3.5, i les API de Chrome (`Summarizer`, `LanguageModel`).

## Resum per experiment

### E1. Dades personals amb regles

- **Model**: cap. **Pes**: 0 MB. **Llicència**: el codi del repo (MIT).
- **Temps aquí (WASM no cal, és JavaScript)**: menys d'1 ms per document. 0,1 ms per a 10 pàgines.
  Extreure el text amb PDF.js: uns 20 ms per a 10 pàgines.
- **Amb WebGPU**: igual. No depèn de la GPU.
- **Qualitat amb les mostres**: 44 de 44 dades trobades, 0 falsos positius, 0 oblits.

| Mostra | Encerts | Falsos positius | Oblits |
|---|---|---|---|
| ca-carta | 8/8 | 0 | 0 |
| ca-factura | 7/7 | 0 | 0 |
| es-formulario | 7/7 | 0 | 0 |
| es-factura | 7/7 | 0 | 0 |
| en-letter | 8/8 | 0 | 0 |
| en-invoice | 7/7 | 0 | 0 |
| Documents llargs (3) | 0/0 | 0 | 0 |

Compte: les mostres les he fet jo i les regles també. Un 100 % aquí no vol dir un 100 % amb documents reals.
Els tests de casos límit (`tests/unit/rules-edge.test.mjs`) comproven que no salten amb imports, dates,
números de factura, DNI amb lletra incorrecta ni IBAN amb control incorrecte.
Límits coneguts: telèfons estrangers no espanyols, codis postals sense context, NIF escrits amb separadors estranys,
i text de PDF escanejats (sense capa de text no hi ha res a llegir; caldria OCR).

### E2. Dades personals amb model

- **Models triats**:
  - `Xenova/bert-base-multilingual-cased-ner-hrl` (mBERT, 177M paràmetres). Uns 178 MB en q8. AFL-3.0, permet ús comercial.
  - `Xenova/distilbert-base-multilingual-cased-ner-hrl` (135M). Uns 135 MB en q8. AFL-3.0.
- **Per què**: són els NER multilingües petits que ja estan en ONNX per a Transformers.js.
  Etiqueten PER, ORG i LOC. Estan afinats en 10 llengües amb molts recursos, entre elles castellà i anglès.
  **El català no hi és**, però mBERT sí que el va veure al preentrenament i s'assembla molt al castellà.
  Per això he posat les dues versions: la gran per qualitat i la destil·lada per a mòbils.
- **Descartats**: models de PII amb llicència no comercial (per exemple, Piiranha, CC BY-NC-ND), models només en català
  sense versió ONNX, i GLiNER (cal un runtime a part).
- **Ajuda amb regles**: si el model marca un lloc que comença per "Carrer", "Calle", "Avinguda"..., s'hi afegeix el número i el pis.
- **Temps aquí**: no mesurat amb el model real. Amb el model de prova, la càrrega local trigava 1,6 s
  i el runtime d'ONNX (WASM) pesa **25,6 MB** que es baixen una sola vegada.
- **Què n'espero**: en un portàtil, uns 50 a 200 ms per tros de 512 tokens amb WASM. Una carta, menys d'1 s.
  Amb WebGPU no espero gaire guany: el model és petit i la GPU té un cost fix d'arrencada.
- **Qualitat**: pendent. Hi ha 10 a 13 entitats de model per mostra (noms, organitzacions, adreces i ciutats).

### E3. Resumir

| Opció | Model | Pes | Llicència | Estat aquí |
|---|---|---|---|---|
| IA de Chrome | Gemini Nano (API Summarizer) | El baixa Chrome, fora de la web | ⚠ Termes de Google | No disponible a Chromium sense interfície |
| Model de xat (WebLLM) | Qwen3.5 2B q4f16 | uns 1,3 GB | Apache-2.0 | No provat (sense WebGPU) |
| Model de xat (Transformers.js) | Qwen3 1.7B ONNX q4 | uns 1,4 GB | Apache-2.0 | No provat (sense models) |
| Model de resum | DistilBART CNN 6-6 | uns 290 MB | Apache-2.0 | No provat. **Només anglès** |

- **Per què Qwen**: Qwen3.5 diu suportar 201 llengües i Qwen3 119, totes dues amb català, i tenen llicència Apache-2.0.
  Llama 3.2 i Gemma 2 són a la llista per comparar, marcats amb ⚠ per la llicència.
- **Documents llargs**: WebLLM limita aquests models a 4.096 tokens de context. El resum es fa per trossos
  i després es resumeixen els resums (map-reduce). Un document de 10 pàgines són unes 5 o 6 crides.
- **Què n'espero amb WebGPU**: 20 a 60 tokens per segon de generació en un portàtil recent.
  Primera càrrega: el temps de baixar 1,3 GB. Després, de 5 a 15 s des de la memòria cau.
  Resum de 10 pàgines: de 30 s a 2 min.
- **Amb WASM (CPU)**: 2 a 6 tokens per segon. Un resum de 10 pàgines, diversos minuts. No és usable per a la gent.
- **IA de Chrome**: l'API Summarizer no ofereix el català com a llengua de sortida. Per a castellà i anglès pot anar bé
  en Chrome d'escriptori amb prou memòria. La web ho detecta i ho diu.
- **Qualitat**: els resums es guarden a "Resultats" i a l'exportació JSON perquè els llegeixis. No hi ha nota automàtica.

### E4. Extreure camps d'una factura

- **Model**: el de E3. WebLLM rep un esquema JSON (sortida guiada). Transformers.js no el té: es demana JSON i es valida després.
- **Validació**: es comprova que el JSON es pugui llegir, que hi hagi els sis camps i que els imports siguin números.
  Després es puntua camp per camp: NIF exacte, data normalitzada, imports amb marge d'un cèntim, emissor per coincidència de text.
- **Temps i qualitat**: no mesurats. Espero de 3 a 10 s per factura amb WebGPU.
- **Risc conegut**: la factura en anglès fa servir format `1,996.50` i les altres `1.337,05`. El model ha de tornar números.
  La puntuació accepta els dos formats si el model torna text.

### E5. Preguntes sobre un document llarg (RAG local)

- **Embeddings**: `Xenova/multilingual-e5-small` (MIT, uns 118 MB en q8). Alternativa: `paraphrase-multilingual-MiniLM-L12-v2` (Apache-2.0, 118 MB).
  e5-small està basat en XLM-R, que inclou el català.
- **Índex**: fragments d'unes 600 lletres per frases, amb solapament d'una frase. Cerca per similitud de cosinus en memòria.
- **Preguntes**: 5 per document llarg, amb la resposta correcta i una "dada clau" (per exemple, "410").
  La web indica si la dada clau és als fragments recuperats i a la resposta. No és una nota de qualitat.
- **Mode "només recuperació"**: funciona sense model de xat. Serveix per a màquines modestes i per provar la cerca sola.
- **Què n'espero**: indexar 10 pàgines, de 1 a 4 s amb WASM. Cada pregunta, menys de 100 ms de cerca,
  més el temps del model de xat (de 2 a 6 s amb WebGPU).

## Català

| Tasca | Com va en català |
|---|---|
| E1 regles | Igual que en castellà i anglès. No depèn de la llengua. Detecta "codi postal" i "C.P." com a context. |
| E2 NER | Probablement bé amb noms de persona i ciutats. Més dubtós amb organitzacions i carrers amb paraules catalanes. **Pendent de mesurar.** |
| E3 IA de Chrome | **No disponible** en català. |
| E3 DistilBART | **No serveix**: només anglès. |
| E3, E4, E5 amb Qwen | Qwen3.5 i Qwen3 diuen suportar el català. Els models de 2B solen tenir errors de gramàtica i interferències del castellà. Cal llegir els resums. |
| E5 embeddings | e5-small funciona raonablement en català segons la seva base (XLM-R). Pendent de mesurar. |

Els prompts estan escrits en la llengua del document, no en anglès. Això sol millorar la resposta en la llengua correcta.

## Recomanació

Provisional fins que tinguem les teves mesures amb WebGPU.

**Ja es pot posar en una eina per a usuaris normals (també al mòbil):**
- **E1. Detecció de dades personals amb regles.** Pes zero, instantani, sense model. Validació de DNI, NIE, NIF i IBAN.
  És la base d'una eina "revisa i ratlla les dades personals abans de compartir".

**Probablement també per a usuaris normals, amb una baixada avisada (uns 120 a 180 MB):**
- **E2. NER** com a ajuda a E1, amb revisió humana. Primer cal mesurar la qualitat en català.
- **E5 només recuperació.** Cercar "on parla de..." dins d'un document llarg. 118 MB, ràpid amb CPU.

**Només en ordinadors bons (WebGPU, 8 GB de memòria o més, 1 a 2,5 GB de baixada):**
- **E4. Camps de factura** amb Qwen3.5 2B. Si la puntuació surt bé, és la més útil per a gestories.
- **E3. Resum** i **E5 amb respostes**. Útils, però lents al principi i amb qualitat variable en català.

**Encara no:**
- Models de xat amb WASM (CPU): massa lents.
- Models de xat al mòbil: massa pes i massa memòria per a la majoria de mòbils.
- IA de Chrome per a català: no hi és.
- DistilBART per a català o castellà.

## Com executar-ho al teu portàtil

1. `git clone` del repo, `npm install`, `npm run dev`. Obre http://localhost:5173 amb Chrome o Edge.
2. A la pàgina d'inici comprova "WebGPU: sí" i "Aïllament entre orígens: sí".
3. **E1**: "Executa totes les mostres".
4. **E2**: tria "mBERT NER HRL (base)", backend automàtic, "Executa totes les mostres". Repeteix amb "DistilmBERT" i amb backend WASM.
5. **E3**: tria `ca-llarg`, motor WebLLM, model Qwen3.5 2B, "Resumeix amb el model de xat". Repeteix amb `es-llarg` i `en-llarg`.
   Si Chrome ofereix la seva IA, prova també l'opció 1. Prova DistilBART amb `en-llarg`.
6. **E4**: mateix motor i model. "Executa totes les factures".
7. **E5**: tria `ca-llarg` i "Indexa i respon". Repeteix amb les altres llengües.
8. **Resultats**: "Exporta els resultats (JSON)". Si m'envies el fitxer, omplo aquest informe amb les dades reals.

Per provar-ho sense connexió: carrega els models, desconnecta la xarxa i torna a executar E1 i E2.
Ho pots veure també amb el test automàtic: `npm run test:e2e -- offline`.
