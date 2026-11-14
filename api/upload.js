import { put } from '@vercel/blob';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const chunks=[];
    for await (const chunk of req) chunks.push(chunk);
    const body=Buffer.concat(chunks);
    const contentType=req.headers['content-type']||'';
    const match=contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if(!match) return res.status(400).json({error:'Invalid multipart request'});
    const boundary=Buffer.from('--'+(match[1]||match[2]));
    let fileBuffer=null, mimeType='image/webp', filename='upload.webp';
    let start=body.indexOf(boundary);
    while(start!==-1){
      start+=boundary.length;
      if(body.subarray(start,start+2).equals(Buffer.from('--')))break;
      if(body.subarray(start,start+2).equals(Buffer.from('\r\n')))start+=2;
      const headerEnd=body.indexOf(Buffer.from('\r\n\r\n'),start);
      if(headerEnd===-1)break;
      const headers=body.subarray(start,headerEnd).toString('utf8');
      const next=body.indexOf(boundary,headerEnd+4);
      if(next===-1)break;
      if(/name="file"/i.test(headers)){
        const typeMatch=headers.match(/content-type:\s*([^\r\n]+)/i);
        const nameMatch=headers.match(/filename="([^"]+)"/i);
        mimeType=typeMatch?typeMatch[1].trim().toLowerCase():mimeType;
        filename=nameMatch?nameMatch[1]:filename;
        fileBuffer=body.subarray(headerEnd+4,next-2);
        break;
      }
      start=next;
    }
    if(!fileBuffer||!fileBuffer.length)return res.status(400).json({error:'No image file provided'});
    if(!mimeType.startsWith('image/'))return res.status(415).json({error:'Only image files are allowed'});
    if(fileBuffer.length>4*1024*1024)return res.status(413).json({error:'Image exceeds 4 MB limit'});
    const safeName=filename.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-80)||'image.webp';
    const blob=await put(`pharmacy-images/${Date.now()}-${safeName}`,fileBuffer,{access:'public',contentType:mimeType,addRandomSuffix:true});
    return res.status(200).json({url:blob.url});
  }catch(error){return res.status(500).json({error:error?.message||'Upload failed'});}
}
