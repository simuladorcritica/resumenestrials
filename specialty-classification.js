(function (root) {
  'use strict';

  const AREAS = Object.freeze(['Medicina Crítica', 'Medicina Interna']);
  const SPECIALTIES = Object.freeze([
    'Cardiolog\u00eda', 'Endocrinolog\u00eda', 'Gastroenterolog\u00eda', 'Geriatr\u00eda', 'Hematolog\u00eda',
    'Infectolog\u00eda', 'Medicina F\u00edsica y Rehabilitaci\u00f3n', 'Nefrolog\u00eda',
    'Neumolog\u00eda', 'Neurolog\u00eda', 'Reumatolog\u00eda'
  ]);
  const REVIEW = 'REVISAR_ESPECIALIDAD';

  const normalize = (value) => String(value || '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  const match = (text, patterns) => patterns.some((pattern) => pattern.test(text));

  // Disease and clinical setting rules intentionally precede drug/mechanism terms.
  // A rule needs a recognizable disease/context phrase; isolated terms such as
  // "anticoagulación", "sangrado" or "plaquetas" never select Hematología.
  const RULES = Object.freeze([
    ['Neumolog\u00eda', [
      /\b(?:embolia|tromboembolismo) pulmonar\b/, /\bhipertension pulmonar\b/,
      /\bepoc\b/, /\basma\b/, /\benfermedad (?:pulmonar|intersticial)\b/,
      /\bneumonia (?:adquirida|nosocomial|comunitaria)\b/
    ]],
    ['Neurolog\u00eda', [
      /\b(?:ictus|accidente cerebrovascular|hemorragia intracerebral)\b/,
      /\b(?:oclusion|estenosis) carotidea\b/, /\bneuro(?:log|critic)/,
      /\b(?:epilepsia|esclerosis multiple)\b/
    ]],
    ['Cardiolog\u00eda', [
      /\b(?:stemi|nstemi|sindrome coronario agudo)\b/, /\binfarto (?:agudo )?(?:de miocardio|miocardico)\b/,
      /\b(?:intervencion coronaria percutanea|angioplastia|revascularizacion coronaria|stent)\b/,
      /\b(?:fibrilacion auricular|arritmia|monitorizacion electrocardiografica|sincope)\b/,
      /\benfermedad tromboembolica venosa\b/,
      /\binsuficiencia cardia?ca\b/, /\b(?:valvulopatia|tavi|ablacion cardiaca)\b/,
      /\b(?:enfermedad cardiovascular aterosclerotica|prevencion cardiovascular|lipidos|hipertension arterial|presion arterial)\b/,
      /\bshock cardiogenico\b/
    ]],
    ['Nefrolog\u00eda', [
      /\b(?:enfermedad|lesion) renal (?:cronica|aguda)\b/, /\b(?:nefro|dialisis|glomerul|albuminuria)\w*\b/,
      /\bterapia de reemplazo renal\b/
    ]],
    ['Endocrinolog\u00eda', [
      /\bdiabetes (?:mellitus |tipo )?[12]\b/, /\b(?:tiroid|suprarrenal|osteoporosis|obesidad)\w*\b/,
      /\bdiabetes y metabolismo\b/
    ]],
    ['Gastroenterolog\u00eda', [
      /\b(?:cirrosis|hepatitis|pancreatitis|enfermedad inflamatoria intestinal|hemorragia gastrointestinal)\b/,
      /\b(?:hepat|gastro|pancrea)\w*\b/
    ]],
    ['Infectolog\u00eda', [
      /\b(?:vih|tuberculosis|covid-?19|bacteriemia)\b/,
      /\b(?:infeccion|antibiotico|antimicrobiano|vacuna)\w*\b/
    ]],
    ['Reumatolog\u00eda', [
      /\b(?:artritis reumatoide|lupus|vasculitis|espondilitis|espondiloartritis)\b/
    ]],
    ['Hematolog\u00eda', [
      /\b(?:leucemia|linfoma|mieloma|hemofilia|trombocitopenia|purpura trombotica)\b/,
      /\b(?:anemia|hemoglobinopatia|sindrome mielodisplasico|enfermedad de von willebrand)\b/,
      /\b(?:neoplasia hematologica|trastorno primario de (?:la )?coagulacion)\b/
    ]]
  ]);

  function classify(record) {
    const primary = record?.especialidad_principal;
    const secondary = record?.especialidad_secundaria || '';
    if (!AREAS.includes(primary) || (secondary && !AREAS.includes(secondary) && !SPECIALTIES.includes(secondary))) {
      return { specialty: REVIEW, confidence: 'none', reason: 'Etiqueta fuera de la taxonomía canónica' };
    }
    if (primary !== 'Medicina Interna' && secondary !== 'Medicina Interna') return { specialty: '', confidence: 'not-applicable', reason: '' };

    if (secondary && SPECIALTIES.includes(secondary)) {
      return { specialty: secondary, confidence: 'high', reason: 'Subespecialidad clínica explícita y canónica' };
    }

    const fields = [
      [normalize(record?.titulo), 8],
      [normalize(Array.isArray(record?.temas) ? record.temas.join(' ') : ''), 5],
      [normalize(record?.objetivo), 3],
      [normalize(record?.cuerpo), 1]
    ];
    const scores = RULES.map(([specialty, patterns], order) => ({
      specialty, order,
      score: fields.reduce((total, [text, weight]) => total + (match(text, patterns) ? weight : 0), 0)
    })).filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score || a.order - b.order);
    if (scores.length && (scores[0].score >= 8 || (scores[0].score >= 5 && scores[0].score - (scores[1]?.score || 0) >= 3))) {
      return {
        specialty: scores[0].specialty,
        confidence: scores[0].score >= 11 ? 'high' : 'medium',
        reason: `Enfermedad y contexto clínico ponderados: ${scores[0].specialty}`
      };
    }
    return { specialty: REVIEW, confidence: 'low', reason: 'No existe evidencia contextual suficiente' };
  }

  root.SpecialtyClassification = Object.freeze({ AREAS, SPECIALTIES, REVIEW, classify, normalize });
})(typeof globalThis !== 'undefined' ? globalThis : window);
