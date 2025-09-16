# Informe Técnico: Sistema de Gestos para Trivia Accesible

Fecha: 2025-09-15

1. ¿Cómo se armó esto desde 0?

---

1. Inicialización del proyecto:

   - Se partió de una SPA creada con Vite + React (archivos existentes: `index.html`, `src/main.jsx`, `src/App.jsx`).
   - `package.json` ya contiene scripts para `dev` y dependencias base.

2. Integración de MediaPipe:

   - Se utilizó la librería oficial `@mediapipe/hands` (cargada dinámicamente dentro del hook) junto a `@mediapipe/camera_utils` para la gestión de la cámara.
   - MediaPipe Hands se carga con `locateFile` apuntando al CDN `https://cdn.jsdelivr.net/npm/@mediapipe/hands/`.

3. Hook de gestos:

   - Se creó (y extendió) el hook `useGestureRecognition()` dentro de `src/App.jsx` para encapsular toda la lógica de cámara, MediaPipe y procesamiento de landmarks.
   - El hook expone:
     - `isActive`, `isSupported`, `detectedGesture`, `confidence`, `fingersUp`, `handLandmarks`, `error`
     - `videoRef`, `canvasRef` para integrar el video y overlay
     - `startCamera()` y `stopCamera()` para controlar la cámara
   - El callback `onResults` procesa `results.multiHandLandmarks` y calcula `fingersUp` usando `countFingers(landmarks)`.
   - Se añadió `handLandmarks` al hook para dibujarlos en un overlay `canvas`.

4. Lógica de UX / Confirmación:

   - Cuando se detecta 1-4 dedos, el sistema asigna la opción correspondiente (A-D) a `pendingGestureCommand` y muestra `showGestureConfirmation`.
   - Durante la confirmación, **puño cerrado (0 dedos)** confirma la respuesta y **mano abierta (5 dedos)** cancela.
   - Después de confirmar, la app ejecuta `handleAnswer()` y, tras un retardo de 2 segundos para mostrar feedback, llama a `next()` para avanzar a la siguiente pregunta.

5. Interfaz visual:

   - Se implementó un nuevo componente `GestureInterface` dentro de `src/App.jsx` que ofrece:
     - Video en vivo con overlay de landmarks (`canvas`) dibujado con `2D context`.
     - Panel lateral con guías de gestos y controles.
     - Indicador de confianza, estado y detección actual.
   - Se añadieron dos modos visuales:
     - `vibrant` (modo por defecto): efectos neón, gradientes y animaciones.
     - `reduced` o `suave`: paleta baja en brillo, sin brillos molestos, pensado para accesibilidad.

6. Estilos:

   - Todos los estilos nuevos se agregaron/ajustaron en `src/App.module.css`.
   - Clases principales: `.gestureInterface`, `.vibrant`, `.reduced`, `.landmarksOverlay`, `.gestureGuide`, `.gestureConfirmation`, etc.
   - Se prestó atención a `prefers-reduced-motion` y responsive para móviles.

7. Arquitectura y flujo de datos

---

- `App.jsx` integra:
  - Hook `useGestureRecognition()` que provee estado y refs.
  - Componente `GestureInterface` que recibe `gestureRecognition` y visualiza el feed y overlays.
  - Estados globales de la app: `index`, `selected`, `score`, `voiceOn`, `soundOn`, `gestureInputOn`, etc.

Flujo (simplificado):

1. Usuario habilita `gestureInputOn` → `gestureRecognition.startCamera()`
2. MediaPipe procesa frames → llama a `onResults(results)` del hook
3. `onResults` calcula `fingersUp`, `detectedGesture`, `handLandmarks`, `confidence`
4. `App.jsx` detecta cambios en `gestureRecognition.detectedGesture` y muestra confirmación
5. Usuario confirma (puño) → `confirmGestureCommand()` → `handleAnswer()` → `next()`

6. Librerías y dependencias

---

- React (JSX) + Vite (build/dev) - ya presentes en el proyecto
- @mediapipe/hands - biblioteca principal para detección de manos
- @mediapipe/camera_utils - utilidades para manejar la cámara con MediaPipe
- (Opcional) Web Audio / beep utils - funciones internas para feedback sonoro (ya en `App.jsx`)

Observación: MediaPipe se importa dinámicamente en el hook para evitar problemas en SSR y para cargar desde CDN.

4. Archivos clave modificados

---

- `src/App.jsx`

  - Se añadieron/extendieron:
    - Hook `useGestureRecognition()` (gestión de cámara, MediaPipe, conteo de dedos, landmarks)
    - Estados: `pendingGestureCommand`, `showGestureConfirmation`, `pendingVoiceCommand`, etc.
    - Funciones: `confirmGestureCommand`, `cancelGestureCommand`, `confirmVoiceCommand`, `cancelVoiceCommand`, `next()` ajustes
    - Componente `GestureInterface` (inline en el mismo archivo)
    - Componente `GestureConfirmation` (similar a `VoiceConfirmation`)

- `src/App.module.css`

  - Nuevos estilos para `.gestureInterface`, `.vibrant`, `.reduced`, `.landmarksOverlay`, `.gestureGuide`, `.gestureConfirmation`, etc.
  - Ajustes responsive y `prefers-reduced-motion`.

- `src/App.css`

  - (Menores ajustes, no críticos)

- Nuevo archivo de documentación:
  - `GESTOS_REPORT.md` (este archivo)

5. Detalle de la implementación técnica

---

A continuación se describen fragmentos y contratos lógicos importantes.

Hook useGestureRecognition - contrato

- Inputs: none (usa refs y estados internos)
- Outputs (retornados):
  - isActive: boolean
  - isSupported: boolean
  - detectedGesture: number | null (0-5)
  - confidence: number (0-1)
  - fingersUp: boolean[5]
  - handLandmarks: array of landmarks (cada landmark {x,y,z})
  - videoRef, canvasRef: refs
  - startCamera(), stopCamera()

Edge cases cubiertos:

- Sin cámara o permisos denegados → `isSupported=false`, `error` con mensaje
- No hay manos en frame → valores en null / 0
- Detecciones intermitentes → threshold de confianza y debounce por estado del hook

Conteo de dedos

- `countFingers(landmarks)` compara coordenadas de puntas y articulaciones.
- Pulgar requiere lógica especial por orientación horizontal.
- Devuelve un array booleano `[thumb,index,middle,ring,pinky]` y `fingersCount` se deriva.

Dibujo de overlay

- `GestureInterface` usa un `canvas` (2D) para dibujar puntos y conexiones con escala al `video.videoWidth`/`height`.
- Se dibujan puntos en índices claves y se muestran números para 0/4/8/12/16/20.

Confirmación y progreso

- `pendingGestureCommand` y `showGestureConfirmation` controlan la UI de confirmación
- `confirmGestureCommand()` llama a `handleAnswer()` y reproduce feedback
- Después de confirmar, se ejecuta `next()` tras 2 segundos para mostrar resultado

6. Cómo ejecutar el proyecto (local)

---

Requisitos:

- Node.js (14+)
- Navegador moderno con cámara

Comandos (desde la raíz del proyecto `trivia-accesible`):

```bash
# instalar dependencias (si hace falta)
npm install

# iniciar servidor de desarrollo (Vite)
npm run dev
```

Abrir la URL que indique Vite (normalmente http://localhost:5173). Otorgar permiso a la cámara cuando lo pida.

Activar la entrada por gestos desde la UI (hay un switch) y prueba:

- Muestra 1-4 dedos para seleccionar A-D
- Haz puño para confirmar, mano abierta para cancelar

7. Tests manuales realizados

---

- Se verificó que MediaPipe carga correctamente desde CDN
- Se comprobó el conteo de dedos con distintas posiciones de mano (dedos juntos / separados)
- Flujo de confirmación: selección → confirmación (puño) → `handleAnswer()` → `next()` automático
- Se mejoró la robustez para mantener la cámara activa al avanzar de pregunta
- Pruebas en móvil y escritorio para responsive

8. Cambios en UX/CSS y accesibilidad

---

- Modo vibrante: diseñado para usuarios que disfrutan efectos y alto contraste
- Modo suave: diseñado para usuarios sensibles a la luz, con paleta baja en brillo y sin brillos molestos
- `prefers-reduced-motion` es respetado
- Panel de instrucciones claro y guía visual para gestos

9. Posibles mejoras y siguientes pasos

---

- Añadir suavizado temporal (debounce + estabilidad) para evitar falsos positivos de gestos rápidos
- Aprendizaje personalizado: permitir al usuario calibrar su mano y ajustar thresholds
- Soporte multi-mano para entradas avanzadas
- Registrar métricas de uso para mejorar UX
- Añadir tests automatizados (unitarios para countFingers, integración para flujo de confirmación usando jsdom o Puppeteer)

10. Archivos modificados (resumen)

---

- src/App.jsx (hook `useGestureRecognition`, `GestureInterface`, confirmaciones, estados)
- src/App.module.css (estilos de gesture UI, vibrante y suave)
- src/GESTOS_REPORT.md (este documento)

11. Notas finales

---
