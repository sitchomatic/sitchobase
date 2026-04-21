/**
 * ContextUploadDialog — allows uploading a user-data-directory zip to a BB Context.
 * BB returns an uploadUrl + AES-256-CBC public key. We encrypt the zip in-browser
 * then PUT to the uploadUrl.
 */
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, CheckCircle, AlertCircle, Lock } from 'lucide-react';
import { toast } from 'sonner';

async function encryptAndUpload(file, uploadUrl, publicKeyPem, ivSize = 16) {
  // Import the RSA public key
  const pemBody = publicKeyPem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s+/g, '');
  const keyBytes = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
  const rsaKey = await crypto.subtle.importKey(
    'spki', keyBytes.buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false, ['encrypt']
  );

  // Generate a random AES-256-CBC key and IV
  const aesKey = await crypto.subtle.generateKey({ name: 'AES-CBC', length: 256 }, true, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(ivSize));

  // Encrypt the file content
  const fileBuffer = await file.arrayBuffer();
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, aesKey, fileBuffer);

  // Export the AES key and encrypt it with the RSA public key
  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
  const encryptedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, rsaKey, rawAesKey);

  // Build payload: [encryptedKey length (4 bytes)] + [encryptedKey] + [iv] + [encrypted content]
  const keyLenBuf = new Uint8Array(4);
  new DataView(keyLenBuf.buffer).setUint32(0, encryptedKey.byteLength, false);
  const payload = new Uint8Array(4 + encryptedKey.byteLength + ivSize + encrypted.byteLength);
  payload.set(keyLenBuf, 0);
  payload.set(new Uint8Array(encryptedKey), 4);
  payload.set(iv, 4 + encryptedKey.byteLength);
  payload.set(new Uint8Array(encrypted), 4 + encryptedKey.byteLength + ivSize);

  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: payload,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${await res.text()}`);
}

export default function ContextUploadDialog({ context, onClose }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | encrypting | uploading | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef(null);

  const handleUpload = async () => {
    if (!file) { toast.error('Select a file first'); return; }
    if (!context.uploadUrl) { toast.error('No upload URL on this context'); return; }
    if (!context.publicKey) { toast.error('No public key on this context'); return; }

    setStatus('encrypting');
    setErrorMsg('');
    try {
      setStatus('uploading');
      await encryptAndUpload(
        file,
        context.uploadUrl,
        context.publicKey,
        context.initializationVectorSize || 16,
      );
      setStatus('done');
      toast.success('User-data-directory uploaded successfully');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message);
      toast.error('Upload failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 w-full max-w-md space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-bold text-white">Upload User Data Directory</h2>
        </div>

        <p className="text-xs text-gray-500">
          Upload a <code className="text-purple-300">.zip</code> of your Chrome user data directory.
          It will be AES-256-CBC encrypted in your browser before upload — Browserbase never sees the plaintext.
        </p>

        <div className="text-xs space-y-1">
          <div className="text-gray-500">Context ID</div>
          <code className="text-gray-300 bg-gray-800 rounded px-2 py-1 block truncate">{context.id}</code>
        </div>

        {/* File picker */}
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-700 hover:border-purple-500/50 rounded-xl p-5 text-center cursor-pointer transition-colors">
          <input ref={inputRef} type="file" accept=".zip" className="hidden"
            onChange={e => setFile(e.target.files?.[0] || null)} />
          {file ? (
            <div className="text-sm text-gray-200 font-medium">{file.name}</div>
          ) : (
            <>
              <Upload className="w-6 h-6 text-gray-600 mx-auto mb-2" />
              <div className="text-xs text-gray-500">Click to select a .zip file</div>
            </>
          )}
        </div>

        {status === 'error' && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {status === 'done' && (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-xs text-emerald-400">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Upload complete — context is ready to use.
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={onClose}
            className="flex-1 border-gray-700 text-gray-400 hover:bg-gray-800 text-xs">
            {status === 'done' ? 'Close' : 'Cancel'}
          </Button>
          {status !== 'done' && (
            <Button onClick={handleUpload} disabled={!file || status === 'encrypting' || status === 'uploading'}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-xs gap-1.5">
              {(status === 'encrypting' || status === 'uploading')
                ? <><Loader2 className="w-3 h-3 animate-spin" /> {status === 'encrypting' ? 'Encrypting…' : 'Uploading…'}</>
                : <><Upload className="w-3 h-3" /> Encrypt & Upload</>}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}