export type UploadOverlayStatus = 'uploading' | 'success' | 'error';

export interface UploadOverlayController {
  success(message?: string): void;
  error(message?: string): void;
}

type Options = {
  thumbUrl?: string;
  initialMessage?: string;
  background?: string;
  label?: string;
};

function createContainer(): HTMLDivElement {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '72px';
  container.style.left = '12px';
  container.style.zIndex = '999999';
  container.style.pointerEvents = 'none';
  container.style.width = '180px';
  return container;
}

export function showUploadOverlay(opts: Options): UploadOverlayController {
  if (typeof document === 'undefined') {
    // SSR / non-browser safety
    return {
      success() {},
      error() {},
    };
  }

  const { thumbUrl, initialMessage = 'Posting to Gazetteer…', background, label } = opts;
  const container = createContainer();

  const card = document.createElement('div');
  card.style.pointerEvents = 'auto';
  card.style.display = 'flex';
  card.style.alignItems = 'center';
  card.style.gap = '8px';
  card.style.padding = '8px 10px';
  card.style.borderRadius = '14px';
  card.style.background = 'rgba(3,7,18,0.95)'; // bg-slate-950/95
  card.style.border = '1px solid rgba(148,163,184,0.7)'; // slate-400/70
  card.style.boxShadow = '0 10px 25px rgba(0,0,0,0.6)';
  card.style.backdropFilter = 'blur(10px)';

  const thumb = document.createElement('div');
  thumb.style.width = '42px';
  thumb.style.height = '56px';
  thumb.style.borderRadius = '10px';
  thumb.style.overflow = 'hidden';
  thumb.style.flexShrink = '0';
  thumb.style.border = '1px solid rgba(148,163,184,0.5)';
  thumb.style.backgroundColor = '#020617';

  if (thumbUrl) {
    const img = document.createElement('img');
    img.src = thumbUrl;
    img.alt = 'Uploading preview';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    thumb.appendChild(img);
  } else {
    // Text-only / template fallback: block that can match template background
    const placeholder = document.createElement('div');
    placeholder.style.width = '100%';
    placeholder.style.height = '100%';
    placeholder.style.display = 'flex';
    placeholder.style.alignItems = 'center';
    placeholder.style.justifyContent = 'center';
    if (background) {
      placeholder.style.background = background;
    } else {
      placeholder.style.backgroundImage = 'linear-gradient(135deg,#3b82f6,#a855f7)';
    }
    placeholder.style.color = '#f9fafb';
    placeholder.style.fontSize = '14px';
    placeholder.style.fontWeight = '600';
    placeholder.textContent = label || 'Aa';
    thumb.appendChild(placeholder);
  }

  const textWrap = document.createElement('div');
  textWrap.style.display = 'flex';
  textWrap.style.flexDirection = 'column';
  textWrap.style.gap = '2px';
  textWrap.style.flex = '1';
  textWrap.style.minWidth = '0';

  const title = document.createElement('div');
  title.textContent = 'Preparing post…';
  title.style.fontSize = '11px';
  title.style.fontWeight = '600';
  title.style.color = '#e5e7eb';

  const message = document.createElement('div');
  message.textContent = initialMessage;
  message.style.fontSize = '11px';
  message.style.color = '#9ca3af';
  message.style.whiteSpace = 'nowrap';
  message.style.overflow = 'hidden';
  message.style.textOverflow = 'ellipsis';

  textWrap.appendChild(title);
  textWrap.appendChild(message);

  card.appendChild(thumb);
  card.appendChild(textWrap);

  container.appendChild(card);
  document.body.appendChild(container);

  const updateStatus = (status: UploadOverlayStatus, msg: string) => {
    if (!container.parentNode) return;
    if (status === 'uploading') {
      title.textContent = 'Preparing post…';
    } else if (status === 'success') {
      title.textContent = 'Posted!';
    } else if (status === 'error') {
      title.textContent = 'Post failed';
    }
    message.textContent = msg;
  };

  const scheduleRemove = (delayMs: number) => {
    window.setTimeout(() => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }, delayMs);
  };

  return {
    success(msg = 'Your post is now live on the feed.') {
      updateStatus('success', msg);
      scheduleRemove(1800);
    },
    error(msg = 'Could not post. Please try again.') {
      updateStatus('error', msg);
      scheduleRemove(2800);
    },
  };
}

