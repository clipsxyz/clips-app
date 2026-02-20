/**
 * SweetAlert2 options for "bottom sheet" style modals (lower half of screen, dark theme, rounded).
 * All app Swals use this style: Gazetteer says shimmer, dark bg, rounded top, white text.
 */
import type { SweetAlertOptions } from 'sweetalert2';

/** Icon: user with plus (follow request) - white on dark */
const FOLLOW_REQUEST_ICON_SVG = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>`;

/** Icon: lock (private account) - white on dark */
const PRIVATE_ACCOUNT_ICON_SVG = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;

/** Icon: alert circle (error/warning) */
const ICON_ALERT_SVG = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

/** Icon: check (success) */
const ICON_SUCCESS_SVG = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;

const BOTTOM_SHEET_BASE: Pick<SweetAlertOptions, 'position' | 'buttonsStyling' | 'background' | 'width' | 'padding' | 'customClass'> = {
  position: 'bottom',
  buttonsStyling: false,
  background: '#1a1a1a',
  width: 'min(400px, calc(100vw - 32px))',
  padding: '0',
  customClass: {
    popup: 'swal-bottom-sheet-popup',
    htmlContainer: 'swal-bottom-sheet-html',
    confirmButton: 'swal-bottom-sheet-confirm',
    cancelButton: 'swal-bottom-sheet-cancel',
  },
};

export type BottomSheetOptions = {
  title: string;
  message?: string;
  html?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  showCancelButton?: boolean;
  showGazetteer?: boolean;
  icon?: 'alert' | 'success' | 'none' | string;
};

/** Generic bottom-sheet Swal options – use for all app alerts */
export function bottomSheet(opts: BottomSheetOptions): SweetAlertOptions {
  const {
    title,
    message,
    html,
    confirmButtonText = 'OK',
    cancelButtonText = 'Cancel',
    showCancelButton = false,
    showGazetteer = true,
    icon = 'alert',
  } = opts;
  const iconSvg = icon === 'alert' ? ICON_ALERT_SVG : icon === 'success' ? ICON_SUCCESS_SVG : icon === 'none' ? '' : icon;
  const gazetteerBlock = showGazetteer ? '<p class="swal-bottom-sheet-gazetteer gazetteer-shimmer">Gazetteer says</p>' : '';
  const iconBlock = iconSvg ? `<div class="swal-bottom-sheet-icon">${iconSvg}</div>` : '';
  const messageBlock = message ? `<p class="swal-bottom-sheet-message">${escapeHtml(message)}</p>` : (html || '');
  const content = `
    <div class="swal-bottom-sheet-content">
      ${gazetteerBlock}
      ${iconBlock}
      <h3 class="swal-bottom-sheet-title-text">${escapeHtml(title)}</h3>
      ${messageBlock}
    </div>
  `;
  return {
    ...BOTTOM_SHEET_BASE,
    showConfirmButton: true,
    confirmButtonText,
    showCancelButton,
    cancelButtonText,
    title: undefined,
    html: content,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function followRequestSentBottomSheet(): SweetAlertOptions {
  return {
    ...BOTTOM_SHEET_BASE,
    showConfirmButton: true,
    confirmButtonText: 'OK',
    showCancelButton: false,
    title: undefined,
    html: `
      <div class="swal-bottom-sheet-content">
        <p class="swal-bottom-sheet-gazetteer gazetteer-shimmer">Gazetteer says</p>
        <div class="swal-bottom-sheet-icon">${FOLLOW_REQUEST_ICON_SVG}</div>
        <h3 class="swal-bottom-sheet-title-text">Follow Request Sent</h3>
        <p class="swal-bottom-sheet-message">Your follow request has been sent. You will be notified when they accept.</p>
      </div>
    `,
  };
}

/** First card: "This account is private" – same bottom-sheet style, Cancel + Follow buttons */
export function accountIsPrivateBottomSheet(): SweetAlertOptions {
  return {
    ...BOTTOM_SHEET_BASE,
    showConfirmButton: true,
    confirmButtonText: 'Follow',
    showCancelButton: true,
    cancelButtonText: 'Cancel',
    title: undefined,
    html: `
      <div class="swal-bottom-sheet-content">
        <p class="swal-bottom-sheet-gazetteer gazetteer-shimmer">Gazetteer says</p>
        <div class="swal-bottom-sheet-icon">${PRIVATE_ACCOUNT_ICON_SVG}</div>
        <h3 class="swal-bottom-sheet-title-text">This Account is Private</h3>
        <p class="swal-bottom-sheet-message">To view this user's profile you must be following them.</p>
      </div>
    `,
  };
}
