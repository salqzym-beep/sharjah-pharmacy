import { put } from '@vercel/blob';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const contentType = req.headers['content-type'] || '';
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // استخراج الصورة سواء أُرسلت كـ FormData أو كـ Binary مباشرة
    let fileBuffer = buffer;
    let fileName = `img-${Date.now()}.webp`;
    let mimeType = 'image/webp';

    if (contentType.includes('multipart/form-data')) {
      const boundary = contentType.split('boundary=')[1];
      const parts = buffer.toString('binary').split(`--${boundary}`);
      for (const part of parts) {
        if (part.includes('filename=')) {
          const headerEnd = part.indexOf('\r\n\r\n');
          const header = part.slice(0, headerEnd);
          const typeMatch = header.match(/Content-Type:\s*([^\r\n]+)/i);
          if (typeMatch) mimeType = typeMatch[1].trim();
          const bodyBinary = part.slice(headerEnd + 4, part.lastIndexOf('\r\n'));
          fileBuffer = Buffer.from(bodyBinary, 'binary');
          break;
        }
      }
    }

    const blob = await put(`sharjah/${fileName}`, fileBuffer, {
      access: 'public',
      contentType: mimeType,
    });

    return res.status(200).json({ url: blob.url });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Upload failed' });
  }
}
