import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../specialty-classification.js', import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(source, context);
const { classify, SPECIALTIES, REVIEW } = context.SpecialtyClassification;
const item = (titulo, temas = [], area = 'Medicina Interna') => ({
  titulo, temas, objetivo: titulo, cuerpo: titulo,
  especialidad_principal: area, especialidad_secundaria: ''
});

test('regresiones clínicas señaladas', () => {
  assert.equal(classify(item('PRAGUE-26: trombólisis por catéter en el tromboembolismo pulmonar', ['Anticoagulación'])).specialty, 'Neumología');
  assert.equal(classify(item('ASPIRED: monitorización electrocardiográfica ambulatoria inmediata en el síncope')).specialty, 'Cardiología');
  assert.equal(classify(item('PREMIUM: prasugrel tras angioplastia primaria por STEMI', ['Antiagregación plaquetaria'])).specialty, 'Cardiología');
  assert.equal(classify(item('A-CLOSE: clopidogrel tras stent farmacoactivo', ['Antiagregación plaquetaria'])).specialty, 'Cardiología');
});

test('un mecanismo aislado no determina Hematología', () => {
  for (const word of ['anticoagulación', 'antiagregación', 'sangrado', 'trombosis', 'fibrinólisis']) {
    assert.equal(classify(item(`Ensayo sin enfermedad definida: ${word}`)).specialty, REVIEW);
  }
});

test('controles de especialidad y contexto crítico', () => {
  assert.equal(classify(item('Tratamiento de la leucemia mieloide aguda')).specialty, 'Hematología');
  assert.equal(classify(item('Tratamiento de la enfermedad renal crónica')).specialty, 'Nefrología');
  assert.equal(classify(item('Angioplastia primaria en STEMI')).specialty, 'Cardiología');
  assert.equal(classify(item('Broncodilatador en EPOC')).specialty, 'Neumología');
  assert.equal(classify(item('Ventilación mecánica en shock séptico', [], 'Medicina Crítica')).specialty, '');
});

test('acepta Oftalmología como especialidad secundaria canónica sin desplazar la primaria', () => {
  const record = {
    ...item('TenCRAOS: tenecteplasa en la oclusión aguda de la arteria central de la retina', ['Trombólisis', 'Ictus'], 'Neurología'),
    especialidad_secundaria: 'Oftalmología'
  };
  assert.ok(SPECIALTIES.includes('Oftalmología'));
  assert.equal(classify(record).specialty, 'Neurología');
});

test('reconoce la estenosis aórtica y cirugía valvular como contexto de Cardiología', () => {
  const record = item(
    'RECOVERY: cirugía temprana frente a tratamiento conservador en la estenosis aórtica asintomática a 10 años',
    ['Cardiología', 'Estenosis aórtica', 'Cirugía valvular']
  );
  assert.equal(classify(record).specialty, 'Cardiología');
});

test('la taxonomía nunca contiene Medicina Interna General', () => {
  assert.ok(!SPECIALTIES.includes('Medicina Interna General'));
  assert.notEqual(classify(item('Pregunta clínica ambigua')).specialty, 'Medicina Interna General');
});

test('todos los resúmenes vigentes tienen área canónica y clasificación resoluble', () => {
  const data = JSON.parse(fs.readFileSync(new URL('../resumenes.json', import.meta.url), 'utf8'));
  for (const record of data) {
    const result = classify(record);
    assert.notEqual(result.specialty, REVIEW, `${record.id} ${record.titulo}: ${result.reason}`);
  }
});
