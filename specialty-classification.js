(function (root) {
  'use strict';

  const AREAS = Object.freeze(['Medicina Crítica', 'Medicina Interna']);
  const SPECIALTIES = Object.freeze([
    'Cardiología', 'Cirugía', 'Endocrinología', 'Enfermedades Infecciosas',
    'Gastroenterología', 'Geriatría', 'Hematología', 'Infectología',
    'Medicina de Urgencias', 'Medicina Física y Rehabilitación', 'Nefrología',
    'Neumología', 'Neurología', 'Oncología', 'Oftalmología', 'Reumatología', 'VIH'
  ]);
  const REVIEW = 'REVISAR_ESPECIALIDAD';

  const normalize = (value) => String(value || '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  const match = (text, patterns) => patterns.some((pattern) => pattern.test(text));
  const CANONICAL_SPECIALTY = Object.freeze({
    'Enfermedades Infecciosas': 'Infectología',
    VIH: 'Infectología'
  });

  // Disease and clinical setting rules intentionally precede drug/mechanism terms.
  // A rule needs a recognizable disease/context phrase; isolated terms such as
  // "anticoagulación", "sangrado" or "plaquetas" never select Hematología.
  const RULES = Object.freeze([
    ['Neumología', [
      /\b(?:embolia|tromboembolismo) pulmonar\b/, /\bhipertension pulmonar\b/,
      /\bepoc\b/, /\basma\b/, /\benfermedad (?:pulmonar|intersticial)\b/,
      /\bneumonia (?:adquirida|nosocomial|comunitaria)\b/
    ]],
    ['Neurología', [
      /\b(?:ictus|accidente cerebrovascular|hemorragia intracerebral)\b/,
      /\b(?:oclusion|estenosis) carotidea\b/, /\bneuro(?:log|critic)/,
      /\b(?:epilepsia|esclerosis multiple)\b/
    ]],
    ['Medicina de Urgencias', [
      /\b(?:servicio|departamento) de urgencias\b/, /\bpacientes de urgencias\b/
    ]],
    ['Cardiología', [
      /\b(?:stemi|nstemi|sindrome coronario agudo)\b/, /\binfarto (?:agudo )?(?:de miocardio|miocardico)\b/,
      /\b(?:intervencion coronaria percutanea|angioplastia|revascularizacion coronaria|stent)\b/,
      /\b(?:fibrilacion auricular|arritmia|monitorizacion electrocardiografica|sincope)\b/,
      /\benfermedad tromboembolica venosa\b/,
      /\binsuficiencia cardia?ca\b/, /\b(?:valvulopatia|tavi|ablacion cardiaca)\b/,
      /\b(?:enfermedad cardiovascular aterosclerotica|prevencion cardiovascular|alto riesgo cardiovascular|lipidos|dislipidemia|colesterol ldl|hipertension arterial|presion arterial)\b/,
      /\bshock cardiogenico\b/
    ]],
    ['Nefrología', [
      /\b(?:enfermedad|lesion) renal (?:cronica|aguda)\b/, /\b(?:nefro|dialisis|glomerul|albuminuria)\w*\b/,
      /\bterapia de reemplazo renal\b/
    ]],
    ['Endocrinología', [
      /\bdiabetes (?:mellitus |tipo )?[12]\b/, /\b(?:tiroid|suprarrenal|osteoporosis|obesidad)\w*\b/,
      /\bdiabetes y metabolismo\b/
    ]],
    ['Gastroenterología', [
      /\b(?:cirrosis|hepatitis|pancreatitis|enfermedad inflamatoria intestinal|hemorragia gastrointestinal)\b/,
      /\b(?:hepat|gastro|pancrea)\w*\b/
    ]],
    ['Infectología', [
      /\b(?:vih|tuberculosis|covid-?19|bacteriemia)\b/,
      /\b(?:infeccion|antibiotico|antimicrobiano|vacuna)\w*\b/
    ]],
    ['Reumatología', [
      /\b(?:artritis reumatoide|lupus|vasculitis|espondilitis|espondiloartritis)\b/
    ]],
    ['Hematología', [
      /\b(?:leucemia|linfoma|mieloma|hemofilia|trombocitopenia|purpura trombotica)\b/,
      /\b(?:anemia|hemoglobinopatia|sindrome mielodisplasico|enfermedad de von willebrand)\b/,
      /\b(?:neoplasia hematologica|trastorno primario de (?:la )?coagulacion)\b/
    ]]
  ]);

  function classify(record) {
    const primary = record?.especialidad_principal;
    const secondary = record?.especialidad_secundaria || '';
    if ((!AREAS.includes(primary) && !SPECIALTIES.includes(primary))
      || (secondary && !AREAS.includes(secondary) && !SPECIALTIES.includes(secondary))) {
      return { specialty: REVIEW, confidence: 'none', reason: 'Etiqueta fuera de la taxonomía canónica' };
    }

    // Un ensayo cuyo contexto principal es Medicina Crítica ya está resuelto
    // clínicamente por área; no se fuerza una subespecialidad por palabras clave.
    if (primary === 'Medicina Crítica') {
      return { specialty: '', confidence: 'not-applicable', reason: 'Contexto principal de Medicina Crítica' };
    }

    if (SPECIALTIES.includes(primary)) {
      return { specialty: CANONICAL_SPECIALTY[primary] || primary, confidence: 'high', reason: 'Especialidad principal explícita y canónica' };
    }

    if (secondary && SPECIALTIES.includes(secondary)) {
      return { specialty: CANONICAL_SPECIALTY[secondary] || secondary, confidence: 'high', reason: 'Subespecialidad clínica explícita y canónica' };
    }

    if (/\b(?:servicio|departamento) de urgencias\b/.test(normalize(record?.objetivo))) {
      return { specialty: 'Medicina de Urgencias', confidence: 'medium', reason: 'Ámbito asistencial explícito: servicio de urgencias' };
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
