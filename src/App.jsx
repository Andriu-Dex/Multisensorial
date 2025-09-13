import React, { useEffect, useMemo, useRef, useState } from "react";

// 👋 Demo: Trivia Multisensorial Accesible (Visual + Auditivo + Háptico)
// - Sin dependencias externas (usa Web Audio API + Web Speech API + Vibration API)
// - Estilos con Tailwind (disponible por defecto en el entorno del canvas)
// - Accesible: aria-live, foco visible, alto contraste, no depende solo del color
// - Respeta preferencias del usuario: switches para Sonido / Vibración / Voz
// - Respeta preferencias del sistema: reduced motion

// =====================
// Utilidades de Audio
// =====================
function useAudioEngine() {
  const ctxRef = useRef(null);

  const ensureCtx = () => {
    if (!ctxRef.current) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctxRef.current = ctx;
    }
    return ctxRef.current;
  };

  const beep = (freq = 880, durationMs = 120, type = "sine") => {
    const ctx = ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
    // Fade-out
    gain.gain.setValueAtTime(0.2, ctx.currentTime + durationMs / 1000 - 0.03);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      ctx.currentTime + durationMs / 1000
    );
  };

  const success = () => {
    // Pequeña fanfarria: dos notas ascendentes
    beep(660, 90, "triangle");
    setTimeout(() => beep(880, 140, "triangle"), 100);
  };

  const error = () => {
    // Tono grave + pulso doble
    beep(220, 120, "square");
    setTimeout(() => beep(180, 120, "square"), 140);
  };

  return { beep, success, error };
}

// =====================
// Utilidades de Voz (TTS)
// =====================
function speak(text) {
  if (!("speechSynthesis" in window)) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "es-ES"; // Español
  utter.rate = 1; // Velocidad normal
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

// =====================
// Preguntas de ejemplo
// =====================
const QUESTIONS = [
  {
    id: 1,
    q: "¿Cuál NO es un canal típico en una interfaz multisensorial práctica?",
    options: ["Visual", "Auditivo", "Háptico (vibración)", "Gustativo (sabor)"],
    correct: 3,
  },
  {
    id: 2,
    q: "Para accesibilidad, ¿qué práctica es correcta?",
    options: [
      "Depender solo del color para estados",
      "Usar iconos + texto además del color",
      "Ocultar el foco del teclado",
      "Deshabilitar el lector de pantalla",
    ],
    correct: 1,
  },
  {
    id: 3,
    q: "¿Qué patrón de vibración comunicaría MEJOR un error?",
    options: [
      "Vibración corta y única",
      "Sin vibración",
      "Patrón más largo y con pausas",
      "Vibración continua 10 segundos",
    ],
    correct: 2,
  },
  {
    id: 4,
    q: "Para reducir la sobrecarga sensorial, es recomendable…",
    options: [
      "Permitir que el usuario configure sonido y vibración",
      "Disparar sonido, voz y vibración siempre juntos",
      "Usar animaciones largas y brillantes",
      "Bajar el contraste del texto",
    ],
    correct: 0,
  },
];

// =====================
// Componente principal
// =====================
export default function App() {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(null);

  // Preferencias del usuario
  const [soundOn, setSoundOn] = useState(true);
  const [vibrationOn, setVibrationOn] = useState(true);
  const [voiceOn, setVoiceOn] = useState(false);

  const { success, error } = useAudioEngine();

  const q = useMemo(() => QUESTIONS[index], [index]);

  const isReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Anunciar pregunta por voz y en aria-live
  useEffect(() => {
    if (voiceOn && q) {
      speak(
        `Pregunta ${index + 1}. ${q.q}. Opciones: ${q.options.join(", ")}.`
      );
    }
  }, [q, index, voiceOn]);

  // Limpiar selección/estado cuando cambia la pregunta
  useEffect(() => {
    setSelected(null);
    setShowResult(null);
  }, [index]);

  const handleAnswer = (optIdx) => {
    if (selected !== null) return; // ya respondido
    setSelected(optIdx);
    const isCorrect = optIdx === q.correct;
    setShowResult(isCorrect ? "ok" : "ko");
    if (isCorrect) setScore((s) => s + 1);

    // Feedback auditivo
    if (soundOn) {
      isCorrect ? success() : error();
    }

    // Feedback háptico (si disponible)
    if (vibrationOn && "vibrate" in navigator) {
      if (isCorrect) navigator.vibrate?.(120);
      else navigator.vibrate?.([80, 60, 80]);
    }

    // Mensaje por voz (opcional)
    if (voiceOn) {
      speak(isCorrect ? "Respuesta correcta" : "Respuesta incorrecta");
    }
  };

  const next = () => {
    if (index < QUESTIONS.length - 1) setIndex((i) => i + 1);
  };

  const restart = () => {
    setIndex(0);
    setScore(0);
    setSelected(null);
    setShowResult(null);
  };

  const finished = index === QUESTIONS.length - 1 && selected !== null;

  return (
    <div className="container">
      <div className="main-content">
        {/* Header */}
        <header className="header">
          <h1 className="title">Trivia Multisensorial Accesible</h1>
          <div className="controls" aria-label="Preferencias de estímulos">
            <ToggleSwitch
              label="Sonido"
              checked={soundOn}
              onChange={setSoundOn}
            />
            <ToggleSwitch
              label="Vibración"
              checked={vibrationOn}
              onChange={setVibrationOn}
            />
            <ToggleSwitch label="Voz" checked={voiceOn} onChange={setVoiceOn} />
          </div>
        </header>

        {/* Progreso */}
        <div className="progress-bar">
          <span>
            Pregunta {index + 1} de {QUESTIONS.length}
          </span>
          <span>
            Puntaje: <span className="score">{score}</span>
          </span>
        </div>

        {/* Área principal */}
        <main className="card">
          {/* Pregunta con aria-live */}
          <div aria-live="polite">
            <h2 className="question">{q.q}</h2>
          </div>

          {/* Opciones */}
          <div className="options-grid">
            {q.options.map((opt, i) => {
              const state =
                selected === null
                  ? "idle"
                  : i === q.correct
                  ? "correct"
                  : i === selected
                  ? "wrong"
                  : "idle";
              return (
                <OptionButton
                  key={i}
                  text={opt}
                  onClick={() => handleAnswer(i)}
                  disabled={selected !== null}
                  state={state}
                />
              );
            })}
          </div>

          {/* Resultado con aria-live */}
          <div aria-live="assertive" style={{ minHeight: "2.5rem" }}>
            {showResult === "ok" && (
              <StatusBanner
                type="ok"
                text="¡Correcto!"
                reducedMotion={isReducedMotion}
              />
            )}
            {showResult === "ko" && (
              <StatusBanner
                type="ko"
                text="Respuesta incorrecta"
                reducedMotion={isReducedMotion}
              />
            )}
          </div>

          {/* Controles de navegación */}
          <div className="nav-controls">
            {!finished ? (
              <button
                className={`btn ${
                  selected !== null ? "btn-secondary" : "btn-secondary"
                }`}
                onClick={next}
                disabled={selected === null}
              >
                Siguiente
              </button>
            ) : (
              <button className="btn btn-primary" onClick={restart}>
                Reiniciar
              </button>
            )}
          </div>
        </main>

        {/* Nota de accesibilidad */}
        <p className="accessibility-note">
          Consejo: activa/desactiva <span className="highlight">Sonido</span>,{" "}
          <span className="highlight">Vibración</span> y{" "}
          <span className="highlight">Voz</span> para mostrar cómo se evita la
          sobrecarga sensorial y cómo se refuerza la accesibilidad. Esta demo no
          depende solo del color: utiliza iconos, texto y feedback
          multisensorial.
        </p>
      </div>
    </div>
  );
}

// =====================
// Subcomponentes
// =====================
function ToggleSwitch({ label, checked, onChange }) {
  return (
    <label className="toggle-wrapper">
      <span className="toggle-label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`toggle-switch ${checked ? "on" : "off"}`}
      >
        <span className={`toggle-thumb ${checked ? "on" : "off"}`} />
      </button>
    </label>
  );
}

function OptionButton({ text, onClick, disabled, state }) {
  const icon = {
    idle: "",
    correct: "✔",
    wrong: "✖",
  }[state];

  return (
    <button
      className={`option-button ${state}`}
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
    >
      <div className="option-icon">
        {state !== "idle" ? (
          <span aria-hidden>{icon}</span>
        ) : (
          <span aria-hidden />
        )}
      </div>
      <span>{text}</span>
    </button>
  );
}

function StatusBanner({ type, text, reducedMotion }) {
  const icon = type === "ok" ? "✔" : "✖";

  return (
    <div
      className={`status-banner ${type === "ok" ? "success" : "error"} ${
        reducedMotion ? "" : "animate"
      }`}
    >
      <span aria-hidden>{icon}</span>
      <span>{text}</span>
    </div>
  );
}
