export function showToast(message: string, durationMs = 2000) {
    try {
        const containerId = 'app-toast-container';
        let container = document.getElementById(containerId);
        if (!container) {
            container = document.createElement('div');
            container.id = containerId;
            container.style.position = 'fixed';
            container.style.left = '50%';
            container.style.bottom = '24px';
            container.style.transform = 'translateX(-50%)';
            container.style.zIndex = '9999';
            container.style.pointerEvents = 'none';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.pointerEvents = 'auto';
        toast.style.background = 'rgba(17,24,39,0.92)';
        toast.style.color = '#fff';
        toast.style.padding = '10px 14px';
        toast.style.marginTop = '8px';
        toast.style.borderRadius = '10px';
        toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
        toast.style.fontSize = '14px';
        toast.style.fontWeight = '600';
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 200ms ease, transform 200ms ease';
        toast.style.transform = 'translateY(8px)';

        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(8px)';
            setTimeout(() => toast.remove(), 220);
        }, durationMs);
    } catch {
        // Fallback
        // eslint-disable-next-line no-alert
        alert(message);
    }
}


