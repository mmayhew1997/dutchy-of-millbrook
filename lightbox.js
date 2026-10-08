// ----- Photo lightbox: click a cake photo to see it bigger -----
// Closes with the × (top right), a click anywhere outside the photo, or Esc.
(() => {
  const photos = document.querySelectorAll('.home-grid img, .pgrid img');
  if (!photos.length) return;

  const box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'Enlarged photo');
  box.innerHTML =
    '<button class="lightbox-close" type="button" aria-label="Close">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>' +
    '</button><img alt="" />';
  document.body.appendChild(box);
  const img = box.querySelector('img');
  const closeBtn = box.querySelector('.lightbox-close');
  let opener = null;

  const open = (photo) => {
    opener = photo;
    img.src = photo.currentSrc || photo.src;
    img.alt = photo.alt;
    box.classList.add('open');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  };
  const close = () => {
    if (!box.classList.contains('open')) return;
    box.classList.remove('open');
    document.body.style.overflow = '';
    if (opener) opener.focus();
  };

  photos.forEach((photo) => {
    photo.tabIndex = 0;
    photo.addEventListener('click', () => open(photo));
    photo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(photo); }
    });
  });
  // Anything but the photo itself closes it.
  box.addEventListener('click', (e) => { if (e.target !== img) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();
