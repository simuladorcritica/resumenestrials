# Autorización controlada de correcciones clínicas

Este mecanismo permite corregir contenido clínico existente sin desactivar la protección global de `main`.

## Principios

- Sin manifest, el comportamiento sigue siendo de congelación estricta: los resúmenes existentes no pueden cambiar.
- El manifest se llama `clinical-correction-authorizations.json` y solo se usa en el PR que contiene la corrección.
- `base_sha` debe coincidir exactamente con el commit base del PR. Si `main` avanza, la autorización queda inválida y debe revisarse de nuevo.
- Cada autorización identifica un único `id` numérico y una lista explícita de `fields`.
- No se admiten comodines, `id` como campo, IDs duplicados ni campos duplicados.
- `reason` es obligatorio para mantener trazabilidad.
- El manifest debe corresponder exactamente con el diff: una autorización no usada hace fallar CI.
- Cualquier cambio adicional no declarado hace fallar CI.
- El cambio visible en el cuerpo de una página canónica solo se permite si el mismo ID tiene autorizado el campo `cuerpo`.
- Las altas nuevas siguen permitidas por la política existente; este mecanismo no modifica esa regla.

## Formato

```json
{
  "schema_version": 1,
  "base_sha": "0123456789abcdef0123456789abcdef01234567",
  "authorizations": [
    {
      "id": 46,
      "fields": ["cuerpo", "corto"],
      "reason": "Corrección documental aprobada y trazada en el expediente editorial correspondiente."
    }
  ]
}
```

## Flujo esperado

1. Verificar la discrepancia contra fuente primaria, suplemento, registro o guía aplicable.
2. Redactar la corrección propuesta sin cambiar todavía `main`.
3. Obtener autorización explícita para el ID y los campos concretos.
4. Crear el manifest ligado al SHA exacto de `main` que será base del PR.
5. Aplicar únicamente los cambios declarados.
6. Regenerar las páginas derivadas que correspondan.
7. Ejecutar CI. Los guards deben bloquear cualquier cambio fuera del manifest y cualquier autorización sobrante.
8. Revisar el PR y sus fuentes antes del merge.
9. Eliminar el manifest en una fase posterior una vez que la corrección haya sido integrada y el nuevo baseline sea `main`; no reutilizarlo para otra corrección.

Este control autoriza una modificación técnica concreta; no convierte una revisión documental o automatizada en revisión clínica humana ni crea por sí mismo un estado `CLINICALLY_REVIEWED`.
