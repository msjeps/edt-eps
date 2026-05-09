/**
 * Système de modals
 */

const overlay = () => document.getElementById('modal-overlay');

/**
 * Ouvre une modal
 * @param {Object} options - { title, content (HTML string ou Element), footer?, onClose?, wide? }
 */
export function openModal({ title, content, footer, onClose, wide = false }) {
  const ov = overlay();
  ov.classList.remove('hidden');

  const modal = document.createElement('div');
  modal.className = `modal${wide ? ' modal-wide' : ''}`;
  if (wide) modal.style.maxWidth = '900px';

  modal.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">${title}</h3>
      <button class="modal-close">&times;</button>
    </div>
    <div class="modal-body"></div>
    ${footer ? '<div class="modal-footer"></div>' : ''}
  `;

  const body = modal.querySelector('.modal-body');
  if (typeof content === 'string') {
    body.innerHTML = content;
  } else if (content instanceof Element || content instanceof DocumentFragment) {
    body.appendChild(content);
  }

  if (footer) {
    const footerEl = modal.querySelector('.modal-footer');
    if (typeof footer === 'string') {
      footerEl.innerHTML = footer;
    } else if (footer instanceof Element || footer instanceof DocumentFragment) {
      footerEl.appendChild(footer);
    }
  }

  const close = () => {
    ov.classList.add('hidden');
    modal.remove();
    if (onClose) onClose();
  };

  modal.querySelector('.modal-close').addEventListener('click', close);
  ov.addEventListener('click', (e) => {
    if (e.target === ov) close();
  });

  ov.appendChild(modal);
  return { close, modal, body };
}

/**
 * Modal de confirmation
 */
export function confirmModal(title, message) {
  return new Promise((resolve) => {
    let resolved = false; // Empêcher la double résolution

    const footerEl = document.createElement('div');
    footerEl.style.display = 'flex';
    footerEl.style.gap = '0.75rem';
    footerEl.style.justifyContent = 'flex-end';

    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn btn-outline';
    btnCancel.textContent = 'Annuler';

    const btnOk = document.createElement('button');
    btnOk.className = 'btn btn-danger';
    btnOk.textContent = 'Confirmer';

    footerEl.appendChild(btnCancel);
    footerEl.appendChild(btnOk);

    const { close } = openModal({
      title,
      content: `<p>${message}</p>`,
      footer: footerEl,
      onClose: () => { if (!resolved) { resolved = true; resolve(false); } },
    });

    btnCancel.addEventListener('click', () => { resolved = true; close(); resolve(false); });
    btnOk.addEventListener('click', () => { resolved = true; close(); resolve(true); });
  });
}
