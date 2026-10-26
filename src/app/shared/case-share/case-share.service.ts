import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

export interface CaseShareData {
  title: string;
  text: string;
  url: string;
}

@Injectable({ providedIn: 'root' })
export class CaseShareService {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  readonly nativeAvailable = !!this.document.defaultView?.navigator.share;

  data(id: string, name: string, location: string): CaseShareData {
    const path = this.router.serializeUrl(this.router.createUrlTree(['/missing-persons', id]));
    return {
      title: name,
      text: `Help find ${name}.${location && location !== 'Location unavailable' ? ` Last known location: ${location}.` : ''} View case details and share information:`,
      url: new URL(path, this.document.baseURI).href,
    };
  }

  links(data: CaseShareData) {
    const url = encodeURIComponent(data.url);
    return [
      {
        label: 'WhatsApp',
        url: `https://wa.me/?text=${encodeURIComponent(`${data.text} ${data.url}`)}`,
      },
      { label: 'Facebook', url: `https://www.facebook.com/sharer/sharer.php?u=${url}` },
      {
        label: 'X',
        url: `https://x.com/intent/tweet?url=${url}&text=${encodeURIComponent(data.text)}`,
      },
      { label: 'LinkedIn', url: `https://www.linkedin.com/sharing/share-offsite/?url=${url}` },
      {
        label: 'Reddit',
        url: `https://www.reddit.com/submit?url=${url}&title=${encodeURIComponent(`Help find ${data.title}`)}`,
      },
      {
        label: 'Telegram',
        url: `https://t.me/share/url?url=${url}&text=${encodeURIComponent(data.text)}`,
      },
    ];
  }

  async copy(data: CaseShareData): Promise<string> {
    try {
      const clipboard = this.document.defaultView?.navigator.clipboard;
      if (!clipboard?.writeText) throw new Error('Clipboard unavailable');
      await clipboard.writeText(data.url);
      return 'Case link copied to clipboard.';
    } catch {
      return `Copy this case link: ${data.url}`;
    }
  }

  async copyMessage(data: CaseShareData): Promise<string> {
    const text = `${data.text} ${data.url}`;
    try {
      const clipboard = this.document.defaultView?.navigator.clipboard;
      if (!clipboard?.writeText) throw new Error('Clipboard unavailable');
      await clipboard.writeText(text);
      return 'Case message copied to clipboard.';
    } catch {
      return `Copy this message: ${text}`;
    }
  }

  async downloadImage(data: CaseShareData & { location: string }, photo: string): Promise<string> {
    const canvas = this.document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.fillStyle = '#f1f5f9';
    context.fillRect(0, 0, 1080, 1080);
    context.fillStyle = '#172e50';
    context.fillRect(0, 0, 1080, 130);
    context.fillStyle = 'white';
    context.font = 'bold 48px sans-serif';
    context.fillText('HELP BRING THEM HOME', 55, 82);
    let hasPhoto = false;
    try {
      const image = this.document.createElement('img');
      image.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          image.src = '';
          reject(new Error('Photo timeout'));
        }, 5000);
        image.onload = () => {
          clearTimeout(timer);
          resolve();
        };
        image.onerror = () => {
          clearTimeout(timer);
          reject(new Error('Photo unavailable'));
        };
        image.src = photo;
      });
      const scale = Math.min(970 / image.naturalWidth, 420 / image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      context.drawImage(image, (1080 - width) / 2, 155 + (420 - height) / 2, width, height);
      hasPhoto = true;
    } catch {
      /* Export public case text when the photo is unavailable or CORS blocks it. */
    }
    context.fillStyle = '#172e50';
    const wrap = (text: string, y: number, size: number, maxLines: number) => {
      context.font = `${size === 48 ? 'bold ' : ''}${size}px sans-serif`;
      const lines: string[] = [];
      let line = '';
      for (const char of text) {
        if (context.measureText(line + char).width > 970) {
          lines.push(line);
          line = '';
        }
        line += char;
      }
      if (line) lines.push(line);
      lines.slice(0, maxLines).forEach((value, index) => {
        context.fillText(
          index === maxLines - 1 && lines.length > maxLines ? value.slice(0, -1) + '…' : value,
          55,
          y + index * (size + 12),
        );
      });
    };
    wrap(data.title, 645, 48, 2);
    wrap(data.location || 'Location unavailable', 790, 30, 2);
    wrap('View the case and share information:', 920, 26, 1);
    wrap(data.url, 965, 23, 3);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error('Image export failed'))),
        'image/png',
      ),
    );
    const url = URL.createObjectURL(blob);
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = `missing-person-${data.title.replace(/[^a-z0-9]+/gi, '-').slice(0, 60) || 'case'}.png`;
    this.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return hasPhoto ? 'Case image downloaded.' : 'Case image downloaded without a photo.';
  }

  async share(data: CaseShareData): Promise<string> {
    const navigator = this.document.defaultView?.navigator;
    if (navigator?.share) {
      try {
        await navigator.share(data);
        return 'Case shared.';
      } catch (error) {
        if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError')
          return '';
      }
    }
    return this.copy(data);
  }
}
