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
// Hook de Reconocimiento de Gestos con MediaPipe
// =====================
function useGestureRecognition() {
  const [isActive, setIsActive] = useState(false);
  const [detectedGesture, setDetectedGesture] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(true);
  const [fingersUp, setFingersUp] = useState([]);
  const [handLandmarks, setHandLandmarks] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const handsRef = useRef(null);
  const cameraRef = useRef(null);

  // Verificar soporte del navegador y cargar MediaPipe
  useEffect(() => {
    const checkSupport = async () => {
      try {
        const supported =
          navigator.mediaDevices &&
          navigator.mediaDevices.getUserMedia &&
          typeof HTMLCanvasElement !== "undefined";

        if (!supported) {
          setIsSupported(false);
          return;
        }

        // Cargar MediaPipe Hands
        const { Hands } = await import("@mediapipe/hands");
        const { Camera } = await import("@mediapipe/camera_utils");

        console.log("🤚 MediaPipe Hands cargado exitosamente");
        setIsSupported(true);

        // Configurar MediaPipe Hands
        const hands = new Hands({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
          },
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        hands.onResults(onResults);
        handsRef.current = hands;
      } catch (err) {
        console.error("🤚 Error cargando MediaPipe:", err);
        setError("Error al cargar la librería de detección de gestos");
        setIsSupported(false);
      }
    };

    checkSupport();
  }, []);

  // Procesar resultados de MediaPipe
  const onResults = (results) => {
    if (
      !results.multiHandLandmarks ||
      results.multiHandLandmarks.length === 0
    ) {
      setDetectedGesture(null);
      setConfidence(0);
      setFingersUp([]);
      setHandLandmarks(null);
      return;
    }

    const landmarks = results.multiHandLandmarks[0];
    setHandLandmarks(landmarks); // Guardar landmarks para visualización

    const fingers = countFingers(landmarks);
    setFingersUp(fingers);

    const fingersCount = fingers.filter(Boolean).length;
    console.log("🤚 Dedos detectados:", fingersCount, "Dedos arriba:", fingers);

    // Directamente asignar el número de dedos detectados
    setDetectedGesture(fingersCount);
    setConfidence(0.9);
    console.log(`🤚 ¡${fingersCount} DEDO(S) DETECTADO!`);
  };

  // Contar dedos levantados
  const countFingers = (landmarks) => {
    if (!landmarks || landmarks.length < 21) return [];

    const fingers = [false, false, false, false, false]; // [pulgar, índice, medio, anular, meñique]

    // Puntos de referencia de las puntas de los dedos
    const tipIds = [4, 8, 12, 16, 20];

    // Pulgar (lógica especial por orientación)
    if (landmarks[tipIds[0]].x > landmarks[tipIds[0] - 1].x) {
      fingers[0] = true;
    }

    // Otros dedos (compara punta con articulación)
    for (let i = 1; i < 5; i++) {
      if (landmarks[tipIds[i]].y < landmarks[tipIds[i] - 2].y) {
        fingers[i] = true;
      }
    }

    return fingers;
  };

  // Inicializar cámara con MediaPipe
  const startCamera = async () => {
    try {
      console.log("🤚 Iniciando cámara con MediaPipe...");
      setError(null);

      if (!handsRef.current) {
        setError("MediaPipe no está inicializado");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: "user",
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsActive(true);

        // Configurar cámara de MediaPipe
        const { Camera } = await import("@mediapipe/camera_utils");
        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (handsRef.current && videoRef.current) {
              await handsRef.current.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480,
        });

        cameraRef.current = camera;
        camera.start();
        console.log("🤚 Cámara MediaPipe iniciada");
      }
    } catch (err) {
      console.error("🤚 Error al inicializar cámara:", err);
      setError("No se pudo acceder a la cámara. Verifique los permisos.");
      setIsActive(false);
    }
  };

  // Detener cámara
  const stopCamera = () => {
    console.log("🤚 Deteniendo cámara MediaPipe...");

    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        console.log("🤚 Deteniendo track:", track.kind);
        track.stop();
      });
      streamRef.current = null;
    }

    setIsActive(false);
    setDetectedGesture(null);
    setConfidence(0);
    setFingersUp([]);
    console.log("🤚 Cámara MediaPipe detenida");
  };

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return {
    isActive,
    isSupported,
    detectedGesture,
    confidence,
    fingersUp,
    handLandmarks,
    error,
    videoRef,
    canvasRef,
    startCamera,
    stopCamera,
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
  const [gestureInputOn, setGestureInputOn] = useState(false);
  const [reducedMode, setReducedMode] = useState(false);

  // Estados para reconocimiento de voz
  const [pendingVoiceCommand, setPendingVoiceCommand] = useState(null);
  const [showVoiceConfirmation, setShowVoiceConfirmation] = useState(false);

  // Estados para confirmación de gestos
  const [pendingGestureCommand, setPendingGestureCommand] = useState(null);
  const [showGestureConfirmation, setShowGestureConfirmation] = useState(false);

  // Estado para modal de resultados finales
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [resultsAlreadyShown, setResultsAlreadyShown] = useState(false);

  const { success, error } = useAudioEngine();
  const voiceRecognition = useVoiceRecognition();
  const gestureRecognition = useGestureRecognition();

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

  // Manejar activación/desactivación de cámara de gestos
  useEffect(() => {
    if (gestureInputOn && gestureRecognition.isSupported) {
      console.log("🤚 Iniciando cámara para gestos...");
      gestureRecognition.startCamera();
    } else {
      console.log("🤚 Deteniendo cámara de gestos...");
      gestureRecognition.stopCamera();
    }
  }, [gestureInputOn, gestureRecognition.isSupported]);

  // Procesar gestos detectados
  useEffect(() => {
    console.log("🤚 useEffect gestos - Estados:", {
      gestureInputOn,
      selected,
      showGestureConfirmation,
      detectedGesture: gestureRecognition.detectedGesture,
      confidence: gestureRecognition.confidence,
      isActive: gestureRecognition.isActive,
    });

    if (!gestureInputOn) {
      console.log("🤚 Gestos desactivados");
      return;
    }

    if (selected !== null) {
      console.log("🤚 Ya hay una respuesta seleccionada:", selected);
      return;
    }

    if (gestureRecognition.detectedGesture === null) {
      console.log("🤚 No hay gesto detectado");
      return;
    }

    console.log("🤚 Procesando gesto detectado:", {
      gesture: gestureRecognition.detectedGesture,
      confidence: gestureRecognition.confidence,
    });

    // Solo procesar si la confianza es alta
    if (gestureRecognition.confidence > 0.8) {
      console.log("🤚 ¡GESTO CONFIRMADO!");

      // Si estamos en modo confirmación, verificar confirmación/cancelación
      if (showGestureConfirmation) {
        const fingerCount = gestureRecognition.detectedGesture;

        // Puño cerrado (0 dedos) = Confirmar
        if (fingerCount === 0) {
          console.log("🤚 ¡PUÑO DETECTADO! Confirmando respuesta");
          confirmGestureCommand();
          return;
        }

        // Mano abierta (5 dedos) = Cancelar
        if (fingerCount === 5) {
          console.log("🤚 ¡MANO ABIERTA DETECTADA! Cancelando");
          cancelGestureCommand();
          return;
        }

        // Otros gestos durante confirmación se ignoran
        console.log("🤚 Gesto no reconocido para confirmación:", fingerCount);
        return;
      }

      // Si no hay confirmación pendiente, verificar gestos de selección
      const fingerCount = gestureRecognition.detectedGesture;
      let optionIndex = null;

      // Mapear dedos a opciones: 1 dedo = A, 2 dedos = B, etc.
      if (fingerCount === 1) optionIndex = 0; // A
      else if (fingerCount === 2) optionIndex = 1; // B
      else if (fingerCount === 3) optionIndex = 2; // C
      else if (fingerCount === 4) optionIndex = 3; // D

      if (optionIndex !== null && optionIndex < q.options.length) {
        console.log(
          `🤚 ${fingerCount} DEDO(S) DETECTADO! Opción ${
            ["A", "B", "C", "D"][optionIndex]
          }`
        );

        // Activar confirmación
        setPendingGestureCommand(optionIndex);
        setShowGestureConfirmation(true);

        // Anunciar confirmación por voz
        if (voiceOn) {
          const optionLetter = ["A", "B", "C", "D"][optionIndex];
          speak(
            `¿Confirmas opción ${optionLetter}: ${q.options[optionIndex]}? Haz puño para confirmar o abre la mano para cancelar.`
          );
        }
      } else {
        console.log("🤚 Gesto no reconocido para selección:", fingerCount);
      }
    } else {
      console.log("🤚 Confianza insuficiente:", gestureRecognition.confidence);
    }
  }, [
    gestureRecognition.detectedGesture,
    gestureRecognition.confidence,
    gestureInputOn,
    selected,
    showGestureConfirmation,
    pendingGestureCommand,
    soundOn,
    voiceOn,
    q.options,
  ]);

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

  // Confirmar comando de gesto
  const confirmGestureCommand = () => {
    if (pendingGestureCommand !== null) {
      console.log("🤚 Confirmando respuesta:", pendingGestureCommand);
      handleAnswer(pendingGestureCommand);

      // Feedback multisensorial
      if (soundOn) {
        console.log("🤚 Reproduciendo sonido de éxito");
        success();
      }
      if (voiceOn) {
        const optionLetter = ["A", "B", "C", "D"][pendingGestureCommand];
        speak(`Respuesta ${optionLetter} confirmada`);
      }

      setPendingGestureCommand(null);
      setShowGestureConfirmation(false);

      // Pasar automáticamente a la siguiente pregunta después de un breve delay
      setTimeout(() => {
        if (index < QUESTIONS.length - 1) {
          console.log("🤚 Pasando automáticamente a la siguiente pregunta");
          next();
        }
      }, 2000); // 2 segundos de delay para que el usuario vea el resultado
    }
  };

  // Cancelar comando de gesto
  const cancelGestureCommand = () => {
    console.log("🤚 Cancelando comando de gesto");
    setPendingGestureCommand(null);
    setShowGestureConfirmation(false);
    if (voiceOn) {
      speak("Gesto cancelado. Puedes intentar de nuevo.");
    }
  };

  // Limpiar selección/estado cuando cambia la pregunta
  useEffect(() => {
    setSelected(null);
    setShowResult(null);
    // Limpiar estados de confirmación
    setPendingVoiceCommand(null);
    setShowVoiceConfirmation(false);
    setPendingGestureCommand(null);
    setShowGestureConfirmation(false);
  }, [index]);

  // Detectar cuando termina la trivia y mostrar modal con resultados
  useEffect(() => {
    const finished = index === QUESTIONS.length - 1 && selected !== null;

    if (finished && !resultsAlreadyShown) {
      // Marcar que ya se mostraron los resultados para evitar que se abra repetidamente
      setResultsAlreadyShown(true);

      // Esperar un momento para que se procese la última respuesta antes de mostrar el modal
      setTimeout(() => {
        setShowResultsModal(true);

        if (voiceOn) {
          let mensaje = "¡Trivia completada! ";

          // Resultados básicos
          mensaje += `Obtuviste ${score} respuestas correctas de ${QUESTIONS.length} preguntas. `;

          // Porcentaje
          const porcentaje = Math.round((score / QUESTIONS.length) * 100);
          mensaje += `Eso es un ${porcentaje} por ciento de aciertos. `;

          // Mensaje de rendimiento
          if (score === QUESTIONS.length) {
            mensaje +=
              "¡Perfecto! Respondiste todas las preguntas correctamente. ¡Felicitaciones!";
          } else if (score >= QUESTIONS.length * 0.8) {
            mensaje += "¡Excelente trabajo! Tienes un gran conocimiento.";
          } else if (score >= QUESTIONS.length * 0.6) {
            mensaje += "¡Buen trabajo! Sigue practicando para mejorar.";
          } else {
            mensaje += "¡Sigue intentando! La práctica hace al maestro.";
          }

          console.log("🔊 Leyendo resultados finales:", mensaje);
          speak(mensaje);
        }
      }, 1500); // 1.5 segundos de delay para que se muestre el resultado de la última pregunta
    }
  }, [index, selected, score, voiceOn, resultsAlreadyShown]);

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
      setPendingGestureCommand(null);
      setShowGestureConfirmation(false);
      // Limpiar el transcript de voz y detener reconocimiento
      voiceRecognition.stopListening();
      voiceRecognition.clearTranscript();
      // NO detener la cámara de gestos aquí - que siga funcionando para la siguiente pregunta
      // if (gestureRecognition.isActive) {
      //   gestureRecognition.stopCamera();
      // }
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
    // Resetear estados del modal de resultados
    setShowResultsModal(false);
    setResultsAlreadyShown(false);
    // Limpiar el transcript de voz y detener reconocimiento
    voiceRecognition.stopListening();
    voiceRecognition.clearTranscript();
    // Detener cámara de gestos si está activa
    if (gestureRecognition.isActive) {
      gestureRecognition.stopCamera();
    }
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
            {gestureRecognition.isSupported && (
              <ToggleSwitch
                label="🤚 Gestos"
                checked={gestureInputOn}
                onChange={setGestureInputOn}
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

          {/* Confirmación de comando de gesto */}
          <GestureConfirmation
            show={showGestureConfirmation}
            option={pendingGestureCommand}
            optionText={
              pendingGestureCommand !== null
                ? q.options[pendingGestureCommand]
                : ""
            }
            onConfirm={confirmGestureCommand}
            onCancel={cancelGestureCommand}
            className={styles.gestureConfirmationSection}
          />

          {/* Sistema de Gestos Avanzado */}
          {gestureInputOn && gestureRecognition.isSupported && (
            <GestureInterface
              gestureRecognition={gestureRecognition}
              pendingCommand={pendingGestureCommand}
              showConfirmation={showGestureConfirmation}
              currentQuestion={q}
              reducedMode={reducedMode}
            />
          )}

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
            ) : null}
          </div>
        </main>

        {/* Botón Reiniciar cuando la trivia terminó pero el modal está cerrado */}
        {resultsAlreadyShown && !showResultsModal && (
          <div className={`${styles.buttonContainer} ${styles.restartSection}`}>
            <button
              className={`${styles.button} ${styles.restartButton}`}
              onClick={restart}
            >
              Reiniciar Trivia
            </button>
          </div>
        )}

        {/* Modal de Resultados Finales */}
        {showResultsModal && (
          <div
            className={styles.modalOverlay}
            onClick={() => setShowResultsModal(false)}
          >
            <div
              className={styles.modalContent}
              onClick={(e) => e.stopPropagation()}
            >
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
                <button
                  className={styles.closeButton}
                  onClick={() => setShowResultsModal(false)}
                  aria-label="Cerrar resultados"
                >
                  ✕
                </button>

                <h2 className={styles.finalTitle}>¡Trivia Completada! 🎉</h2>

                <div className={styles.scoreBreakdown}>
                  <div className={styles.scoreItem}>
                    <span className={styles.scoreLabel}>
                      Respuestas Correctas:
                    </span>
                    <span className={`${styles.scoreValue} ${styles.correct}`}>
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
                  onClick={() => {
                    setShowResultsModal(false);
                    restart();
                  }}
                >
                  Reiniciar Trivia
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Nota de accesibilidad */}
        <p className={styles.accessibilityNote}>
          Recomendación: activar/desactivar{" "}
          <span className={styles.highlight}>Sonido</span>,{" "}
          <span className={styles.highlight}>Vibración</span> y{" "}
          <span className={styles.highlight}>Voz</span> para evitar la
          sobrecarga sensorial.
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

function GestureConfirmation({
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
    <div className={`${styles.gestureConfirmation} ${className || ""}`}>
      <div className={styles.confirmationCard}>
        <div className={styles.confirmationHeader}>
          <span className={styles.confirmationIcon}>🤚</span>
          <h3 className={styles.confirmationTitle}>
            Confirmar respuesta por gesto
          </h3>
        </div>

        <div className={styles.confirmationContent}>
          <p className={styles.confirmationText}>
            Detectaste: <strong>Opción {optionLetter}</strong>
          </p>
          <p className={styles.confirmationOption}>"{optionText}"</p>
          <p className={styles.gestureInstructions}>
            🤜 Haz <strong>puño</strong> para confirmar | 🖐️{" "}
            <strong>Abre la mano</strong> para cancelar
          </p>
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

function GestureInterface({
  gestureRecognition,
  pendingCommand,
  showConfirmation,
  currentQuestion,
  reducedMode,
}) {
  const canvasRef = useRef(null);

  // Dibuja los landmarks de la mano en el canvas overlay
  const drawHandLandmarks = () => {
    const canvas = canvasRef.current;
    const video = gestureRecognition.videoRef.current;

    if (!canvas || !video || !gestureRecognition.handLandmarks) return;

    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const landmarks = gestureRecognition.handLandmarks;

    // Configuración de estilo
    ctx.fillStyle = reducedMode ? "#00ff88" : "#00ffff";
    ctx.strokeStyle = reducedMode ? "#00ff88" : "#ff00ff";
    ctx.lineWidth = reducedMode ? 3 : 2;

    // Dibujar puntos de los landmarks
    landmarks.forEach((landmark, index) => {
      const x = landmark.x * canvas.width;
      const y = landmark.y * canvas.height;

      ctx.beginPath();
      ctx.arc(x, y, reducedMode ? 6 : 4, 0, 2 * Math.PI);
      ctx.fill();

      // Números en puntos clave
      if ([0, 4, 8, 12, 16, 20].includes(index)) {
        ctx.fillStyle = reducedMode ? "#ffffff" : "#ffff00";
        ctx.font = `${reducedMode ? "14px" : "12px"} Arial`;
        ctx.fillText(index.toString(), x + 8, y - 8);
        ctx.fillStyle = reducedMode ? "#00ff88" : "#00ffff";
      }
    });

    // Dibujar conexiones de la mano
    const connections = [
      // Pulgar
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      // Índice
      [0, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      // Medio
      [0, 9],
      [9, 10],
      [10, 11],
      [11, 12],
      // Anular
      [0, 13],
      [13, 14],
      [14, 15],
      [15, 16],
      // Meñique
      [0, 17],
      [17, 18],
      [18, 19],
      [19, 20],
      // Palma
      [5, 9],
      [9, 13],
      [13, 17],
    ];

    connections.forEach(([start, end]) => {
      const startPoint = landmarks[start];
      const endPoint = landmarks[end];

      ctx.beginPath();
      ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height);
      ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height);
      ctx.stroke();
    });
  };

  // Actualizar el dibujo cuando cambien los landmarks
  useEffect(() => {
    if (gestureRecognition.handLandmarks) {
      drawHandLandmarks();
    }
  }, [gestureRecognition.handLandmarks, reducedMode]);

  const getGestureInfo = () => {
    const fingerCount = gestureRecognition.detectedGesture;
    if (fingerCount === null) return null;

    const options = ["A", "B", "C", "D"];
    const gestures = ["👆", "✌️", "🤟", "🖖"];

    if (fingerCount >= 1 && fingerCount <= 4) {
      return {
        letter: options[fingerCount - 1],
        emoji: gestures[fingerCount - 1],
        text: currentQuestion.options[fingerCount - 1],
        count: fingerCount,
      };
    }

    if (fingerCount === 0)
      return { letter: "OK", emoji: "👊", text: "Confirmar", count: 0 };
    if (fingerCount === 5)
      return { letter: "CANCEL", emoji: "🖐️", text: "Cancelar", count: 5 };

    return null;
  };

  const gestureInfo = getGestureInfo();

  return (
    <div
      className={`${styles.gestureInterface} ${
        reducedMode ? styles.reduced : styles.vibrant
      }`}
    >
      {/* Header con título dinámico */}
      <div className={styles.gestureHeader}>
        <div className={styles.gestureTitle}>
          🤚 Sistema de Gestos {reducedMode ? "Suave" : "Vibrante"}
        </div>
        <div className={styles.gestureSubtitle}>
          {showConfirmation ? "Confirma tu respuesta" : "Selecciona tu opción"}
        </div>
      </div>

      {/* Error handling */}
      {gestureRecognition.error && (
        <div className={styles.gestureError}>⚠️ {gestureRecognition.error}</div>
      )}

      {/* Contenedor principal con cámara y controles */}
      <div className={styles.gestureMainContainer}>
        {/* Video y overlay de detección */}
        <div className={styles.cameraContainer}>
          <video
            ref={gestureRecognition.videoRef}
            className={styles.gestureVideo}
            autoPlay
            muted
            playsInline
          />

          {/* Canvas overlay para dibujar landmarks */}
          <canvas ref={canvasRef} className={styles.landmarksOverlay} />

          {/* Overlay de información */}
          <div className={styles.gestureOverlay}>
            {/* Status indicator */}
            <div className={styles.statusIndicator}>
              <div
                className={`${styles.statusDot} ${
                  gestureRecognition.isActive ? styles.active : styles.inactive
                }`}
              ></div>
              <span>
                {gestureRecognition.isActive
                  ? "MediaPipe Activo"
                  : "Iniciando..."}
              </span>
            </div>

            {/* Detección actual */}
            {gestureInfo && (
              <div className={styles.currentDetection}>
                <div className={styles.gestureEmoji}>{gestureInfo.emoji}</div>
                <div className={styles.gestureInfo}>
                  <div className={styles.gestureOption}>
                    Opción {gestureInfo.letter}
                  </div>
                  <div className={styles.gestureCount}>
                    {gestureInfo.count} dedo{gestureInfo.count !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
            )}

            {/* Confidence meter */}
            {gestureRecognition.confidence > 0 && (
              <div className={styles.confidenceMeter}>
                <div className={styles.confidenceBar}>
                  <div
                    className={styles.confidenceFill}
                    style={{ width: `${gestureRecognition.confidence * 100}%` }}
                  ></div>
                </div>
                <span>{Math.round(gestureRecognition.confidence * 100)}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Panel de instrucciones */}
        <div className={styles.instructionsPanel}>
          {!showConfirmation ? (
            <>
              <h4>Gestos disponibles:</h4>
              <div className={styles.gestureGuide}>
                {currentQuestion.options.map((option, index) => (
                  <div key={index} className={styles.gestureOption}>
                    <span className={styles.gestureEmoji}>
                      {["👆", "✌️", "🤟", "🖖"][index]}
                    </span>
                    <span className={styles.optionLetter}>
                      {["A", "B", "C", "D"][index]}
                    </span>
                    <span className={styles.fingerCount}>
                      {index + 1} dedo{index !== 0 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h4>Confirma tu elección:</h4>
              <div className={styles.confirmationGuide}>
                <div className={styles.gestureOption}>
                  <span className={styles.gestureEmoji}>👊</span>
                  <span className={styles.optionLetter}>OK</span>
                  <span className={styles.fingerCount}>Puño cerrado</span>
                </div>
                <div className={styles.gestureOption}>
                  <span className={styles.gestureEmoji}>🖐️</span>
                  <span className={styles.optionLetter}>CANCEL</span>
                  <span className={styles.fingerCount}>Mano abierta</span>
                </div>
              </div>
            </>
          )}

          {/* Debug info (solo en modo vibrante) */}
          {!reducedMode && gestureRecognition.fingersUp.length > 0 && (
            <div className={styles.debugInfo}>
              <small>
                Debug: [
                {gestureRecognition.fingersUp
                  .map((f) => (f ? "1" : "0"))
                  .join(", ")}
                ]
              </small>
            </div>
          )}
        </div>
      </div>
    </div>
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
