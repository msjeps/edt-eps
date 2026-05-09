/**
 * Système de notifications toast
 */

const container = () => document.getElementById('toast-container');

// action = { label: string, fn: function } optionnel
export function showToast(message, type = 'info', duration = 3000, action = null) {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;

  if (action) {
    const span = document.createElement('span');
    span.textContent = message;
    el.appendChild(span);
    const btn = document.createElement('button');
    btn.textContent = action.label;
    btn.className = 'toast-action-btn';
    btn.addEventListener('click', () => { action.fn(); el.remove(); });
    el.appendChild(btn);
  } else {
    el.textContent = message;
  }

  container().appendChild(el);

  const fade = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(10px)';
    el.style.transition = 'all 200ms ease';
    setTimeout(() => el.remove(), 200);
  }, duration);

  // Si l'utilisateur clique sur l'action, on annule le fade auto
  el.addEventListener('click', () => clearTimeout(fade), { once: true });
}

export const toast = {
  success: (msg, action = null) => showToast(msg, 'success', 3000, action),
  error:   (msg) => showToast(msg, 'error', 5000),
  warning: (msg, action = null) => showToast(msg, 'warning', 4000, action),
  info:    (msg) => showToast(msg, 'info'),
};
