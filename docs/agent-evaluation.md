# Evaluación comparativa de agentes (2026-10-19)

**Método.** Ambos agentes recibieron el mismo brief escrito, el mismo commit base (`cb3f8e3`) y un git worktree propio. Ninguno vio el resultado del otro. El orquestador (Claude Code) revisó cada entrega con evidencia propia:
- un script común que corre cada extractor sobre los 11 PDFs reales y busca fugas de datos sensibles;
- capturas de pantalla tomadas por el orquestador;
- typecheck, lint y tests.

**Participantes.**
- **Claude:** subagente `general-purpose` (Claude Opus 5.5).
- **Codex:** Codex CLI 0.160 vía el plugin `codex:codex-rescue`, en sandbox `workspace-write`.

## Tarea A: parser determinista de PDFs de propiedades

| Criterio (1–5) | Claude | Codex | Evidencia |
|---|---|---|---|
| Corrección | 5 | 3 | En el catálogo del banco, las págs. 8 y 13–21 dicen "VALOR (DE) VENTA" (verificado con `unpdf`). Claude las marcó `sale` y Codex `appraisal`. Codex dejó la latitud de Yaguachi en +2.09 (hemisferio norte, incorrecto); Claude la corrigió con confianza `low` y aviso. |
| Comprensión del negocio | 5 | 3 | Claude detectó que el brief estaba equivocado y lo justificó con el texto. Codex lo siguió al pie de la letra. |
| Calidad técnica | 4 | 4 | Ambos tienen funciones puras y tipos según la interfaz. Claude descarta fondos de plantilla repetidos al extraer imágenes (Pomasqui: 14 imágenes contra 24). |
| Simplicidad y mantenibilidad | 3 | 4 | Claude: 1.761 líneas en 9 archivos. Codex: 891 líneas. |
| Seguridad / privacidad | 5 | 5 | 0 fugas de teléfonos, nombres del banco, linderos o códigos catastrales en ambos. |
| Cumplimiento de requisitos | 4 | 3 | Claude se desvió del brief con evidencia. Codex modificó `package.json` sin pedirlo y no pudo hacer commit (el sandbox bloquea el index de git). |
| Calidad de pruebas | 5 | 3 | Claude: 54 tests. Codex: 22 tests. |
| Correcciones requeridas | 0 | 4 | Codex: commit manual, revertir `package.json`, tipo de precio y signo de latitud. |
| Tiempo | ~17 min | ~11 min | |

**Ganador: Claude.** Su rama se integró en `main`.

## Tarea B: dirección visual y componentes públicos

| Criterio (1–5) | Claude | Codex | Evidencia |
|---|---|---|---|
| Corrección | 5 | 2 | Codex: grilla de destacadas rota (tarjeta escalonada que queda aislada), aviso del loader de `next/image`. Claude: sin errores de JS y nav/lightbox verificados con Playwright. |
| Comprensión del negocio | 5 | 3 | Claude recortó el pin de marca de terceros. Codex muestra el pin eXp y el cartel "FOR SALE". |
| Calidad técnica | 4 | 3 | Claude usa `<dialog>` nativo, foco gestionado y contraste AA calculado. |
| Originalidad visual | 4 | 3 | Claude: "ficha editorial" con filetes en vez de tarjetas. Codex: bloques grandes con un pie verde saturado. |
| Simplicidad y mantenibilidad | 4 | 3 | |
| Seguridad / privacidad | 5 | 3 | Marca de terceros visible en la entrega de Codex. |
| Cumplimiento de requisitos | 5 | 1 | Codex no hizo capturas ni commit, y sus tests fallaban: agotó su cuota de uso a mitad de la tarea. |
| Calidad de pruebas | 4 | 1 | |
| Correcciones requeridas | 1 | n/d | Claude necesitó un ajuste temporal de `turbopack.root` en el worktree. |
| Tiempo | ~15 min | ~10 min (incompleto) | |

**Ganador: Claude.** Su rama se integró en `main`.

## Decisión

- **Implementación (frontend, dominio e integraciones):** subagentes Claude, coordinados por el orquestador.
- **Codex:** queda como **revisor independiente** de diffs cuando tenga cuota disponible. Hoy lo limitan su sandbox (no puede hacer commits en el worktree, abrir puertos ni escribir en `node_modules` enlazado) y su cuota de uso.
- Repetir la comparación si cambian estas condiciones, por ejemplo si Codex corre en su propio workspace administrado.
