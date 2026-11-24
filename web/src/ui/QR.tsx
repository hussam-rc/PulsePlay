import qrcode from 'qrcode-generator';

export default function QR({ text, label }: { text: string; label: string }) {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  return <div role="img" aria-label={label} className="bg-white rounded-2xl p-3 shadow-soft w-48 sm:w-60 aspect-square [&>svg]:w-full [&>svg]:h-full"
    dangerouslySetInnerHTML={{ __html: q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }) }} />;
}

