// Genera les 6 mostres PDF (2 per llengua) i la "resposta correcta" de cadascuna.
// Totes les dades són inventades. Ús: npm run samples
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dniLetter, cifControl, makeSpanishIban, formatIban } from '../src/lib/ids.js';
import longCa from './content/long-ca.mjs';
import longEs from './content/long-es.mjs';
import longEn from './content/long-en.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'samples');

const dni = (n) => `${n}${dniLetter(n)}`;
const nie = (prefix, n) => `${prefix}${n}${dniLetter('XYZ'.indexOf(prefix) + n)}`;
const cif = (l, d7) => `${l}${d7}${cifControl(d7).digit}`;
// Entitat 9000 inventada: IBAN amb dígits de control correctes però de prova.
const iban = (office, account) => formatIban(makeSpanishIban('9000', office, account));

const BANNER = {
  ca: 'DOCUMENT DE PROVA · DADES INVENTADES',
  es: 'DOCUMENTO DE PRUEBA · DATOS INVENTADOS',
  en: 'TEST DOCUMENT · INVENTED DATA',
};
const PAGE_LABEL = { ca: 'Pàgina', es: 'Página', en: 'Page' };
const OF = { ca: 'de', es: 'de', en: 'of' };

// ---------- Dades inventades ----------

const D = {
  ca: {
    dniA: dni('47851236'),
    nieA: nie('X', '1234567'),
    iban: iban('0101', '1234567890'),
    dniInvClient: dni('40987654'),
    cifInv: cif('B', '1758392'),
    ibanInv: iban('0202', '9876543210'),
  },
  es: {
    dniA: dni('20345678'),
    nieA: nie('Z', '9876543'),
    iban: iban('0303', '5550001112'),
    cifInv: cif('B', '4687213'),
    cifClient: cif('B', '4612345'),
    ibanInv: iban('0404', '2223334445'),
  },
  en: {
    nieA: nie('Y', '2345678'),
    nieB: nie('X', '7654321'),
    iban: iban('0505', '6667778889'),
    cifInv: cif('B', '0398765'),
    nieInvClient: nie('Y', '8765432'),
    ibanInv: iban('0606', '1112223334'),
  },
};

// ---------- Contingut de cada mostra ----------
// Cada línia és text pla; "p:" vol dir paràgraf amb salt de línia automàtic.

function letterCa() {
  const d = D.ca;
  const lines = [
    { t: 'Martina Vilaró Puig', b: true },
    'Carrer de les Magnòlies, 14, 3r 2a',
    '17003 Girona',
    'Tel. 612 345 678',
    'martina.vilaro@example.com',
    '',
    { t: "Acadèmia d'Idiomes Babel Verd SL", b: true },
    "Departament d'administració",
    '',
    'Girona, 3 de febrer de 2026',
    '',
    { t: 'Assumpte: canvi de compte de domiciliació i persona autoritzada', b: true },
    '',
    'Benvolguts senyors,',
    '',
    `p:Jo, Martina Vilaró Puig, amb DNI ${d.dniA}, mare de l'alumne Pau Serra Vilaró, us demano que a partir del mes de març carregueu les quotes de l'acadèmia al compte següent:`,
    '',
    `IBAN: ${d.iban}`,
    'Titular: Martina Vilaró Puig',
    '',
    `p:També autoritzo el senyor Ahmed Benali Haddou, amb NIE ${d.nieA}, a recollir el meu fill a la sortida de les classes dels dimarts i dijous.`,
    'El seu telèfon és el +34 698 12 34 56.',
    '',
    "p:Per a qualsevol dubte, em podeu trucar al 972 41 23 56 o escriure'm a l'adreça de correu indicada a dalt.",
    '',
    'Atentament,',
    '',
    'Martina Vilaró Puig',
  ];
  const truth = {
    pii: [
      { type: 'DNI', value: d.dniA },
      { type: 'NIE', value: d.nieA },
      { type: 'IBAN', value: d.iban },
      { type: 'TEL', value: '612 345 678' },
      { type: 'TEL', value: '+34 698 12 34 56' },
      { type: 'TEL', value: '972 41 23 56' },
      { type: 'EMAIL', value: 'martina.vilaro@example.com' },
      { type: 'CP', value: '17003' },
      { type: 'PER', value: 'Martina Vilaró Puig' },
      { type: 'PER', value: 'Pau Serra Vilaró' },
      { type: 'PER', value: 'Ahmed Benali Haddou' },
      { type: 'ORG', value: "Acadèmia d'Idiomes Babel Verd SL" },
      { type: 'LOC', value: 'Carrer de les Magnòlies, 14, 3r 2a' },
      { type: 'LOC', value: 'Girona' },
    ],
  };
  return { id: 'ca-carta', lang: 'ca', kind: 'personal', title: 'Carta amb dades personals', lines, truth };
}

function formEs() {
  const d = D.es;
  const lines = [
    { t: 'FORMULARIO DE INSCRIPCIÓN', b: true, size: 15 },
    { t: 'Club de Senderismo Las Encinas', b: true },
    'Temporada 2026',
    '',
    { t: 'Datos de la persona socia', b: true },
    'Nombre y apellidos: Lucía Fernández Ortega',
    `DNI: ${d.dniA}`,
    'Fecha de nacimiento: 14/05/1987',
    'Domicilio: Calle del Almendro Azul, 27, 2º B',
    'Código postal: 46015    Localidad: Valencia',
    'Teléfono móvil: 655 908 123',
    'Correo electrónico: lucia.fernandez@example.org',
    '',
    { t: 'Datos bancarios para la domiciliación', b: true },
    `IBAN: ${d.iban}`,
    '',
    { t: 'Menor a cargo inscrito', b: true },
    'Nombre: Daniel Molina Fernández    Fecha de nacimiento: 02/09/2015',
    '',
    { t: 'Contacto de emergencia', b: true },
    `Nombre: Javier Molina Ruiz    NIE: ${d.nieA}`,
    'Teléfono: 963 21 45 87',
    '',
    'p:La persona firmante autoriza al Club de Senderismo Las Encinas a cargar la cuota anual en la cuenta indicada y declara que los datos son correctos. Los datos se usarán solo para gestionar la inscripción.',
    '',
    'Firma: Lucía Fernández Ortega',
    'Valencia, 12 de enero de 2026',
  ];
  const truth = {
    pii: [
      { type: 'DNI', value: d.dniA },
      { type: 'NIE', value: d.nieA },
      { type: 'IBAN', value: d.iban },
      { type: 'TEL', value: '655 908 123' },
      { type: 'TEL', value: '963 21 45 87' },
      { type: 'EMAIL', value: 'lucia.fernandez@example.org' },
      { type: 'CP', value: '46015' },
      { type: 'PER', value: 'Lucía Fernández Ortega' },
      { type: 'PER', value: 'Daniel Molina Fernández' },
      { type: 'PER', value: 'Javier Molina Ruiz' },
      { type: 'ORG', value: 'Club de Senderismo Las Encinas' },
      { type: 'LOC', value: 'Calle del Almendro Azul, 27, 2º B' },
      { type: 'LOC', value: 'Valencia' },
    ],
  };
  return { id: 'es-formulario', lang: 'es', kind: 'personal', title: 'Formulario con datos personales', lines, truth };
}

function letterEn() {
  const d = D.en;
  const lines = [
    { t: 'Oliver James Whitmore', b: true },
    'Calle Mar Menor, 5, 1º A',
    '03001 Alicante',
    'Mobile: +34 622 418 907',
    'oliver.whitmore@example.net',
    '',
    { t: 'Harbour Lane Language School SL', b: true },
    'Student Office',
    '',
    'Alicante, 20 January 2026',
    '',
    { t: 'Subject: update of my personal and bank details', b: true },
    '',
    'Dear Sir or Madam,',
    '',
    `p:My name is Oliver James Whitmore and my foreign resident number (NIE) is ${d.nieA}. I am writing to update the details you hold for my enrolment in the evening Spanish course.`,
    '',
    'p:Please charge the course fees to my new account from February onwards:',
    `IBAN: ${d.iban}`,
    '',
    `p:I would also like to add my partner, Hannah Clarke, as a second contact. Her NIE is ${d.nieB} and she can be reached on 611 02 03 04.`,
    '',
    'p:If you need anything else, please call me on my mobile or on my office line, 965 12 34 87.',
    '',
    'Kind regards,',
    '',
    'Oliver James Whitmore',
  ];
  const truth = {
    pii: [
      { type: 'NIE', value: d.nieA },
      { type: 'NIE', value: d.nieB },
      { type: 'IBAN', value: d.iban },
      { type: 'TEL', value: '+34 622 418 907' },
      { type: 'TEL', value: '611 02 03 04' },
      { type: 'TEL', value: '965 12 34 87' },
      { type: 'EMAIL', value: 'oliver.whitmore@example.net' },
      { type: 'CP', value: '03001' },
      { type: 'PER', value: 'Oliver James Whitmore' },
      { type: 'PER', value: 'Hannah Clarke' },
      { type: 'ORG', value: 'Harbour Lane Language School SL' },
      { type: 'LOC', value: 'Calle Mar Menor, 5, 1º A' },
      { type: 'LOC', value: 'Alicante' },
    ],
  };
  return { id: 'en-letter', lang: 'en', kind: 'personal', title: 'Letter with personal data', lines, truth };
}

function invoiceCa() {
  const d = D.ca;
  const lines = [
    { t: 'Fusteria Can Roure SL', b: true, size: 15 },
    `NIF: ${d.cifInv}`,
    'Polígon Les Mates, nau 7, 17190 Salt',
    'Tel. 972 23 45 67 · factures@canroure.example.com',
    '',
    { t: 'FACTURA', b: true, size: 15 },
    'Número de factura: FCR-2026-0042',
    'Data de la factura: 15/01/2026',
    '',
    { t: 'Client', b: true },
    'Jordi Pons Bosch',
    `DNI: ${d.dniInvClient}`,
    'Carrer Major, 45, 17004 Girona',
    '',
    { cols: ['Concepte', 'Quantitat', 'Preu', 'Import'], b: true },
    { cols: ["Porta d'entrada de roure", '1', '850,00 €', '850,00 €'] },
    { cols: ['Instal·lació (hores)', '3', '45,00 €', '135,00 €'] },
    { cols: ['Tractament de la fusta', '1', '120,00 €', '120,00 €'] },
    '',
    'Base imposable: 1.105,00 €',
    'IVA (21 %): 232,05 €',
    { t: 'Total a pagar: 1.337,05 €', b: true },
    '',
    'Forma de pagament: transferència en 30 dies.',
    `IBAN: ${d.ibanInv}`,
  ];
  const truth = {
    pii: [
      { type: 'NIF', value: d.cifInv },
      { type: 'DNI', value: d.dniInvClient },
      { type: 'IBAN', value: d.ibanInv },
      { type: 'TEL', value: '972 23 45 67' },
      { type: 'EMAIL', value: 'factures@canroure.example.com' },
      { type: 'CP', value: '17190' },
      { type: 'CP', value: '17004' },
      { type: 'PER', value: 'Jordi Pons Bosch' },
      { type: 'ORG', value: 'Fusteria Can Roure SL' },
      { type: 'LOC', value: 'Polígon Les Mates, nau 7' },
      { type: 'LOC', value: 'Salt' },
      { type: 'LOC', value: 'Carrer Major, 45' },
      { type: 'LOC', value: 'Girona' },
    ],
    invoice: { emissor: 'Fusteria Can Roure SL', nif: d.cifInv, data: '2026-01-15', base: 1105.0, iva: 232.05, total: 1337.05 },
  };
  return { id: 'ca-factura', lang: 'ca', kind: 'invoice', title: 'Factura inventada', lines, truth };
}

function invoiceEs() {
  const d = D.es;
  const lines = [
    { t: 'Reformas Hermanos Lozano SL', b: true, size: 15 },
    `NIF: ${d.cifInv}`,
    'Avenida del Puerto Viejo, 112, 46023 Valencia',
    'Tel. 961 234 567 · administracion@hlozano.example.com',
    '',
    { t: 'FACTURA', b: true, size: 15 },
    'N.º de factura: HL-0317',
    'Fecha de emisión: 28/02/2026',
    '',
    { t: 'Datos del cliente', b: true },
    'Panadería Trigo Dorado SL',
    `CIF: ${d.cifClient}`,
    'Calle de la Harina, 9, 46021 Valencia',
    '',
    { cols: ['Descripción', 'Unidades', 'Precio', 'Importe'], b: true },
    { cols: ['Alicatado de obrador (m²)', '40', '38,00 €', '1.520,00 €'] },
    { cols: ['Instalación eléctrica', '1', '720,00 €', '720,00 €'] },
    { cols: ['Pintura y remates', '1', '240,00 €', '240,00 €'] },
    '',
    'Base imponible: 2.480,00 €',
    'IVA 21 %: 520,80 €',
    { t: 'TOTAL FACTURA: 3.000,80 €', b: true },
    '',
    'Pago por transferencia a la cuenta:',
    `IBAN: ${d.ibanInv}`,
  ];
  const truth = {
    pii: [
      { type: 'NIF', value: d.cifInv },
      { type: 'NIF', value: d.cifClient },
      { type: 'IBAN', value: d.ibanInv },
      { type: 'TEL', value: '961 234 567' },
      { type: 'EMAIL', value: 'administracion@hlozano.example.com' },
      { type: 'CP', value: '46023' },
      { type: 'CP', value: '46021' },
      { type: 'ORG', value: 'Reformas Hermanos Lozano SL' },
      { type: 'ORG', value: 'Panadería Trigo Dorado SL' },
      { type: 'LOC', value: 'Avenida del Puerto Viejo, 112' },
      { type: 'LOC', value: 'Calle de la Harina, 9' },
      { type: 'LOC', value: 'Valencia' },
    ],
    invoice: { emissor: 'Reformas Hermanos Lozano SL', nif: d.cifInv, data: '2026-02-28', base: 2480.0, iva: 520.8, total: 3000.8 },
  };
  return { id: 'es-factura', lang: 'es', kind: 'invoice', title: 'Factura inventada', lines, truth };
}

function invoiceEn() {
  const d = D.en;
  const lines = [
    { t: 'Bright Pixel Studio SL', b: true, size: 15 },
    `Tax ID (NIF): ${d.cifInv}`,
    'Calle Castaños, 31, 03002 Alicante',
    'Phone 965 987 321 · billing@brightpixel.example.com',
    '',
    { t: 'INVOICE', b: true, size: 15 },
    'Invoice number: BPS-2026-008',
    'Invoice date: 10/03/2026',
    '',
    { t: 'Bill to', b: true },
    'Sarah Collins',
    `NIE: ${d.nieInvClient}`,
    'Calle Pintor Sorolla, 18, 03015 Alicante',
    '',
    { cols: ['Description', 'Qty', 'Unit price', 'Amount'], b: true },
    { cols: ['Website design', '1', '1,200.00 €', '1,200.00 €'] },
    { cols: ['Photo editing (hours)', '6', '50.00 €', '300.00 €'] },
    { cols: ['Hosting set-up', '1', '150.00 €', '150.00 €'] },
    '',
    'Subtotal (tax base): 1,650.00 €',
    'VAT (IVA) 21%: 346.50 €',
    { t: 'Total due: 1,996.50 €', b: true },
    '',
    'Payment by bank transfer within 15 days.',
    `IBAN: ${d.ibanInv}`,
  ];
  const truth = {
    pii: [
      { type: 'NIF', value: d.cifInv },
      { type: 'NIE', value: d.nieInvClient },
      { type: 'IBAN', value: d.ibanInv },
      { type: 'TEL', value: '965 987 321' },
      { type: 'EMAIL', value: 'billing@brightpixel.example.com' },
      { type: 'CP', value: '03002' },
      { type: 'CP', value: '03015' },
      { type: 'PER', value: 'Sarah Collins' },
      { type: 'ORG', value: 'Bright Pixel Studio SL' },
      { type: 'LOC', value: 'Calle Castaños, 31' },
      { type: 'LOC', value: 'Calle Pintor Sorolla, 18' },
      { type: 'LOC', value: 'Alicante' },
    ],
    invoice: { emissor: 'Bright Pixel Studio SL', nif: d.cifInv, data: '2026-03-10', base: 1650.0, iva: 346.5, total: 1996.5 },
  };
  return { id: 'en-invoice', lang: 'en', kind: 'invoice', title: 'Invented invoice', lines, truth };
}

function longDoc(lang, content) {
  return {
    id: `${lang}-llarg`,
    lang,
    kind: 'long',
    title: content.title,
    long: content,
    truth: { pii: [], qa: content.qa },
  };
}

// ---------- Maquetació ----------

const A4 = [595.28, 841.89];
const M = 64;

function wrap(text, font, size, width) {
  const words = text.split(' ');
  const out = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

function banner(page, font, lang) {
  page.drawText(BANNER[lang], { x: M, y: A4[1] - 36, size: 8, font, color: rgb(0.55, 0.1, 0.1) });
}

async function renderForm(sample) {
  const doc = await PDFDocument.create();
  doc.setTitle(sample.title);
  doc.setAuthor('ia-local-lab (dades inventades)');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage(A4);
  banner(page, bold, sample.lang);
  let y = A4[1] - 80;
  const size = 11;
  const lh = 16;
  for (const raw of sample.lines) {
    const item = typeof raw === 'string' ? { t: raw } : raw;
    const f = item.b ? bold : font;
    const s = item.size ?? size;
    if (item.cols) {
      // Taula: primera columna alineada a l'esquerra, la resta a la dreta.
      const rights = [330, 430, A4[0] - M];
      item.cols.forEach((c, i) => {
        const x = i === 0 ? M : rights[i - 1] - f.widthOfTextAtSize(c, s);
        page.drawText(c, { x, y, size: s, font: f });
      });
      y -= lh;
      continue;
    }
    if (item.t.startsWith('p:')) {
      for (const l of wrap(item.t.slice(2), f, s, A4[0] - 2 * M)) {
        page.drawText(l, { x: M, y, size: s, font: f });
        y -= lh;
      }
      continue;
    }
    if (item.t) page.drawText(item.t, { x: M, y, size: s, font: f });
    y -= item.t ? lh + (s - size) : lh * 0.6;
  }
  return doc.save({ useObjectStreams: false });
}

async function renderLong(sample) {
  const c = sample.long;
  const doc = await PDFDocument.create();
  doc.setTitle(c.title);
  doc.setAuthor('ia-local-lab (contingut inventat)');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const size = 12.5;
  const lh = 19;
  const width = A4[0] - 2 * M;

  const cover = doc.addPage(A4);
  banner(cover, bold, sample.lang);
  let y = A4[1] - 260;
  for (const l of wrap(c.title, bold, 22, width)) {
    cover.drawText(l, { x: M, y, size: 22, font: bold });
    y -= 30;
  }
  cover.drawText(c.subtitle, { x: M, y: y - 10, size: 13, font });

  for (const sec of c.sections) {
    let page = doc.addPage(A4);
    banner(page, bold, sample.lang);
    y = A4[1] - 90;
    page.drawText(sec.h, { x: M, y, size: 16, font: bold });
    y -= 34;
    for (const para of sec.p) {
      for (const l of wrap(para, font, size, width)) {
        if (y < 70) {
          page = doc.addPage(A4);
          banner(page, bold, sample.lang);
          y = A4[1] - 80;
        }
        page.drawText(l, { x: M, y, size, font });
        y -= lh;
      }
      y -= lh * 0.6;
    }
  }
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawText(`${PAGE_LABEL[sample.lang]} ${i + 1} ${OF[sample.lang]} ${pages.length}`, {
      x: A4[0] - M - 70,
      y: 36,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
  });
  return doc.save({ useObjectStreams: false });
}

// ---------- Main ----------

const samples = [
  letterCa(),
  invoiceCa(),
  longDoc('ca', longCa),
  formEs(),
  invoiceEs(),
  longDoc('es', longEs),
  letterEn(),
  invoiceEn(),
  longDoc('en', longEn),
];

await mkdir(OUT, { recursive: true });
const index = [];
for (const s of samples) {
  const bytes = s.kind === 'long' ? await renderLong(s) : await renderForm(s);
  await writeFile(join(OUT, `${s.id}.pdf`), bytes);
  const truth = { id: s.id, lang: s.lang, kind: s.kind, title: s.title, ...s.truth };
  await writeFile(join(OUT, `${s.id}.truth.json`), JSON.stringify(truth, null, 2) + '\n');
  index.push({ id: s.id, lang: s.lang, kind: s.kind, title: s.title, pdf: `${s.id}.pdf`, truth: `${s.id}.truth.json` });
  console.log(`✓ ${s.id}.pdf (${(bytes.length / 1024).toFixed(1)} kB)`);
}
await writeFile(join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n');
