/**
 * HTML Export — generates a self-contained HTML document from classroom data.
 * Embeds KaTeX from CDN for math rendering. Widget HTML scenes embedded via srcdoc iframes.
 */

interface Scene {
  id: string;
  type: string;
  title: string;
  description?: string;
  content?: any;
}

interface ClassroomData {
  id: string;
  topic: string;
  createdAt: string;
  scenes: Scene[];
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSlideScene(scene: Scene): string {
  const content = scene.content;
  const points: string[] = content?.keyPoints || content?.points || [];
  const elements: any[] = content?.elements || content?.slides?.[0]?.elements || [];

  let body = "";
  if (elements.length > 0) {
    const textEls = elements.filter((e: any) => e?.type === "text" && (e.content || e.text));
    body = textEls.map((e: any) => `<p>${escapeHtml(String(e.content || e.text || ""))}</p>`).join("\n");
  } else if (points.length > 0) {
    body = `<ol>${points.map((p) => `<li>${escapeHtml(String(p))}</li>`).join("")}</ol>`;
  } else if (scene.description) {
    body = `<p>${escapeHtml(scene.description)}</p>`;
  }

  return `<section class="scene slide-scene">
  <h2>${escapeHtml(scene.title)}</h2>
  ${body}
</section>`;
}

function renderQuizScene(scene: Scene): string {
  const questions: any[] = scene.content?.questions || [];
  const qHtml = questions.slice(0, 10).map((q, qi) => {
    const opts: string[] = q.options || [];
    const correct: number = q.correctAnswer ?? q.correctIndex ?? -1;
    const optsHtml = opts.map((o, oi) =>
      `<li class="option" data-correct="${oi === correct}" onclick="revealAnswer(this)">${escapeHtml(String(o))}</li>`
    ).join("");
    return `<div class="quiz-question">
  <p class="q-text">${qi + 1}. ${escapeHtml(String(q.question || q.text || ""))}</p>
  <ul class="options">${optsHtml}</ul>
  ${q.explanation ? `<p class="explanation hidden">${escapeHtml(String(q.explanation))}</p>` : ""}
</div>`;
  }).join("\n");

  return `<section class="scene quiz-scene">
  <h2>${escapeHtml(scene.title)}</h2>
  ${qHtml}
</section>`;
}

function renderPBLScene(scene: Scene): string {
  const content = scene.content;
  const tasks: any[] = content?.tasks || content?.milestones || [];

  return `<section class="scene pbl-scene">
  <h2>${escapeHtml(scene.title)}</h2>
  ${content?.description ? `<p>${escapeHtml(String(content.description))}</p>` : ""}
  ${tasks.length > 0 ? `<ul>${tasks.map((t: any) => `<li>${escapeHtml(String(t.title || t.name || t))}</li>`).join("")}</ul>` : ""}
</section>`;
}

function renderWidgetScene(scene: Scene): string {
  const html: string | undefined = scene.content?.html ?? scene.content?.config?.html;
  const inner = html
    ? `<iframe class="widget-iframe" srcdoc="${escapeHtml(html)}" sandbox="allow-scripts allow-forms" loading="lazy"></iframe>`
    : `<p class="placeholder">[Interactive: ${escapeHtml(scene.type)}]</p>`;

  return `<section class="scene widget-scene">
  <h2>${escapeHtml(scene.title)}</h2>
  ${inner}
</section>`;
}

export function generateClassroomHTML(classroom: ClassroomData): string {
  const scenesHtml = classroom.scenes.map((scene) => {
    switch (scene.type) {
      case "slide":
      case "slides":
        return renderSlideScene(scene);
      case "quiz":
        return renderQuizScene(scene);
      case "pbl":
        return renderPBLScene(scene);
      default:
        return renderWidgetScene(scene);
    }
  });

  const navItems = classroom.scenes.map((s, i) =>
    `<li><a href="#scene-${i}" onclick="showScene(${i});return false;">${escapeHtml(s.title)}</a></li>`
  ).join("");

  // Wrap each scene in a numbered div for navigation
  const wrappedScenes = scenesHtml.map((html, i) =>
    `<div id="scene-${i}" class="scene-wrapper" style="display:${i === 0 ? "block" : "none"}">${html}</div>`
  ).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(classroom.topic)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; display: flex; min-height: 100vh; }
    nav { width: 220px; min-height: 100vh; background: #1e293b; padding: 1.5rem 1rem; flex-shrink: 0; border-right: 1px solid #334155; }
    nav h1 { font-size: 0.9rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 1rem; }
    nav ul { list-style: none; margin: 0; padding: 0; }
    nav li a { display: block; padding: 0.4rem 0.5rem; border-radius: 6px; color: #cbd5e1; text-decoration: none; font-size: 0.85rem; transition: background 0.15s; }
    nav li a:hover { background: #334155; color: #fff; }
    main { flex: 1; padding: 2rem; max-width: 900px; }
    .scene { margin-bottom: 2rem; }
    .scene h2 { font-size: 1.4rem; font-weight: 700; color: #f1f5f9; margin-bottom: 1rem; }
    .slide-scene p, .slide-scene ol { color: #cbd5e1; line-height: 1.7; }
    .slide-scene ol { padding-left: 1.5rem; }
    .quiz-question { margin-bottom: 1.5rem; }
    .q-text { font-weight: 600; margin-bottom: 0.5rem; }
    .options { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .option { padding: 0.5rem 1rem; background: #1e293b; border: 1px solid #334155; border-radius: 8px; cursor: pointer; transition: background 0.15s; }
    .option:hover { background: #334155; }
    .option[data-correct="true"].revealed { background: #166534; border-color: #22c55e; }
    .option[data-correct="false"].revealed { background: #7f1d1d; border-color: #ef4444; }
    .explanation { margin-top: 0.5rem; font-size: 0.85rem; color: #94a3b8; }
    .hidden { display: none; }
    .widget-iframe { width: 100%; height: 480px; border: 1px solid #334155; border-radius: 8px; background: #1e293b; }
    .placeholder { color: #94a3b8; font-style: italic; }
    .pbl-scene ul { color: #cbd5e1; line-height: 1.7; }
    .nav-buttons { display: flex; gap: 0.75rem; margin-top: 1.5rem; }
    button { padding: 0.5rem 1.25rem; border-radius: 8px; border: none; cursor: pointer; font-size: 0.9rem; transition: opacity 0.15s; }
    .btn-prev { background: #334155; color: #e2e8f0; }
    .btn-next { background: #4f46e5; color: #fff; }
    button:hover { opacity: 0.85; }
  </style>
</head>
<body>
  <nav>
    <h1>${escapeHtml(classroom.topic)}</h1>
    <ul>${navItems}</ul>
  </nav>
  <main>
    ${wrappedScenes}
    <div class="nav-buttons">
      <button class="btn-prev" onclick="navigate(-1)">← Previous</button>
      <button class="btn-next" onclick="navigate(1)">Next →</button>
    </div>
  </main>
  <script>
    var current = 0;
    var total = ${classroom.scenes.length};
    function showScene(i) {
      document.querySelectorAll('.scene-wrapper').forEach(function(el, idx) {
        el.style.display = idx === i ? 'block' : 'none';
      });
      current = i;
    }
    function navigate(dir) {
      var next = Math.max(0, Math.min(total - 1, current + dir));
      showScene(next);
    }
    function revealAnswer(el) {
      var opts = el.closest('.options').querySelectorAll('.option');
      opts.forEach(function(o) { o.classList.add('revealed'); });
      var exp = el.closest('.quiz-question').querySelector('.explanation');
      if (exp) exp.classList.remove('hidden');
    }
  </script>
</body>
</html>`;
}
