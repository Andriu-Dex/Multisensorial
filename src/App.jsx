import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./App.module.css";

// 👋 Demo: Trivia Multisensorial Accesible (Visual + Auditivo + Háptico)
// - Sin dependencias externas (usa Web Audio API + Web Speech API + Vibration API)
// - Estilos con CSS Modules para máximo rendimiento y animaciones espectaculares
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
// Utilidades de Reconocimiento de Voz
// =====================
function useVoiceRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    // Verificar soporte para Web Speech API
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      setIsSupported(true);
      const recognition = new SpeechRecognition();

      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "es-ES";
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        console.log("🎤 Reconocimiento de voz iniciado");
        setIsListening(true);
        setTranscript("");
      };

      recognition.onresult = (event) => {
        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPart = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptPart;
          } else {
            interimTranscript += transcriptPart;
          }
        }

        setTranscript(finalTranscript || interimTranscript);
        console.log("🎤 Detectado:", finalTranscript || interimTranscript);
      };

      recognition.onerror = (event) => {
        console.error("❌ Error en reconocimiento de voz:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        console.log("🎤 Reconocimiento de voz terminado");
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      console.warn("⚠️ Web Speech API no soportada en este navegador");
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error("Error al iniciar reconocimiento:", error);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  const clearTranscript = () => {
    setTranscript("");
  };

  const parseVoiceCommand = (text) => {
    const cleanText = text.toLowerCase().trim();

    // Mapear comandos de voz a opciones
    const commandMap = {
      // Opción A
      "opción a": 0,
      a: 0,
      primera: 0,
      "primera opción": 0,
      uno: 0,
      // Opción B
      "opción b": 1,
      b: 1,
      segunda: 1,
      "segunda opción": 1,
      dos: 1,
      // Opción C
      "opción c": 2,
      c: 2,
      tercera: 2,
      "tercera opción": 2,
      tres: 2,
      // Opción D
      "opción d": 3,
      d: 3,
      cuarta: 3,
      "cuarta opción": 3,
      cuatro: 3,
      // Comandos especiales
      repetir: "repeat",
      "repetir pregunta": "repeat",
      "lee otra vez": "repeat",
      siguiente: "next",
      continuar: "next",
      sí: "confirm",
      confirmar: "confirm",
      no: "cancel",
      cancelar: "cancel",
    };

    // Buscar coincidencia exacta
    if (commandMap.hasOwnProperty(cleanText)) {
      return {
        command: commandMap[cleanText],
        confidence: "high",
        original: text,
      };
    }

    // Buscar coincidencia parcial
    for (const [key, value] of Object.entries(commandMap)) {
      if (cleanText.includes(key)) {
        return { command: value, confidence: "medium", original: text };
      }
    }

    return { command: null, confidence: "none", original: text };
  };

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    clearTranscript,
    parseVoiceCommand,
  };
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
  const [voiceInputOn, setVoiceInputOn] = useState(false);
  const [reducedMode, setReducedMode] = useState(false);

  // Estados para reconocimiento de voz
  const [pendingVoiceCommand, setPendingVoiceCommand] = useState(null);
  const [showVoiceConfirmation, setShowVoiceConfirmation] = useState(false);

  const { success, error } = useAudioEngine();
  const voiceRecognition = useVoiceRecognition();

  const q = useMemo(() => QUESTIONS[index], [index]);

  const isReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Aplicar/remover clase del modo reducido al document
  useEffect(() => {
    console.log("Modo reducido cambiado:", reducedMode); // Debug

    if (reducedMode) {
      document.documentElement.classList.add("reducedMode");
      document.body.classList.add("reducedMode");
      console.log("Clases añadidas al DOM");
      console.log("Html classes:", document.documentElement.className);
      console.log("Body classes:", document.body.className);
    } else {
      document.documentElement.classList.remove("reducedMode");
      document.body.classList.remove("reducedMode");
      console.log("Clases removidas del DOM");
    }

    // Cleanup al desmontar
    return () => {
      document.documentElement.classList.remove("reducedMode");
      document.body.classList.remove("reducedMode");
    };
  }, [reducedMode]);

  // Anunciar pregunta por voz y en aria-live
  useEffect(() => {
    if (voiceOn && q) {
      speak(
        `Pregunta ${index + 1}. ${q.q}. Opciones: ${q.options.join(", ")}.`
      );
    }
  }, [q, index, voiceOn]);

  // Procesar comandos de voz
  useEffect(() => {
    if (!voiceInputOn || !voiceRecognition.transcript || selected !== null)
      return;

    const result = voiceRecognition.parseVoiceCommand(
      voiceRecognition.transcript
    );

    if (result.command !== null && result.confidence !== "none") {
      console.log("🎤 Comando detectado:", result);

      // Comandos especiales
      if (result.command === "repeat") {
        if (voiceOn) {
          speak(
            `Pregunta ${index + 1}. ${q.q}. Opciones: ${q.options.join(", ")}.`
          );
        }
        voiceRecognition.stopListening();
        return;
      }

      if (result.command === "next") {
        if (selected !== null && index < QUESTIONS.length - 1) {
          setIndex(index + 1);
        }
        voiceRecognition.stopListening();
        return;
      }

      // Comandos de respuesta (números 0-3)
      if (
        typeof result.command === "number" &&
        result.command >= 0 &&
        result.command <= 3
      ) {
        // Detener reconocimiento y mostrar confirmación
        voiceRecognition.stopListening();
        setPendingVoiceCommand(result.command);
        setShowVoiceConfirmation(true);

        // Anunciar confirmación por voz
        if (voiceOn) {
          const optionLetter = ["A", "B", "C", "D"][result.command];
          speak(
            `¿Confirmas opción ${optionLetter}: ${
              q.options[result.command]
            }? Haz clic en confirmar o di "sí".`
          );
        }
      }
    }
  }, [voiceRecognition.transcript, voiceInputOn, selected, voiceOn, q, index]);

  // Confirmar comando de voz
  const confirmVoiceCommand = () => {
    if (pendingVoiceCommand !== null) {
      handleAnswer(pendingVoiceCommand);
      setPendingVoiceCommand(null);
      setShowVoiceConfirmation(false);
    }
  };

  // Cancelar comando de voz
  const cancelVoiceCommand = () => {
    setPendingVoiceCommand(null);
    setShowVoiceConfirmation(false);
    if (voiceOn) {
      speak("Comando cancelado. Puedes intentar de nuevo.");
    }
  };

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
    if (index < QUESTIONS.length - 1) {
      setIndex((i) => i + 1);
      // Limpiar todos los estados al avanzar a la siguiente pregunta
      setSelected(null);
      setShowResult(null);
      setPendingVoiceCommand(null);
      setShowVoiceConfirmation(false);
      // Limpiar el transcript de voz y detener reconocimiento
      voiceRecognition.stopListening();
      voiceRecognition.clearTranscript();
    }
  };

  const restart = () => {
    setIndex(0);
    setScore(0);
    setSelected(null);
    setShowResult(null);
    // Limpiar estados de voz al reiniciar
    setPendingVoiceCommand(null);
    setShowVoiceConfirmation(false);
    // Limpiar el transcript de voz y detener reconocimiento
    voiceRecognition.stopListening();
    voiceRecognition.clearTranscript();
  };

  const finished = index === QUESTIONS.length - 1 && selected !== null;

  return (
    <div className={`${styles.container} ${reducedMode ? "reducedMode" : ""}`}>
      {/* Figuras 3D animadas de fondo - Solo en modo vibrante */}
      {!reducedMode && (
        <div className={styles.shapes3D}>
          <div className={`${styles.shape3D} ${styles.cube3D}`}></div>
          <div className={`${styles.shape3D} ${styles.sphere3D}`}></div>
          <div className={`${styles.shape3D} ${styles.pyramid3D}`}></div>
          <div className={`${styles.shape3D} ${styles.diamond3D}`}></div>
          <div className={`${styles.shape3D} ${styles.hexagon3D}`}></div>
          <div className={`${styles.shape3D} ${styles.cylinder3D}`}></div>
          <div className={`${styles.shape3D} ${styles.star3D}`}></div>
          <div className={`${styles.shape3D} ${styles.smallShape1}`}></div>
          <div className={`${styles.shape3D} ${styles.smallShape2}`}></div>
          <div className={`${styles.shape3D} ${styles.smallShape3}`}></div>
        </div>
      )}

      {/* Switch de Modo Reducido */}
      <div className={styles.reducedModeSwitch}>
        <span className={styles.reducedModeIcon}>
          {reducedMode ? "🔅" : "✨"}
        </span>
        <ToggleSwitch
          label={reducedMode ? "Modo Suave" : "Modo Vibrante"}
          checked={reducedMode}
          onChange={setReducedMode}
        />
      </div>

      <div className={styles.wrapper}>
        {/* Header */}
        <header className={styles.header}>
          <h1 className={styles.title}>
            Trivia Multisensorial Accesible
            {reducedMode}
          </h1>
          <div
            className={styles.preferences}
            aria-label="Preferencias de estímulos"
          >
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
            {voiceRecognition.isSupported && (
              <ToggleSwitch
                label="🎤 Entrada por Voz"
                checked={voiceInputOn}
                onChange={setVoiceInputOn}
              />
            )}
          </div>
        </header>

        {/* Progreso */}
        <div className={styles.progress}>
          <span className={styles.progressText}>
            Pregunta {index + 1} de {QUESTIONS.length}
          </span>
          <span className={styles.progressText}>
            Puntaje: <span className={styles.score}>{score}</span>
          </span>
        </div>

        {/* Área principal */}
        <main className={styles.mainCard}>
          {/* Pregunta con aria-live */}
          <div aria-live="polite" className={styles.questionContainer}>
            <h2 className={`${styles.question} ${styles.completed}`}>{q.q}</h2>
          </div>

          {/* Entrada por voz */}
          {voiceInputOn && voiceRecognition.isSupported && (
            <VoiceMicrophone
              isListening={voiceRecognition.isListening}
              transcript={voiceRecognition.transcript}
              onStartListening={voiceRecognition.startListening}
              onStopListening={voiceRecognition.stopListening}
              disabled={selected !== null}
              className={styles.voiceSection}
            />
          )}

          {/* Confirmación de comando de voz */}
          <VoiceConfirmation
            show={showVoiceConfirmation}
            option={pendingVoiceCommand}
            optionText={
              pendingVoiceCommand !== null ? q.options[pendingVoiceCommand] : ""
            }
            onConfirm={confirmVoiceCommand}
            onCancel={cancelVoiceCommand}
            className={styles.voiceConfirmationSection}
          />

          {/* Opciones */}
          <div className={styles.optionsGrid}>
            {q.options.map((opt, i) => {
              const state =
                selected === null
                  ? "idle"
                  : i === q.correct
                  ? "correct"
                  : i === selected
                  ? "wrong"
                  : "idle";
              const optionLetter = ["a)", "b)", "c)", "d)"][i];
              return (
                <OptionButton
                  key={i}
                  text={`${optionLetter} ${opt}`}
                  onClick={() => handleAnswer(i)}
                  disabled={selected !== null}
                  state={state}
                />
              );
            })}
          </div>

          {/* Resultado con aria-live */}
          <div aria-live="assertive" className={styles.statusContainer}>
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
          <div className={styles.controls}>
            {!finished ? (
              <button
                className={`${styles.navButton} ${styles.nextButton}`}
                onClick={next}
                disabled={selected === null}
              >
                Siguiente
              </button>
            ) : (
              // Pantalla de resultados finales
              <div className={styles.finalResults}>
                {/* Efecto de confeti solo en modo vibrante */}
                {!reducedMode && (
                  <div className={styles.confetti}>
                    {[...Array(50)].map((_, i) => (
                      <div
                        key={i}
                        className={`${styles.confettiPiece} ${
                          styles[`confetti${(i % 6) + 1}`]
                        }`}
                        style={{
                          left: `${Math.random() * 100}%`,
                          animationDelay: `${Math.random() * 3}s`,
                          animationDuration: `${3 + Math.random() * 2}s`,
                        }}
                      ></div>
                    ))}
                  </div>
                )}

                <div className={styles.resultsCard}>
                  <h2 className={styles.finalTitle}>¡Trivia Completada! 🎉</h2>

                  <div className={styles.scoreBreakdown}>
                    <div className={styles.scoreItem}>
                      <span className={styles.scoreLabel}>
                        Respuestas Correctas:
                      </span>
                      <span
                        className={`${styles.scoreValue} ${styles.correct}`}
                      >
                        {score}
                      </span>
                    </div>
                    <div className={styles.scoreItem}>
                      <span className={styles.scoreLabel}>
                        Respuestas Incorrectas:
                      </span>
                      <span
                        className={`${styles.scoreValue} ${styles.incorrect}`}
                      >
                        {QUESTIONS.length - score}
                      </span>
                    </div>
                    <div className={styles.scoreDivider}></div>
                    <div className={styles.scoreItem}>
                      <span className={styles.scoreLabel}>
                        Total de Preguntas:
                      </span>
                      <span className={styles.scoreValue}>
                        {QUESTIONS.length}
                      </span>
                    </div>
                    <div className={styles.scoreItem}>
                      <span className={styles.scoreLabel}>
                        Porcentaje de Aciertos:
                      </span>
                      <span
                        className={`${styles.scoreValue} ${styles.percentage}`}
                      >
                        {Math.round((score / QUESTIONS.length) * 100)}%
                      </span>
                    </div>
                  </div>

                  <div className={styles.performanceMessage}>
                    {score === QUESTIONS.length ? (
                      <p className={styles.perfectScore}>
                        ¡Perfecto! 🌟 Respondiste todas las preguntas
                        correctamente.
                      </p>
                    ) : score >= QUESTIONS.length * 0.8 ? (
                      <p className={styles.excellentScore}>
                        ¡Excelente trabajo! 👏 Tienes un gran conocimiento.
                      </p>
                    ) : score >= QUESTIONS.length * 0.6 ? (
                      <p className={styles.goodScore}>
                        ¡Buen trabajo! 👍 Sigue practicando para mejorar.
                      </p>
                    ) : (
                      <p className={styles.needsImprovement}>
                        ¡Sigue intentando! 💪 La práctica hace al maestro.
                      </p>
                    )}
                  </div>

                  <button
                    className={`${styles.navButton} ${styles.restartButton}`}
                    onClick={restart}
                  >
                    Reiniciar Trivia
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Nota de accesibilidad */}
        <p className={styles.accessibilityNote}>
          Consejo: activa/desactiva{" "}
          <span className={styles.highlight}>Sonido</span>,{" "}
          <span className={styles.highlight}>Vibración</span> y{" "}
          <span className={styles.highlight}>Voz</span> para mostrar cómo se
          evita la sobrecarga sensorial y cómo se refuerza la accesibilidad.
          Esta demo no depende solo del color: utiliza iconos, texto y feedback
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
  const handleClick = () => {
    console.log(`Toggle ${label}: ${checked} -> ${!checked}`);
    onChange(!checked);
  };

  return (
    <label className={styles.toggleLabel}>
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={handleClick}
        className={`${styles.toggleSwitch} ${
          checked ? styles.active : styles.inactive
        }`}
      >
        <span
          className={`${styles.toggleKnob} ${
            checked ? styles.active : styles.inactive
          }`}
        />
      </button>
    </label>
  );
}

function VoiceMicrophone({
  isListening,
  transcript,
  onStartListening,
  onStopListening,
  disabled,
  className,
}) {
  return (
    <div className={`${styles.voiceMicrophone} ${className || ""}`}>
      <button
        onClick={isListening ? onStopListening : onStartListening}
        disabled={disabled}
        className={`${styles.micButton} ${
          isListening ? styles.listening : styles.idle
        }`}
        aria-label={isListening ? "Parar escucha" : "Empezar a escuchar"}
      >
        <span className={styles.micIcon}>🎤</span>
        {isListening && (
          <span className={styles.listeningIndicator}>
            <span className={styles.pulse}></span>
            <span className={styles.pulse}></span>
            <span className={styles.pulse}></span>
          </span>
        )}
      </button>

      {transcript && (
        <div className={styles.transcript}>
          <span className={styles.transcriptLabel}>Detectado:</span>
          <span className={styles.transcriptText}>{transcript}</span>
        </div>
      )}

      {isListening && (
        <div className={styles.listeningStatus}>
          Escuchando... Diga "Opción A", "B", "C" o "D"
        </div>
      )}
    </div>
  );
}

function VoiceConfirmation({
  show,
  option,
  optionText,
  onConfirm,
  onCancel,
  className,
}) {
  if (!show) return null;

  const optionLetter = ["A", "B", "C", "D"][option];

  return (
    <div className={`${styles.voiceConfirmation} ${className || ""}`}>
      <div className={styles.confirmationCard}>
        <div className={styles.confirmationHeader}>
          <span className={styles.confirmationIcon}>🎤</span>
          <h3 className={styles.confirmationTitle}>
            Confirmar respuesta por voz
          </h3>
        </div>

        <div className={styles.confirmationContent}>
          <p className={styles.confirmationText}>
            Detectaste: <strong>Opción {optionLetter}</strong>
          </p>
          <p className={styles.confirmationOption}>"{optionText}"</p>
        </div>

        <div className={styles.confirmationActions}>
          <button
            onClick={onConfirm}
            className={`${styles.confirmButton} ${styles.primary}`}
            autoFocus
          >
            ✓ Confirmar
          </button>
          <button
            onClick={onCancel}
            className={`${styles.confirmButton} ${styles.secondary}`}
          >
            ✗ Cancelar
          </button>
        </div>
      </div>
    </div>
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
      className={`${styles.optionButton} ${styles[state]}`}
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
    >
      <span className={styles.optionIcon} aria-hidden>
        {icon}
      </span>
      <span>{text}</span>
    </button>
  );
}

function StatusBanner({ type, text, reducedMotion }) {
  const icon = type === "ok" ? "✔" : "✖";

  return (
    <div
      className={`${styles.statusBanner} ${
        type === "ok" ? styles.success : styles.error
      }`}
    >
      <span className={styles.statusIcon} aria-hidden>
        {icon}
      </span>
      <span>{text}</span>
    </div>
  );
}
