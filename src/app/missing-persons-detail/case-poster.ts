import { TitleCasePipe } from '@angular/common';
import { MissingPersonDetail } from '../core/models/missing-person-detail.model';
import { casePath } from '../core/models/case-url';
import { personLocation } from '../core/models/missing-person-display';
import { currentAge, publicImageUrl } from './case-profile-format';

export interface CasePosterData {
  name: string;
  missingAge: string;
  currentAge: string;
  height: string;
  weight: string;
  appearance: string;
  lastSeen: string;
  agency: string;
  phone: string;
  reference: string;
  caseUrl: string;
  generated: string;
  imageUrl: string | null;
}

export function posterData(
  record: MissingPersonDetail,
  imageUrl: string | null,
  origin: string,
): CasePosterData {
  const demographics = record.demographics;
  const agency = record.contacts?.investigatingAgencies?.[0];
  const text = (value: unknown) =>
    value == null || String(value).trim() === '' ? 'Not provided' : String(value).trim();
  const location = record.summary?.lastKnownLocation || personLocation(record);
  const lastDate = record.circumstances?.dateOfLastContact || record.missing_since;
  const height = demographics?.heightInches;
  const weight = demographics?.weight;
  return {
    name: new TitleCasePipe().transform(
      record.summary?.fullName ||
        record.full_name ||
        record._source?.full_name ||
        'Name not provided',
    ),
    missingAge: text(demographics?.missingAge ?? record.age_when_missing ?? record['age missing']),
    currentAge: text(
      demographics?.currentAge ?? record.current_age ?? record['age now'] ?? currentAge(record),
    ),
    height:
      height != null ? `${Math.floor(height / 12)} ft ${height % 12} in` : text(record.height),
    weight:
      weight?.value != null
        ? `${weight.value} ${weight.unit || '(unit not provided)'}`
        : text(record.weight),
    appearance: `Eyes ${text(record.physicalDescription?.leftEyeColor || record['eye color'])} · Hair ${text(record.physicalDescription?.hairColor || record['hair color'])}`,
    lastSeen: [lastDate, location].filter(Boolean).join(' · ') || 'Not provided',
    agency: text(agency?.agencyName || record.summary?.reportingAgency || record.agency),
    phone: text(agency?.agencyPhone || record['agency phone']),
    reference: text(
      agency?.agencyCaseNumber ||
        record.caseNumber ||
        record.contacts?.namusCaseNumber ||
        record.contacts?.ncmecCaseNumber,
    ),
    caseUrl: new URL(casePath(record), origin).href,
    generated: new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date()),
    imageUrl: publicImageUrl(imageUrl),
  };
}

async function loadPhoto(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = window.setTimeout(() => {
      image.src = '';
      reject(new Error('Photo timed out'));
    }, 10000);
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      window.clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('Photo unavailable'));
    };
    image.src = url;
  });
}

export async function renderPoster(
  data: CasePosterData,
): Promise<{ image: string; photoMissing: boolean }> {
  const canvas = document.createElement('canvas');
  canvas.width = 1224;
  canvas.height = 1584;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Poster preview is unavailable in this browser.');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Fit each block into the printable page without cutting off names or contacts.
  const block = (
    value: string,
    x: number,
    y: number,
    width: number,
    height: number,
    size: number,
    bold = false,
  ) => {
    let lines: string[] = [];
    do {
      context.font = `${bold ? '700' : '400'} ${size}px Arial, sans-serif`;
      lines = [''];
      for (const word of value.replace(/\s+/g, ' ').trim().split(' ')) {
        const last = lines.length - 1;
        const candidate = lines[last] ? `${lines[last]} ${word}` : word;
        if (context.measureText(candidate).width <= width) lines[last] = candidate;
        else if (context.measureText(word).width <= width) lines.push(word);
        else {
          for (const character of word) {
            const index = lines.length - 1;
            if (context.measureText(lines[index] + character).width > width) lines.push(character);
            else lines[index] += character;
          }
        }
      }
      if (lines.length * size * 1.25 <= height) break;
      size -= 2;
    } while (size >= 16);
    if (size < 16) throw new Error('Some case details are too long to fit on a one-page poster.');
    context.fillStyle = '#152b43';
    context.textBaseline = 'top';
    lines.forEach((line, index) => context.fillText(line, x, y + index * size * 1.25));
  };

  context.fillStyle = '#9c2025';
  context.fillRect(0, 0, 1224, 132);
  context.fillStyle = '#fff';
  context.font = '700 76px Arial, sans-serif';
  context.textBaseline = 'top';
  context.fillText('MISSING', 64, 24);
  block(data.name, 64, 156, 1096, 116, 52, true);

  let photoMissing = true;
  if (data.imageUrl) {
    try {
      const image = await loadPhoto(data.imageUrl);
      const photo = document.createElement('canvas');
      photo.width = image.naturalWidth;
      photo.height = image.naturalHeight;
      const photoContext = photo.getContext('2d');
      if (!photoContext) throw new Error('Photo unavailable');
      photoContext.drawImage(image, 0, 0);
      const safeImage = await loadPhoto(photo.toDataURL('image/png'));
      const scale = Math.min(460 / image.naturalWidth, 520 / image.naturalHeight);
      context.drawImage(
        safeImage,
        64 + (460 - image.naturalWidth * scale) / 2,
        300 + (520 - image.naturalHeight * scale) / 2,
        image.naturalWidth * scale,
        image.naturalHeight * scale,
      );
      photoMissing = false;
    } catch {
      context.fillStyle = '#edf2f7';
      context.fillRect(64, 300, 460, 520);
    }
  }
  if (photoMissing) block('Photo unavailable', 100, 510, 380, 100, 32);
  const facts = [
    ['Age when missing', data.missingAge],
    ['Current age', data.currentAge],
    ['Height', data.height],
    ['Weight', data.weight],
    ['Appearance', data.appearance],
  ];
  facts.forEach(([label, value], index) => {
    block(label, 570, 300 + index * 104, 590, 30, 23, true);
    block(value, 570, 334 + index * 104, 590, 68, 29);
  });
  block('Last seen', 64, 856, 1096, 36, 26, true);
  block(data.lastSeen, 64, 896, 1096, 100, 32);
  block('If you have information, contact', 64, 1020, 1096, 40, 26, true);
  block(data.agency, 64, 1066, 1096, 86, 32);
  block(
    data.phone === 'Not provided' ? 'See the case page for contact updates' : data.phone,
    64,
    1160,
    1096,
    68,
    42,
    true,
  );
  block(`Case reference ${data.reference}`, 64, 1242, 830, 76, 23);
  const { toDataURL } = await import('qrcode');
  const qr = await loadPhoto(
    await toDataURL(data.caseUrl, { width: 260, margin: 4, errorCorrectionLevel: 'M' }),
  );
  context.drawImage(qr, 930, 1300, 230, 230);
  block('Scan for current case details', 64, 1340, 830, 42, 28, true);
  block(data.caseUrl, 64, 1384, 830, 104, 21);
  block(`MissingLives.com · Generated ${data.generated}`, 64, 1526, 1096, 35, 21);
  return { image: canvas.toDataURL('image/png'), photoMissing };
}

export async function posterPdf(image: string): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const poster = await pdf.embedPng(image);
  page.drawImage(poster, { x: 0, y: 0, width: 612, height: 792 });
  pdf.setTitle('Missing person poster');
  return pdf.save();
}
