# Kaleidos — Plataforma de diseño web con código abierto

**Kaleidos** es una plataforma web interactiva inspirada en los creadores de **Penpot** y **Taiga**. Este proyecto sirve como prototipo funcional de herramientas colaborativas multiplataforma utilizando estándares de código abierto. En esta plataforma, podemos crear nuestros diseños web y visualizar, simultáneamente, el código correspondiente en HTML, CSS y Javascript. A su vez, se pueden visualizar las tareas pendientes, en desarrollo y finalizadas, permitiendo añadir otras nuevas. También permite cambiar los colores, las formas, añadir texto, visualizar los eventos disponibles de diseño y apuntarnos a ellos.

---

## Tecnologías Utilizadas

El proyecto está construido exclusivamente bajo principios de código abierto, con código nativo ligero y de alto rendimiento:

1. **Capas de Estructura e Interacción (Core):**
   * **HTML5 Semántico:** Para una estructura de documento robusta, accesible por lectores de pantalla y compatible con SEO.
   * **SVG (Scalable Vector Graphics):** Para renderizar las figuras del lienzo y la estructura geométrica articulada del avatar del intérprete.
   * **API de Drag-and-Drop (HTML5):** Permite el arrastre nativo de tarjetas en el tablero de Taiga.

2. **Diseño y Estética (CSS3):**
   * **CSS3 Vanilla:** Uso extensivo de variables personalizadas (`var()`) para temas oscuros en tiempo real, efectos de desenfoque (*backdrop-filter*) para estética glassmorphism premium, transiciones fluidas y animaciones clave (`keyframes`).
   * **Joint SVG Transforms:** Uso de `transform-box: fill-box;` y `transform-origin` para rotar las articulaciones de los hombros y codos del avatar sin desalinear su cuerpo.

3. **Lógica de Aplicación e Inclusión (JavaScript ES6+):**
   * **Web Audio API:** Generación binaria y dinámica de búferes PCM en formato de datos WAV. Esto garantiza tonos de audio y sonidos de clic rápidos y compatibles sin depender de archivos de audio externos.
   * **Web Speech API (SpeechSynthesis):** Conversión de texto a voz para la función de Lector Hover en múltiples lenguajes (español/inglés).
   * **Web Speech API (SpeechRecognition):** Transcripción continua del habla del micrófono a texto escrito en pantalla en tiempo real.
   * **MediaDevices API (getUserMedia):** Solicitud y renderizado seguro del flujo de video de la cámara web local dentro del avatar.

4. **Recursos y Utilidades:**
   * **Lucide Icons:** Iconografía moderna y minimalista procesada e inicializada de forma asíncrona mediante el cliente web.
   * **Google Fonts (Outfit & Inter):** Tipografías modernas que otorgan legibilidad superior y apariencia premium.

---

## Cómo Empezar (Instrucciones)

No se requieren dependencias pesadas ni compiladores complejos. Puedes abrir y ejecutar el proyecto localmente de las siguientes maneras:

### Opción 1: Servidor Local (Recomendado)
Ejecuta un servidor web simple en el directorio `kaleidos/` desde tu terminal:

**Usando Node.js / npm:**
```bash
npx http-server . -p 8000
```
o
```bash
npx live-server
```

**Usando Python:**
```bash
python -m http.server 8000
```

Luego abre en tu navegador:
👉 **[http://localhost:8000](http://localhost:8000)**

### Opción 2: Apertura Directa
Simplemente haz doble clic en el archivo [index.html](index.html) para abrirlo directamente en cualquier navegador web moderno.
