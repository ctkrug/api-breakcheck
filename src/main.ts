import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  app.innerHTML = `
    <main>
      <h1>API Breakcheck</h1>
      <p>Paste two OpenAPI specs to see what changed &mdash; and what it'll break.</p>
    </main>
  `;
}
